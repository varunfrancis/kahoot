"use client";

export function MultipleChoicePlayer({
  options,
  onSubmit,
  disabled,
}: {
  options: string[];
  onSubmit: (index: number) => void;
  disabled: boolean;
}) {
  const palette = [
    "bg-red-500 hover:bg-red-600",
    "bg-blue-500 hover:bg-blue-600",
    "bg-amber-500 hover:bg-amber-600",
    "bg-emerald-500 hover:bg-emerald-600",
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {options.map((opt, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          onClick={() => onSubmit(i)}
          className={`h-24 rounded-md text-white text-lg font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none ${palette[i % palette.length]}`}
        >
          {opt || `Option ${i + 1}`}
        </button>
      ))}
    </div>
  );
}
