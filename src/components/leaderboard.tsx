"use client";

import type { Player } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";

export function Leaderboard({
  players,
  showAll = false,
  highlightPlayerId,
}: {
  players: Player[];
  showAll?: boolean;
  highlightPlayerId?: string;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const shown = showAll ? sorted : sorted.slice(0, 5);
  return (
    <Card>
      {shown.length === 0 ? (
        <p className="text-sm text-neutral-500 text-center">No players yet</p>
      ) : (
        <ol className="space-y-2">
          {shown.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded-md px-3 py-2 ${
                p.id === highlightPlayerId
                  ? "bg-indigo-100 dark:bg-indigo-900/40"
                  : i === 0
                    ? "bg-amber-100 dark:bg-amber-900/30"
                    : "bg-neutral-100 dark:bg-neutral-800"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-neutral-500 w-6">{i + 1}.</span>
                <span className="font-medium">{p.nickname}</span>
              </div>
              <span className="font-mono tabular-nums">{p.score}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
