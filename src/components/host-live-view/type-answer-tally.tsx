"use client";

import { Card } from "@/components/ui/card";
import { normalizeAnswer } from "@/lib/normalize";
import type { Answer } from "@/lib/supabase/types";

export function TypeAnswerTally({ answers }: { answers: Answer[] }) {
  const counts = new Map<string, number>();
  for (const a of answers) {
    if ("text" in a.response) {
      const key = normalizeAnswer(a.response.text);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const rows = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return (
    <Card>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500 text-center">No submissions yet</p>
      ) : (
        <ul className="space-y-1">
          {rows.map(([text, count]) => (
            <li
              key={text}
              className="flex items-center justify-between rounded-md bg-neutral-100 dark:bg-neutral-800 px-3 py-2"
            >
              <span className="font-medium">{text}</span>
              <span className="font-mono tabular-nums text-sm text-neutral-500">×{count}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
