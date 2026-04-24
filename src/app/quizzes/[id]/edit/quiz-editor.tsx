"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { QuestionEditor } from "@/components/question-editors/question-editor";
import type {
  Quiz,
  Question,
  QuestionType,
  CorrectAnswer,
} from "@/lib/supabase/types";

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string };

type Snapshot = {
  title: string;
  questions: Map<string, Question>;
};

export function QuizEditor({
  quiz,
  initialQuestions,
}: {
  quiz: Quiz;
  initialQuestions: Question[];
}) {
  const supabase = createClient();
  const [title, setTitle] = useState(quiz.title);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    title: quiz.title,
    questions: new Map(initialQuestions.map((q) => [q.id, q])),
  }));

  const { isDirty, toInsert, toUpdate, toDelete, titleChanged } = useMemo(() => {
    const titleChanged = title.trim() !== snapshot.title;
    const toInsert: Question[] = [];
    const toUpdate: Question[] = [];
    const currentIds = new Set<string>();
    for (const q of questions) {
      currentIds.add(q.id);
      const prior = snapshot.questions.get(q.id);
      if (!prior) {
        toInsert.push(q);
        continue;
      }
      if (
        q.text !== prior.text ||
        q.time_limit_seconds !== prior.time_limit_seconds ||
        q.question_order !== prior.question_order ||
        JSON.stringify(q.options) !== JSON.stringify(prior.options) ||
        JSON.stringify(q.correct_answer) !== JSON.stringify(prior.correct_answer)
      ) {
        toUpdate.push(q);
      }
    }
    const toDelete: string[] = [];
    for (const id of snapshot.questions.keys()) {
      if (!currentIds.has(id)) toDelete.push(id);
    }
    const isDirty =
      titleChanged || toInsert.length > 0 || toUpdate.length > 0 || toDelete.length > 0;
    return { isDirty, toInsert, toUpdate, toDelete, titleChanged };
  }, [title, questions, snapshot]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function addQuestion(type: QuestionType) {
    const defaults = defaultQuestionShape(type);
    const newQuestion: Question = {
      id: crypto.randomUUID(),
      quiz_id: quiz.id,
      question_order: questions.length,
      question_type: type,
      text: "",
      options: defaults.options,
      correct_answer: defaults.correct_answer,
      time_limit_seconds: 20,
    };
    setQuestions((prev) => [...prev, newQuestion]);
  }

  function updateQuestion(updated: Question) {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
  }

  function deleteQuestion(id: string) {
    setQuestions((prev) =>
      prev.filter((q) => q.id !== id).map((q, i) => ({ ...q, question_order: i })),
    );
  }

  async function saveAll() {
    // Validate time limits before hitting the network.
    for (const q of questions) {
      const t = q.time_limit_seconds;
      if (!Number.isFinite(t) || t < 5 || t > 120) {
        setStatus({
          kind: "error",
          message: `Question ${q.question_order + 1} has an invalid time limit (${t}s). Must be 5–120.`,
        });
        return;
      }
    }

    setStatus({ kind: "saving" });

    type OpResult =
      | { kind: "title" }
      | { kind: "insert"; row: Question }
      | { kind: "update"; id: string; row: Question }
      | { kind: "delete"; id: string };

    type OpOutcome = { result: OpResult; error: string | null; rows: number };

    const updatedQuestions = new Map(snapshot.questions);
    let updatedTitle = snapshot.title;
    const failures: string[] = [];

    function applyOutcome(outcome: OpOutcome) {
      if (outcome.error) {
        failures.push(outcome.error);
        return;
      }
      if (outcome.rows === 0) {
        failures.push(
          "Save blocked by database (row-level security). Your session may have expired — sign out and back in.",
        );
        return;
      }
      const r = outcome.result;
      if (r.kind === "title") updatedTitle = title.trim();
      else if (r.kind === "insert") updatedQuestions.set(r.row.id, r.row);
      else if (r.kind === "update") updatedQuestions.set(r.id, r.row);
      else updatedQuestions.delete(r.id);
    }

    function collectSettled(settled: PromiseSettledResult<OpOutcome>[]) {
      for (const s of settled) {
        if (s.status === "rejected") failures.push(String(s.reason));
        else applyOutcome(s.value);
      }
    }

    // Phase 1 — DELETEs in parallel. Frees up question_order slots so later
    // UPDATEs can renumber surviving rows without violating the
    // (quiz_id, question_order) unique constraint.
    const deleteOps = toDelete.map<Promise<OpOutcome>>((id) =>
      (async () => {
        const { data, error } = await supabase
          .from("questions")
          .delete()
          .eq("id", id)
          .select("id");
        return {
          result: { kind: "delete" as const, id },
          error: error?.message ?? null,
          rows: data?.length ?? 0,
        };
      })(),
    );
    collectSettled(await Promise.allSettled(deleteOps));

    // Phase 2 — UPDATEs sequentially in ascending target-order. Deletes have
    // already freed the low slots, and walking up the order means each row
    // moves into the slot just vacated by the previous row. This avoids
    // transient unique-constraint collisions with rows that haven't been
    // moved yet.
    const sortedUpdates = [...toUpdate].sort(
      (a, b) => a.question_order - b.question_order,
    );
    for (const row of sortedUpdates) {
      try {
        const { data, error } = await supabase
          .from("questions")
          .update({
            question_order: row.question_order,
            text: row.text,
            options: row.options,
            correct_answer: row.correct_answer,
            time_limit_seconds: row.time_limit_seconds,
          })
          .eq("id", row.id)
          .select("id");
        applyOutcome({
          result: { kind: "update", id: row.id, row },
          error: error?.message ?? null,
          rows: data?.length ?? 0,
        });
      } catch (err) {
        failures.push(String(err));
      }
    }

    // Phase 3 — INSERTs and the title update in parallel. Inserts always
    // carry the highest orders (new questions are appended), so they can't
    // collide with the updated survivors.
    const phase3: Promise<OpOutcome>[] = [];
    if (titleChanged) {
      phase3.push(
        (async () => {
          const { data, error } = await supabase
            .from("quizzes")
            .update({ title: title.trim() })
            .eq("id", quiz.id)
            .select("id");
          return {
            result: { kind: "title" as const },
            error: error?.message ?? null,
            rows: data?.length ?? 0,
          };
        })(),
      );
    }
    for (const row of toInsert) {
      phase3.push(
        (async () => {
          const { data, error } = await supabase
            .from("questions")
            .insert({
              id: row.id,
              quiz_id: row.quiz_id,
              question_order: row.question_order,
              question_type: row.question_type,
              text: row.text,
              options: row.options,
              correct_answer: row.correct_answer,
              time_limit_seconds: row.time_limit_seconds,
            })
            .select("*")
            .maybeSingle();
          return {
            result: { kind: "insert" as const, row: (data as Question) ?? row },
            error: error?.message ?? null,
            rows: data ? 1 : 0,
          };
        })(),
      );
    }
    collectSettled(await Promise.allSettled(phase3));

    setSnapshot({ title: updatedTitle, questions: updatedQuestions });

    if (failures.length > 0) {
      setStatus({
        kind: "error",
        message:
          failures.length === 1
            ? failures[0]
            : `${failures.length} changes failed to save: ${failures[0]}`,
      });
    } else {
      setStatus({ kind: "idle" });
    }
  }

  const saving = status.kind === "saving";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        {isDirty ? (
          <span
            className="text-sm text-neutral-400 cursor-not-allowed"
            title="Save changes first"
          >
            ← Back to dashboard
          </span>
        ) : (
          <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
            ← Back to dashboard
          </Link>
        )}
        <div className="flex items-center gap-3">
          <StatusBadge status={status} isDirty={isDirty} />
          {isDirty ? (
            <Button variant="outline" disabled title="Save changes first">
              Launch game
            </Button>
          ) : (
            <Link href={`/quizzes/${quiz.id}/host`}>
              <Button variant="outline">Launch game</Button>
            </Link>
          )}
          <Button onClick={saveAll} disabled={!isDirty || saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </header>

      <Card>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </Card>

      {questions.map((q, i) => (
        <QuestionEditor
          key={q.id}
          index={i}
          question={q}
          onChange={updateQuestion}
          onDelete={() => deleteQuestion(q.id)}
        />
      ))}

      <Card>
        <p className="text-sm font-medium mb-3">Add question</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <AddTypeButton label="Multiple choice" onClick={() => addQuestion("multiple_choice")} />
          <AddTypeButton label="True / False" onClick={() => addQuestion("true_false")} />
          <AddTypeButton label="Ranking" onClick={() => addQuestion("ranking")} />
          <AddTypeButton label="Type answer" onClick={() => addQuestion("type_answer")} />
          <AddTypeButton label="Word cloud" onClick={() => addQuestion("word_cloud")} />
        </div>
      </Card>
    </div>
  );
}

function StatusBadge({ status, isDirty }: { status: SaveStatus; isDirty: boolean }) {
  if (status.kind === "saving") {
    return <span className="text-xs text-neutral-500">Saving...</span>;
  }
  if (status.kind === "error") {
    return (
      <span
        className="text-xs text-red-600 dark:text-red-400 max-w-xs truncate"
        title={status.message}
      >
        {status.message}
      </span>
    );
  }
  if (isDirty) {
    return <span className="text-xs text-neutral-500">Unsaved changes</span>;
  }
  return null;
}

function AddTypeButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      {label}
    </Button>
  );
}

function defaultQuestionShape(type: QuestionType): {
  options: string[] | null;
  correct_answer: CorrectAnswer;
} {
  switch (type) {
    case "multiple_choice":
      return { options: ["", "", "", ""], correct_answer: { index: 0 } };
    case "true_false":
      return { options: ["True", "False"], correct_answer: { value: true } };
    case "ranking":
      return { options: ["", "", "", ""], correct_answer: {} };
    case "word_cloud":
      return { options: null, correct_answer: null };
    case "type_answer":
      return { options: null, correct_answer: { accepted: [""], fuzzy: true } };
  }
}
