"use client";

import type { Player } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";

export function PlayerLobby({ players }: { players: Player[] }) {
  return (
    <div className="space-y-4">
      <Card className="text-center">
        <h2 className="text-xl font-semibold">You&apos;re in</h2>
        <p className="text-sm text-neutral-500 mt-1">Waiting for the host to start...</p>
      </Card>
      <Card>
        <p className="text-xs uppercase tracking-wide text-neutral-500 mb-3">
          {players.length} player{players.length === 1 ? "" : "s"} in the room
        </p>
        <ul className="flex flex-wrap gap-2">
          {players.map((p) => (
            <li
              key={p.id}
              className="rounded-md bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 text-sm font-medium"
            >
              {p.nickname}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
