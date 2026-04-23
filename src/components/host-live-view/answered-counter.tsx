export function AnsweredCounter({ answered, total }: { answered: number; total: number }) {
  return (
    <span className="text-sm font-medium tabular-nums">
      {answered} / {total} answered
    </span>
  );
}
