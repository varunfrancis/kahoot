"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Question } from "@/lib/supabase/types";

export function RankingEditor({
  question,
  onChange,
}: {
  question: Question;
  onChange: (q: Question) => void;
}) {
  const options = question.options ?? ["", "", "", ""];

  function updateOption(i: number, value: string) {
    const next = [...options];
    next[i] = value;
    onChange({ ...question, options: next });
  }

  return (
    <div className="space-y-2">
      <Label>Items in the correct order</Label>
      <p className="text-xs text-neutral-500">
        Enter items in the correct order. Players will see them shuffled and drag-rank them.
      </p>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 text-center text-sm font-medium text-neutral-500">{i + 1}.</span>
            <Input
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Item ${i + 1}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
