"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Timer } from "@/components/timer";
import { Leaderboard } from "@/components/leaderboard";
import { AnsweredCounter } from "./answered-counter";
import { TypeAnswerTally } from "./type-answer-tally";
import { LiveWordCloud } from "./live-word-cloud";
import { RevealPanel } from "./reveal-panel";
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
  const [showReveal, setShowReveal] = useState(false);

  // Reset when question changes
  useEffect(() => {
    setAnswers([]);
    setShowReveal(false);
  }, [question.id]);

  // Subscribe first, then fetch — avoids missing INSERTs fired between
  // initial fetch and the subscription becoming live.
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

  // Auto-advance: all answered OR timer expired
  const allAnswered = players.length > 0 && answers.length >= players.length;
  const timeUp = room.current_question_started_at
    ? Date.now() - new Date(room.current_question_started_at).getTime() >=
      question.time_limit_seconds * 1000
    : false;

  useEffect(() => {
    if ((allAnswered || timeUp) && !showReveal) {
      setShowReveal(true);
    }
  }, [allAnswered, timeUp, showReveal]);

  // When we enter reveal, finalize scoring against Aayushi's submission, then
  // refetch answers so the reveal panel and leaderboard reflect the updates.
  useEffect(() => {
    if (!showReveal) return;
    let cancelled = false;
    (async () => {
      await supabase.rpc("finalize_question", {
        p_room_id: room.id,
        p_question_id: question.id,
      });
      if (cancelled) return;
      const { data } = await supabase
        .from("answers")
        .select("*")
        .eq("question_id", question.id);
      if (!cancelled && data) setAnswers(data as Answer[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [showReveal, supabase, room.id, question.id]);

  if (showReveal) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            Question {question.question_order + 1} of {totalQuestions}
          </p>
          <Button onClick={onNext} disabled={advancing}>
            {advancing
              ? "..."
              : question.question_order + 1 >= totalQuestions
                ? "Show final results"
                : "Next question"}
          </Button>
        </div>
        <RevealPanel question={question} answers={answers} />
        <div>
          <h3 className="font-semibold mb-2">Top 5</h3>
          <Leaderboard players={players} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Question {question.question_order + 1} of {totalQuestions}
        </p>
        <Button variant="outline" onClick={() => setShowReveal(true)}>
          Reveal now
        </Button>
      </div>
      <Card>
        <h2 className="text-2xl font-semibold">{question.text}</h2>
      </Card>
      <div className="flex items-center justify-between">
        <Timer startedAt={room.current_question_started_at} timeLimitSeconds={question.time_limit_seconds} />
        <AnsweredCounter answered={answers.length} total={players.length} />
      </div>
      {question.question_type === "word_cloud" && (
        <LiveWordCloud answers={answers} />
      )}
      {question.question_type === "type_answer" && (
        <TypeAnswerTally answers={answers} />
      )}
      {(question.question_type === "multiple_choice" ||
        question.question_type === "true_false" ||
        question.question_type === "ranking") && (
        <Card className="text-center text-sm text-neutral-500">
          Waiting for players to answer...
        </Card>
      )}
    </div>
  );
}
