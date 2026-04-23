"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Question } from "@/lib/supabase/types";

export function MultipleChoiceEditor({
  question,
  onChange,
}: {
  question: Question;
  onChange: (q: Question) => void;
}) {
  const options = question.options ?? ["", "", "", ""];
  const correctIndex =
    (question.correct_answer && "index" in question.correct_answer
      ? question.correct_answer.index
      : 0) ?? 0;

  function updateOption(i: number, value: string) {
    const next = [...options];
    next[i] = value;
    onChange({ ...question, options: next });
  }

  function setCorrect(i: number) {
    onChange({ ...question, correct_answer: { index: i } });
  }

  return (
    <div className="space-y-2">
      <Label>Options (tick the correct one)</Label>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name={`correct-${question.id}`}
              checked={correctIndex === i}
              onChange={() => setCorrect(i)}
              className="h-4 w-4"
            />
            <Input
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
