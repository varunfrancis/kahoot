"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { savePlayerSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export function JoinGameForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("join_room", {
      p_code: code.toUpperCase(),
      p_nickname: nickname,
    });
    if (error || !data) {
      setError(error?.message ?? "Failed to join");
      setSubmitting(false);
      return;
    }
    const result = data as { player_id: string; room_id: string; code: string };
    savePlayerSession(result.code, {
      playerId: result.player_id,
      nickname: nickname.trim(),
      roomId: result.room_id,
    });
    router.push(`/play/${result.code}`);
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">Game code</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            required
            placeholder="ABC123"
            className="uppercase tracking-widest text-center text-lg"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nickname">Nickname</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            required
            placeholder="Your name"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Joining..." : "Join game"}
        </Button>
      </form>
    </Card>
  );
}
