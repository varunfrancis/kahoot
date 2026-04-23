"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { GameRoom, Player, Question, Quiz } from "@/lib/supabase/types";
import { Leaderboard } from "@/components/leaderboard";
import { HostQuestionView } from "@/components/host-live-view/host-question-view";

export function HostRoom({
  initialRoom,
  quiz,
  questions,
}: {
  initialRoom: GameRoom;
  quiz: Quiz;
  questions: Question[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [room, setRoom] = useState<GameRoom>(initialRoom);
  const [players, setPlayers] = useState<Player[]>([]);
  const [advancing, setAdvancing] = useState(false);

  // Subscribe to room updates
  useEffect(() => {
    const channel = supabase
      .channel(`room-${room.id}-host`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${room.id}` },
        (payload) => setRoom(payload.new as GameRoom),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, room.id]);

  // Load + subscribe to players (subscribe first, then fetch, so we never miss
  // a join event between the initial fetch and realtime going live).
  useEffect(() => {
    let active = true;
    const channel = supabase
      .channel(`room-${room.id}-players-host`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Player;
            setPlayers((prev) => (prev.some((p) => p.id === row.id) ? prev : [...prev, row]));
          } else if (payload.eventType === "UPDATE") {
            setPlayers((prev) =>
              prev.map((p) => (p.id === (payload.new as Player).id ? (payload.new as Player) : p)),
            );
          } else if (payload.eventType === "DELETE") {
            setPlayers((prev) => prev.filter((p) => p.id !== (payload.old as Player).id));
          }
        },
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" || !active) return;
        supabase
          .from("players")
          .select("*")
          .eq("room_id", room.id)
          .order("joined_at", { ascending: true })
          .then(({ data }) => {
            if (!active || !data) return;
            setPlayers((prev) => {
              const byId = new Map(prev.map((p) => [p.id, p]));
              for (const row of data as Player[]) byId.set(row.id, row);
              return Array.from(byId.values()).sort(
                (a, b) => +new Date(a.joined_at) - +new Date(b.joined_at),
              );
            });
          });
      });
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, room.id]);

  async function advance() {
    setAdvancing(true);
    await supabase.rpc("advance_question", { p_room_id: room.id });
    setAdvancing(false);
  }

  const currentQuestion =
    room.status === "active" && room.current_question_index >= 0
      ? questions[room.current_question_index]
      : null;

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      {room.status === "lobby" && (
        <Lobby
          room={room}
          quiz={quiz}
          players={players}
          onStart={advance}
          advancing={advancing}
          hasQuestions={questions.length > 0}
        />
      )}
      {room.status === "active" && currentQuestion && (
        <HostQuestionView
          room={room}
          question={currentQuestion}
          totalQuestions={questions.length}
          players={players}
          onNext={advance}
          advancing={advancing}
        />
      )}
      {room.status === "finished" && (
        <FinalLeaderboard quiz={quiz} players={players} />
      )}
    </div>
  );
}

function Lobby({
  room,
  quiz,
  players,
  onStart,
  advancing,
  hasQuestions,
}: {
  room: GameRoom;
  quiz: Quiz;
  players: Player[];
  onStart: () => void;
  advancing: boolean;
  hasQuestions: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-neutral-500">{quiz.title}</p>
        <h1 className="mt-4 text-sm uppercase tracking-wider text-neutral-500">Game code</h1>
        <p className="text-7xl font-bold tracking-widest font-mono mt-2">{room.code}</p>
        <p className="text-sm text-neutral-500 mt-2">
          Join at <span className="font-medium">/</span> with this code
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">
            {players.length} player{players.length === 1 ? "" : "s"} joined
          </h2>
          <Button onClick={onStart} disabled={advancing || !hasQuestions || players.length === 0}>
            {advancing ? "Starting..." : "Start game"}
          </Button>
        </div>
        {players.length === 0 ? (
          <p className="text-sm text-neutral-500">Waiting for players to join...</p>
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {players.map((p) => (
              <li
                key={p.id}
                className="rounded-md bg-indigo-50 dark:bg-indigo-950/50 px-3 py-2 text-sm font-medium"
              >
                {p.nickname}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function FinalLeaderboard({ quiz, players }: { quiz: Quiz; players: Player[] }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-neutral-500">{quiz.title}</p>
        <h1 className="text-3xl font-bold mt-2">Final results</h1>
      </div>
      <Leaderboard players={players} showAll />
    </div>
  );
}
