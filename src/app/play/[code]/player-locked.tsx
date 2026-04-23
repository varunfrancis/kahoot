"use client";

import { Card } from "@/components/ui/card";
import { Timer } from "@/components/timer";

export function PlayerLocked({
  startedAt,
  timeLimitSeconds,
  answered,
  total,
}: {
  startedAt: string;
  timeLimitSeconds: number;
  answered: number;
  total: number;
}) {
  return (
    <div className="space-y-4">
      <Timer startedAt={startedAt} timeLimitSeconds={timeLimitSeconds} />
      <Card className="text-center py-10">
        <p className="text-xl font-semibold">Answer locked in</p>
        <p className="text-sm text-neutral-500 mt-2">
          {answered} of {total} answered
        </p>
      </Card>
    </div>
  );
}
