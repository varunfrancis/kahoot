"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Card } from "@/components/ui/card";
import { Leaderboard } from "@/components/leaderboard";
import type { Answer, AnswerResponse, Player, Question } from "@/lib/supabase/types";

export function FinalResultsDashboard({
  roomId,
  quizId,
  quizTitle,
  players,
  highlightPlayerId,
}: {
  roomId: string;
  quizId: string;
  quizTitle: string;
  players: Player[];
  highlightPlayerId?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Answer[] | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("question_order", { ascending: true }),
      supabase
        .from("answers")
        .select("*, player:players!inner(room_id)")
        .eq("player.room_id", roomId),
    ]).then(([q, a]) => {
      if (!active) return;
      setQuestions((q.data ?? []) as Question[]);
      setAnswers((a.data ?? []) as Answer[]);
    });
    return () => {
      active = false;
    };
  }, [supabase, quizId, roomId]);

  const playersById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of players) map.set(p.id, p);
    return map;
  }, [players]);

  const loading = !questions || !answers;

  const fastest = useMemo(() => {
    if (!answers || answers.length === 0) return null;
    const correct = answers.filter((a) => a.is_correct);
    const pool = correct.length > 0 ? correct : answers;
    return pool.reduce((best, a) => (a.time_taken_ms < best.time_taken_ms ? a : best));
  }, [answers]);

  const totalPoints = useMemo(
    () => players.reduce((sum, p) => sum + (p.score ?? 0), 0),
    [players],
  );

  const topScore = useMemo(
    () => players.reduce((max, p) => (p.score > max ? p.score : max), 0),
    [players],
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-neutral-500">{quizTitle}</p>
        <h1 className="text-3xl font-bold mt-2">Final results</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Players" value={players.length.toString()} />
        <StatCard label="Questions" value={(questions?.length ?? 0).toString()} />
        <StatCard label="Top score" value={topScore.toString()} />
        <StatCard
          label="Fastest answer"
          value={
            fastest
              ? `${(fastest.time_taken_ms / 1000).toFixed(1)}s`
              : "—"
          }
          sub={fastest ? playersById.get(fastest.player_id)?.nickname : undefined}
        />
      </div>

      <Leaderboard players={players} showAll highlightPlayerId={highlightPlayerId} />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Answers by question</h2>
        {loading ? (
          <Card>
            <p className="text-sm text-neutral-500 text-center">Loading answers...</p>
          </Card>
        ) : questions!.length === 0 ? (
          <Card>
            <p className="text-sm text-neutral-500 text-center">No questions in this quiz.</p>
          </Card>
        ) : (
          questions!.map((q) => (
            <QuestionBreakdown
              key={q.id}
              question={q}
              answers={answers!.filter((a) => a.question_id === q.id)}
              playersById={playersById}
              highlightPlayerId={highlightPlayerId}
              totalPoints={totalPoints}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-neutral-500 mt-0.5 truncate">{sub}</p>}
    </Card>
  );
}

function QuestionBreakdown({
  question,
  answers,
  playersById,
  highlightPlayerId,
}: {
  question: Question;
  answers: Answer[];
  playersById: Map<string, Player>;
  highlightPlayerId?: string;
  totalPoints: number;
}) {
  const rows = useMemo(() => {
    const withPlayer = answers.map((a) => ({
      answer: a,
      player: playersById.get(a.player_id),
    }));
    return withPlayer.sort((a, b) => {
      if (b.answer.points_awarded !== a.answer.points_awarded) {
        return b.answer.points_awarded - a.answer.points_awarded;
      }
      return a.answer.time_taken_ms - b.answer.time_taken_ms;
    });
  }, [answers, playersById]);

  const noAnswer = [...playersById.values()].filter(
    (p) => !answers.some((a) => a.player_id === p.id),
  );

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-5 border-b border-neutral-200 dark:border-neutral-800">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          Question {question.question_order + 1} · {formatType(question.question_type)} ·{" "}
          {question.time_limit_seconds}s limit
        </p>
        <p className="mt-1 font-medium">{question.text}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="text-left font-normal px-5 py-2">Player</th>
              <th className="text-left font-normal px-5 py-2">Answer</th>
              <th className="text-right font-normal px-5 py-2">Time</th>
              <th className="text-right font-normal px-5 py-2">Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && noAnswer.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-4 text-center text-neutral-500">
                  No answers recorded
                </td>
              </tr>
            ) : (
              <>
                {rows.map(({ answer, player }) => (
                  <tr
                    key={answer.id}
                    className={
                      player?.id === highlightPlayerId
                        ? "bg-indigo-50 dark:bg-indigo-950/40"
                        : ""
                    }
                  >
                    <td className="px-5 py-2.5 font-medium">
                      {player?.nickname ?? "—"}
                    </td>
                    <td className="px-5 py-2.5">
                      <span
                        className={
                          answer.is_correct
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-neutral-700 dark:text-neutral-300"
                        }
                      >
                        <span className="mr-1.5">{answer.is_correct ? "✓" : "·"}</span>
                        {formatResponse(question, answer.response)}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                      {(answer.time_taken_ms / 1000).toFixed(1)}s
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono tabular-nums">
                      {answer.points_awarded}
                    </td>
                  </tr>
                ))}
                {noAnswer.map((p) => (
                  <tr
                    key={p.id}
                    className={
                      p.id === highlightPlayerId
                        ? "bg-indigo-50 dark:bg-indigo-950/40 text-neutral-500"
                        : "text-neutral-500"
                    }
                  >
                    <td className="px-5 py-2.5 font-medium">{p.nickname}</td>
                    <td className="px-5 py-2.5 italic">No answer</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">—</td>
                    <td className="px-5 py-2.5 text-right font-mono tabular-nums">0</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function formatType(t: Question["question_type"]): string {
  switch (t) {
    case "multiple_choice":
      return "Multiple choice";
    case "true_false":
      return "True / false";
    case "ranking":
      return "Ranking";
    case "word_cloud":
      return "Word cloud";
    case "type_answer":
      return "Type answer";
  }
}

function formatResponse(question: Question, response: AnswerResponse): string {
  if (!response) return "—";
  switch (question.question_type) {
    case "multiple_choice": {
      const idx = (response as { index?: number }).index;
      if (idx == null) return "—";
      const label = question.options?.[idx];
      return label ? `${String.fromCharCode(65 + idx)}. ${label}` : `Option ${idx + 1}`;
    }
    case "true_false": {
      const v = (response as { value?: boolean }).value;
      if (v === true) return "True";
      if (v === false) return "False";
      return "—";
    }
    case "ranking": {
      const order = (response as { order?: number[] }).order;
      if (!Array.isArray(order) || !question.options) return "—";
      return order.map((i) => question.options![i]).filter(Boolean).join(" → ");
    }
    case "word_cloud":
    case "type_answer": {
      const text = (response as { text?: string }).text;
      return text && text.length > 0 ? text : "—";
    }
  }
}
