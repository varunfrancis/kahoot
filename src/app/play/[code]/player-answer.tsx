"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { AnswerResponse, CurrentQuestion, SubmitAnswerResult } from "@/lib/supabase/types";
import type { PlayerSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Timer } from "@/components/timer";
import { MultipleChoicePlayer } from "@/components/player-answer/multiple-choice";
import { TrueFalsePlayer } from "@/components/player-answer/true-false";
import { RankingPlayer } from "@/components/player-answer/ranking";
import { TypeAnswerPlayer } from "@/components/player-answer/type-answer";
import { WordCloudPlayer } from "@/components/player-answer/word-cloud";

type ActiveQuestion = Extract<CurrentQuestion, { status: "active" }>;

export function PlayerAnswer({
  session,
  question,
  onSubmitted,
}: {
  session: PlayerSession;
  question: ActiveQuestion;
  onSubmitted: (result: SubmitAnswerResult & { questionId: string }) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSubmitting(false);
    setError(null);
  }, [question.id]);

  async function submit(response: AnswerResponse) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("submit_answer", {
      p_player_id: session.playerId,
      p_question_id: question.id,
      p_response: response,
    });
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }
    onSubmitted({ ...(data as SubmitAnswerResult), questionId: question.id });
  }

  return (
    <div className="space-y-4">
      <Timer startedAt={question.started_at} timeLimitSeconds={question.time_limit_seconds} />
      <Card>
        <p className="text-lg font-semibold">{question.text}</p>
      </Card>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {question.question_type === "multiple_choice" && (
        <MultipleChoicePlayer
          options={question.options ?? []}
          onSubmit={(index) => submit({ index })}
          disabled={submitting}
        />
      )}
      {question.question_type === "true_false" && (
        <TrueFalsePlayer onSubmit={(value) => submit({ value })} disabled={submitting} />
      )}
      {question.question_type === "ranking" && (
        <RankingPlayer
          options={question.options ?? []}
          seed={`${session.playerId}:${question.id}`}
          onSubmit={(order) => submit({ order })}
          disabled={submitting}
        />
      )}
      {question.question_type === "type_answer" && (
        <TypeAnswerPlayer onSubmit={(text) => submit({ text })} disabled={submitting} />
      )}
      {question.question_type === "word_cloud" && (
        <WordCloudPlayer onSubmit={(text) => submit({ text })} disabled={submitting} />
      )}
    </div>
  );
}
