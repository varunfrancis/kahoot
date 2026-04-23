"use client";

import type { Question } from "@/lib/supabase/types";

export function WordCloudEditor({ question }: { question: Question; onChange: (q: Question) => void }) {
  void question;
  return (
    <div className="rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 p-4 text-sm text-neutral-500">
      Players will submit a short word or phrase (max 20 chars). Every submission
      scores a flat 200 points — there is no correct answer to configure.
    </div>
  );
}
