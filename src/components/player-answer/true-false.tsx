"use client";

export function TrueFalsePlayer({
  onSubmit,
  disabled,
}: {
  onSubmit: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSubmit(true)}
        className="h-28 rounded-md bg-green-500 hover:bg-green-600 text-white text-2xl font-bold disabled:opacity-50 disabled:pointer-events-none"
      >
        True
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSubmit(false)}
        className="h-28 rounded-md bg-red-500 hover:bg-red-600 text-white text-2xl font-bold disabled:opacity-50 disabled:pointer-events-none"
      >
        False
      </button>
    </div>
  );
}
