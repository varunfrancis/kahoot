"use client";

import { useState } from "react";
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

export function QuizEditor({
  quiz,
  initialQuestions,
}: {
  quiz: Quiz;
  initialQuestions: Question[];
}) {
  const supabase = createClient();
  const [title, setTitle] = useState(quiz.title);
  const [titleSaving, setTitleSaving] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [adding, setAdding] = useState(false);

  async function saveTitle() {
    if (title.trim() === quiz.title) return;
    setTitleSaving(true);
    await supabase.from("quizzes").update({ title: title.trim() }).eq("id", quiz.id);
    setTitleSaving(false);
  }

  async function addQuestion(type: QuestionType) {
    setAdding(true);
    const nextOrder = questions.length;
    const defaults = defaultQuestionShape(type);
    const { data, error } = await supabase
      .from("questions")
      .insert({
        quiz_id: quiz.id,
        question_order: nextOrder,
        question_type: type,
        text: "",
        options: defaults.options,
        correct_answer: defaults.correct_answer,
        time_limit_seconds: 20,
      })
      .select("*")
      .single();
    setAdding(false);
    if (error || !data) {
      alert(error?.message ?? "Failed to add question");
      return;
    }
    setQuestions((prev) => [...prev, data as Question]);
  }

  async function updateQuestion(updated: Question) {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    await supabase
      .from("questions")
      .update({
        text: updated.text,
        options: updated.options,
        correct_answer: updated.correct_answer,
        time_limit_seconds: updated.time_limit_seconds,
      })
      .eq("id", updated.id);
  }

  async function deleteQuestion(id: string) {
    const remaining = questions.filter((q) => q.id !== id);
    setQuestions(remaining);
    await supabase.from("questions").delete().eq("id", id);
    // Renumber remaining
    await Promise.all(
      remaining.map((q, i) =>
        q.question_order === i
          ? Promise.resolve()
          : supabase.from("questions").update({ question_order: i }).eq("id", q.id),
      ),
    );
    setQuestions(remaining.map((q, i) => ({ ...q, question_order: i })));
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            disabled={titleSaving}
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
          <AddTypeButton label="Multiple choice" disabled={adding} onClick={() => addQuestion("multiple_choice")} />
          <AddTypeButton label="True / False" disabled={adding} onClick={() => addQuestion("true_false")} />
          <AddTypeButton label="Ranking" disabled={adding} onClick={() => addQuestion("ranking")} />
          <AddTypeButton label="Type answer" disabled={adding} onClick={() => addQuestion("type_answer")} />
          <AddTypeButton label="Word cloud" disabled={adding} onClick={() => addQuestion("word_cloud")} />
        </div>
      </Card>
    </div>
  );
}

function AddTypeButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button variant="outline" size="sm" disabled={disabled} onClick={onClick}>
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
