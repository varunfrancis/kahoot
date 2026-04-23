"use client";

import type { Player, SubmitAnswerResult } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Leaderboard } from "@/components/leaderboard";

export function PlayerBetween({
  result,
  submitted,
  players,
  highlightPlayerId,
  startedAt,
  timeLimitSeconds,
}: {
  result: SubmitAnswerResult;
  submitted: boolean;
  players: Player[];
  highlightPlayerId: string;
  startedAt: string;
  timeLimitSeconds: number;
}) {
  void startedAt;
  void timeLimitSeconds;
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const rank = sorted.findIndex((p) => p.id === highlightPlayerId) + 1;

  let headline: string;
  let subtone: string;
  if (!submitted) {
    headline = "Time\u2019s up";
    subtone = "bg-neutral-100 dark:bg-neutral-800 border-neutral-300";
  } else if (result.is_correct) {
    headline = "Correct!";
    subtone = "bg-green-50 dark:bg-green-950/30 border-green-500";
  } else {
    headline = "Not quite";
    subtone = "bg-red-50 dark:bg-red-950/30 border-red-500";
  }

  return (
    <div className="space-y-4">
      <Card className={`${subtone} text-center`}>
        <p className="text-2xl font-bold">{headline}</p>
        <p className="text-3xl font-mono font-semibold mt-2 tabular-nums">
          +{result.points_awarded}
        </p>
        {players.length > 0 && (
          <p className="text-sm text-neutral-500 mt-1">
            You&apos;re ranked {rank || "—"} of {players.length}
          </p>
        )}
      </Card>
      <Leaderboard players={players} highlightPlayerId={highlightPlayerId} />
    </div>
  );
}
