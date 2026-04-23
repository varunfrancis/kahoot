"use client";

import { useEffect, useState } from "react";

export function Timer({
  startedAt,
  timeLimitSeconds,
}: {
  startedAt: string | null;
  timeLimitSeconds: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  if (!startedAt) {
    return <span className="font-mono text-sm text-neutral-500">—</span>;
  }

  const elapsedMs = Math.max(0, now - new Date(startedAt).getTime());
  const totalMs = timeLimitSeconds * 1000;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const seconds = Math.ceil(remainingMs / 1000);
  const ratio = totalMs > 0 ? remainingMs / totalMs : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-40 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
        <div
          className="h-full bg-indigo-500 transition-[width] duration-200"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span className="font-mono tabular-nums text-sm">{seconds}s</span>
    </div>
  );
}
