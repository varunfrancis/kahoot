"use client";

import { Card } from "@/components/ui/card";
import type { Answer, Question } from "@/lib/supabase/types";

export function RevealPanel({
  question,
  answers,
}: {
  question: Question;
  answers: Answer[];
}) {
  const correctCount = answers.filter((a) => a.is_correct).length;
  const totalCount = answers.length;

  return (
    <Card>
      <h3 className="font-semibold mb-3">{question.text}</h3>
      {question.question_type === "multiple_choice" && (
        <MCReveal question={question} answers={answers} />
      )}
      {question.question_type === "true_false" && (
        <TFReveal question={question} answers={answers} />
      )}
      {question.question_type === "ranking" && (
        <RankingReveal question={question} answers={answers} />
      )}
      {question.question_type === "type_answer" && (
        <TypeAnswerReveal question={question} answers={answers} />
      )}
      {question.question_type === "word_cloud" && (
        <p className="text-sm text-neutral-500">
          {answers.length} submission{answers.length === 1 ? "" : "s"} — every participant scored 200
          points.
        </p>
      )}
      {question.question_type !== "word_cloud" && (
        <p className="mt-3 text-sm text-neutral-500">
          {correctCount} of {totalCount} correct
        </p>
      )}
    </Card>
  );
}

function MCReveal({ question, answers }: { question: Question; answers: Answer[] }) {
  const correctIdx =
    question.correct_answer && "index" in question.correct_answer
      ? question.correct_answer.index
      : -1;
  const options = question.options ?? [];
  const counts = new Array(options.length).fill(0);
  for (const a of answers) {
    if ("index" in a.response) counts[a.response.index] += 1;
  }
  const maxCount = Math.max(1, ...counts);
  return (
    <ul className="space-y-2">
      {options.map((opt, i) => (
        <li
          key={i}
          className={`flex items-center justify-between rounded-md px-3 py-2 ${
            i === correctIdx
              ? "bg-green-100 dark:bg-green-900/30 border border-green-500"
              : "bg-neutral-100 dark:bg-neutral-800"
          }`}
        >
          <span className="font-medium">{opt}</span>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-24 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
              <div
                className={i === correctIdx ? "h-full bg-green-500" : "h-full bg-neutral-400"}
                style={{ width: `${(counts[i] / maxCount) * 100}%` }}
              />
            </div>
            <span className="font-mono tabular-nums text-sm text-neutral-500 w-8 text-right">
              {counts[i]}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TFReveal({ question, answers }: { question: Question; answers: Answer[] }) {
  const correctValue =
    question.correct_answer && "value" in question.correct_answer
      ? question.correct_answer.value
      : null;
  const trueCount = answers.filter((a) => "value" in a.response && a.response.value).length;
  const falseCount = answers.filter((a) => "value" in a.response && !a.response.value).length;
  return (
    <ul className="grid grid-cols-2 gap-2">
      {[
        { value: true, label: "True", count: trueCount },
        { value: false, label: "False", count: falseCount },
      ].map((opt) => (
        <li
          key={opt.label}
          className={`rounded-md px-3 py-2 flex items-center justify-between ${
            correctValue === opt.value
              ? "bg-green-100 dark:bg-green-900/30 border border-green-500"
              : "bg-neutral-100 dark:bg-neutral-800"
          }`}
        >
          <span className="font-medium">{opt.label}</span>
          <span className="font-mono">{opt.count}</span>
        </li>
      ))}
    </ul>
  );
}

function RankingReveal({ question, answers }: { question: Question; answers: Answer[] }) {
  void answers;
  const options = question.options ?? [];
  return (
    <ol className="space-y-2">
      {options.map((opt, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-md bg-green-100 dark:bg-green-900/30 px-3 py-2"
        >
          <span className="font-mono text-sm text-green-700 dark:text-green-300 w-6">{i + 1}.</span>
          <span className="font-medium">{opt}</span>
        </li>
      ))}
    </ol>
  );
}

function TypeAnswerReveal({ question, answers }: { question: Question; answers: Answer[] }) {
  const accepted =
    question.correct_answer && "accepted" in question.correct_answer
      ? question.correct_answer.accepted
      : [];
  const correctCount = answers.filter((a) => a.is_correct).length;
  const allSubmitted = answers
    .map((a) => ("text" in a.response ? a.response.text : null))
    .filter((t): t is string => !!t);
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Accepted</p>
        <div className="flex flex-wrap gap-2">
          {accepted.map((a) => (
            <span
              key={a}
              className="rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm px-3 py-1"
            >
              {a}
            </span>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
          Submissions ({correctCount} correct)
        </p>
        <div className="flex flex-wrap gap-2">
          {allSubmitted.map((t, i) => (
            <span key={i} className="rounded-md bg-neutral-100 dark:bg-neutral-800 text-sm px-2 py-1">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
