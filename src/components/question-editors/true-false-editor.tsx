"use client";

import { Label } from "@/components/ui/label";
import type { Question } from "@/lib/supabase/types";

export function TrueFalseEditor({
  question,
  onChange,
}: {
  question: Question;
  onChange: (q: Question) => void;
}) {
  const correct =
    question.correct_answer && "value" in question.correct_answer
      ? question.correct_answer.value
      : true;

  function setCorrect(value: boolean) {
    onChange({ ...question, options: ["True", "False"], correct_answer: { value } });
  }

  return (
    <div className="space-y-2">
      <Label>Correct answer</Label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setCorrect(true)}
          className={`flex-1 h-10 rounded-md border text-sm font-medium ${
            correct === true
              ? "bg-green-600 border-green-600 text-white"
              : "border-neutral-300 dark:border-neutral-700"
          }`}
        >
          True
        </button>
        <button
          type="button"
          onClick={() => setCorrect(false)}
          className={`flex-1 h-10 rounded-md border text-sm font-medium ${
            correct === false
              ? "bg-red-600 border-red-600 text-white"
              : "border-neutral-300 dark:border-neutral-700"
          }`}
        >
          False
        </button>
      </div>
    </div>
  );
}
