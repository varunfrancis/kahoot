"use client";

import { Card } from "@/components/ui/card";
import type { Answer } from "@/lib/supabase/types";

// Simple, dependency-free word cloud. Sizes each unique submission by frequency.
// (Avoids react-wordcloud, which has stale peer deps for React 19.)
export function LiveWordCloud({ answers }: { answers: Answer[] }) {
  const counts = new Map<string, number>();
  for (const a of answers) {
    if ("text" in a.response) {
      const text = a.response.text.trim();
      if (!text) continue;
      counts.set(text, (counts.get(text) ?? 0) + 1);
    }
  }
  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] ?? 1;

  return (
    <Card className="min-h-[240px] flex flex-wrap items-center justify-center gap-3 p-8">
      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">Waiting for submissions...</p>
      ) : (
        entries.map(([word, count]) => {
          const scale = 0.75 + (count / max) * 2.25; // 0.75rem–3rem range
          const hue = (hashStr(word) % 360);
          return (
            <span
              key={word}
              className="font-semibold transition-all"
              style={{ fontSize: `${scale}rem`, color: `hsl(${hue}, 65%, 45%)` }}
            >
              {word}
            </span>
          );
        })
      )}
    </Card>
  );
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
