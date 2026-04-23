"use client";

import { Card } from "@/components/ui/card";
import { Timer } from "@/components/timer";

export function PlayerLocked({
  variant,
  startedAt,
  timeLimitSeconds,
  answered,
  total,
}: {
  variant: "submitted" | "timeout";
  startedAt: string;
  timeLimitSeconds: number;
  answered: number;
  total: number;
}) {
  return (
    <div className="space-y-4">
      <Timer startedAt={startedAt} timeLimitSeconds={timeLimitSeconds} />
      <Card className="text-center py-10">
        <p className="text-xl font-semibold">
          {variant === "submitted" ? "Answer locked in" : "Time\u2019s up"}
        </p>
        <p className="text-sm text-neutral-500 mt-2">
          {answered} of {total} answered
        </p>
        <p className="text-sm text-neutral-500 mt-1">
          Waiting for the host to move on{variant === "timeout" ? "" : ""}
        </p>
      </Card>
    </div>
  );
}
