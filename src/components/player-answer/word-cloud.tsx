"use client";

import { useState } from "react";
import { Filter } from "bad-words";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const filter = new Filter();

export function WordCloudPlayer({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handle(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    if (filter.isProfane(trimmed)) {
      setError("Please keep it clean.");
      return;
    }
    setError(null);
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handle} className="space-y-3">
      <p className="text-xs text-neutral-500">
        One word or short phrase. Max 20 characters.
      </p>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 20))}
        placeholder="Your word"
        autoFocus
        maxLength={20}
        disabled={disabled}
        className="h-14 text-lg text-center"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={disabled || !text.trim()}>
        Submit
      </Button>
    </form>
  );
}
