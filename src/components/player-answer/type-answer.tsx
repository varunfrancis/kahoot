"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function TypeAnswerPlayer({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() || disabled) return;
        onSubmit(text);
      }}
      className="space-y-3"
    >
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your answer"
        autoFocus
        maxLength={120}
        disabled={disabled}
        className="h-14 text-lg"
      />
      <Button type="submit" size="lg" className="w-full" disabled={disabled || !text.trim()}>
        Submit
      </Button>
    </form>
  );
}
