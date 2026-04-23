"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Question } from "@/lib/supabase/types";
import { MultipleChoiceEditor } from "./multiple-choice-editor";
import { TrueFalseEditor } from "./true-false-editor";
import { RankingEditor } from "./ranking-editor";
import { TypeAnswerEditor } from "./type-answer-editor";
import { WordCloudEditor } from "./word-cloud-editor";

export function QuestionEditor({
  index,
  question,
  onChange,
  onDelete,
}: {
  index: number;
  question: Question;
  onChange: (q: Question) => void;
  onDelete: () => void;
}) {
  function setText(text: string) {
    onChange({ ...question, text });
  }
  function setTimeLimit(seconds: number) {
    onChange({ ...question, time_limit_seconds: seconds });
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-neutral-500">Q{index + 1}</span>
          <TypeBadge type={question.question_type} />
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`q-${question.id}-text`}>Question</Label>
          <Input
            id={`q-${question.id}-text`}
            value={question.text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's your question?"
          />
        </div>

        {question.question_type === "multiple_choice" && (
          <MultipleChoiceEditor question={question} onChange={onChange} />
        )}
        {question.question_type === "true_false" && (
          <TrueFalseEditor question={question} onChange={onChange} />
        )}
        {question.question_type === "ranking" && (
          <RankingEditor question={question} onChange={onChange} />
        )}
        {question.question_type === "type_answer" && (
          <TypeAnswerEditor question={question} onChange={onChange} />
        )}
        {question.question_type === "word_cloud" && (
          <WordCloudEditor question={question} onChange={onChange} />
        )}

        <div className="space-y-2 max-w-xs">
          <Label htmlFor={`q-${question.id}-time`}>Time limit (seconds)</Label>
          <Input
            id={`q-${question.id}-time`}
            type="number"
            min={5}
            max={120}
            value={question.time_limit_seconds}
            onChange={(e) => setTimeLimit(Math.max(5, Number(e.target.value) || 20))}
          />
        </div>
      </div>
    </Card>
  );
}

function TypeBadge({ type }: { type: Question["question_type"] }) {
  const label = {
    multiple_choice: "Multiple choice",
    true_false: "True / False",
    ranking: "Ranking",
    word_cloud: "Word cloud",
    type_answer: "Type answer",
  }[type];
  return (
    <span className="text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5">
      {label}
    </span>
  );
}
