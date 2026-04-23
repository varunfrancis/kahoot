"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

export function LaunchButton({ quizId }: { quizId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function launch() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_game_room", { p_quiz_id: quizId });
    if (error || !data) {
      setError(error?.message ?? "Failed to launch");
      setSubmitting(false);
      return;
    }
    const { code } = data as { room_id: string; code: string };
    router.push(`/rooms/${code}/host`);
  }

  return (
    <div className="space-y-2">
      <Button onClick={launch} disabled={submitting} size="xl">
        {submitting ? "Launching..." : "Launch game"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
