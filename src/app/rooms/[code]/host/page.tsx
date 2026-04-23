import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HostRoom } from "./host-room";
import type { GameRoom, Question, Quiz } from "@/lib/supabase/types";

export default async function HostRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: room } = await supabase
    .from("game_rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();
  if (!room) notFound();
  if ((room as GameRoom).host_id !== user.id) redirect("/dashboard");

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", (room as GameRoom).quiz_id)
    .single();

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("quiz_id", (room as GameRoom).quiz_id)
    .order("question_order", { ascending: true });

  return (
    <HostRoom
      initialRoom={room as GameRoom}
      quiz={quiz as Quiz}
      questions={(questions ?? []) as Question[]}
    />
  );
}
