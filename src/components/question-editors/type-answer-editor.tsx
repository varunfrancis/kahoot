"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Question } from "@/lib/supabase/types";

export function TypeAnswerEditor({
  question,
  onChange,
}: {
  question: Question;
  onChange: (q: Question) => void;
}) {
  const ca =
    question.correct_answer && "accepted" in question.correct_answer
      ? question.correct_answer
      : { accepted: [""], fuzzy: true };
  const accepted = ca.accepted;
  const fuzzy = ca.fuzzy;

  function updateAccepted(next: string[]) {
    onChange({ ...question, correct_answer: { accepted: next, fuzzy } });
  }
  function updateFuzzy(next: boolean) {
    onChange({ ...question, correct_answer: { accepted, fuzzy: next } });
  }

  return (
    <div className="space-y-3">
      <Label>Accepted answers (any match scores points)</Label>
      <div className="space-y-2">
        {accepted.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={a}
              onChange={(e) => {
                const next = [...accepted];
                next[i] = e.target.value;
                updateAccepted(next);
              }}
              placeholder="Answer"
            />
            {accepted.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateAccepted(accepted.filter((_, idx) => idx !== i))}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => updateAccepted([...accepted, ""])}
      >
        Add another accepted answer
      </Button>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={fuzzy}
          onChange={(e) => updateFuzzy(e.target.checked)}
          className="h-4 w-4"
        />
        Allow typo tolerance (Levenshtein ≤ 1–2)
      </label>
    </div>
  );
}
