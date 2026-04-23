"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Timer } from "@/components/timer";
import { AnsweredCounter } from "./answered-counter";
import { TypeAnswerTally } from "./type-answer-tally";
import { LiveWordCloud } from "./live-word-cloud";
import type { Answer, GameRoom, Player, Question } from "@/lib/supabase/types";

export function HostQuestionView({
  room,
  question,
  totalQuestions,
  players,
  onNext,
  advancing,
}: {
  room: GameRoom;
  question: Question;
  totalQuestions: number;
  players: Player[];
  onNext: () => void;
  advancing: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [, setTick] = useState(0);

  // Reset when question changes
  useEffect(() => {
    setAnswers([]);
  }, [question.id]);

  // Subscribe first, then fetch — avoids missing INSERTs between the initial
  // fetch and subscription going live.
  useEffect(() => {
    let active = true;
    const channel = supabase
      .channel(`answers-${question.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "answers",
          filter: `question_id=eq.${question.id}`,
        },
        (payload) => {
          const row = payload.new as Answer;
          setAnswers((prev) => (prev.some((a) => a.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" || !active) return;
        supabase
          .from("answers")
          .select("*")
          .eq("question_id", question.id)
          .then(({ data }) => {
            if (!active || !data) return;
            setAnswers((prev) => {
              const byId = new Map(prev.map((a) => [a.id, a]));
              for (const row of data as Answer[]) byId.set(row.id, row);
              return Array.from(byId.values());
            });
          });
      });
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, question.id]);

  // Re-render for timer updates
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const allAnswered = players.length > 0 && answers.length >= players.length;
  const timeUp = room.current_question_started_at
    ? Date.now() - new Date(room.current_question_started_at).getTime() >=
      question.time_limit_seconds * 1000
    : false;
  const canAdvance = allAnswered || timeUp;
  const isLast = question.question_order + 1 >= totalQuestions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Question {question.question_order + 1} of {totalQuestions}
        </p>
        <Button onClick={onNext} disabled={advancing || !canAdvance}>
          {advancing
            ? "..."
            : !canAdvance
              ? `Waiting (${answers.length}/${players.length})`
              : isLast
                ? "Show final results"
                : "Next question"}
        </Button>
      </div>
      <Card>
        <h2 className="text-2xl font-semibold">{question.text}</h2>
      </Card>
      <div className="flex items-center justify-between">
        <Timer
          startedAt={room.current_question_started_at}
          timeLimitSeconds={question.time_limit_seconds}
        />
        <AnsweredCounter answered={answers.length} total={players.length} />
      </div>
      {question.question_type === "word_cloud" && <LiveWordCloud answers={answers} />}
      {question.question_type === "type_answer" && <TypeAnswerTally answers={answers} />}
      {(question.question_type === "multiple_choice" ||
        question.question_type === "true_false" ||
        question.question_type === "ranking") && (
        <Card className="text-center text-sm text-neutral-500">
          {canAdvance
            ? "Everyone\u2019s in. Click next when you\u2019re ready."
            : "Waiting for players to answer..."}
        </Card>
      )}
    </div>
  );
}
