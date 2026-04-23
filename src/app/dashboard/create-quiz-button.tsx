"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

export function CreateQuizButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function create() {
    startTransition(async () => {
      setError(null);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in");
        return;
      }
      const { data, error } = await supabase
        .from("quizzes")
        .insert({ host_id: user.id, title: "Untitled quiz" })
        .select("id")
        .single();
      if (error || !data) {
        setError(error?.message ?? "Failed to create");
        return;
      }
      router.push(`/quizzes/${data.id}/edit`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={create} disabled={isPending}>
        {isPending ? "Creating..." : "New quiz"}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
