"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { loadPlayerSession, type PlayerSession } from "@/lib/session";
import type {
  CurrentQuestion,
  GameRoom,
  Player,
  SubmitAnswerResult,
} from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { PlayerLobby } from "./player-lobby";
import { PlayerAnswer } from "./player-answer";
import { PlayerLocked } from "./player-locked";
import { PlayerBetween } from "./player-between";
import { Leaderboard } from "@/components/leaderboard";

type LastResult = SubmitAnswerResult & { questionId: string };

export function PlayerRoom({ code }: { code: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestion | null>(null);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [answersCount, setAnswersCount] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const s = loadPlayerSession(code);
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
  }, [code, router]);

  useEffect(() => {
    if (!session) return;
    let active = true;

    supabase
      .from("game_rooms")
      .select("*")
      .eq("code", code)
      .single()
      .then(({ data }) => {
        if (active && data) setRoom(data as GameRoom);
      });

    supabase
      .from("players")
      .select("*")
      .eq("room_id", session.roomId)
      .order("joined_at", { ascending: true })
      .then(({ data }) => {
        if (active) setPlayers((data ?? []) as Player[]);
      });

    const channel = supabase
      .channel(`room-${session.roomId}-player-${session.playerId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${session.roomId}` },
        (payload) => setRoom(payload.new as GameRoom),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${session.roomId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setPlayers((prev) => [...prev, payload.new as Player]);
          } else if (payload.eventType === "UPDATE") {
            setPlayers((prev) =>
              prev.map((p) => (p.id === (payload.new as Player).id ? (payload.new as Player) : p)),
            );
          } else if (payload.eventType === "DELETE") {
            setPlayers((prev) => prev.filter((p) => p.id !== (payload.old as Player).id));
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, session, code]);

  // Load current question when room state changes
  useEffect(() => {
    if (!room) return;
    if (room.status !== "active") {
      setCurrentQuestion(null);
      return;
    }
    supabase
      .rpc("get_current_question", { p_code: code })
      .then(({ data }) => setCurrentQuestion((data ?? null) as CurrentQuestion | null));
    setLastResult(null);
    setAnswersCount(0);
  }, [supabase, code, room?.status, room?.current_question_index, room]);

  // Subscribe to answer count for the current question (drives reveal phase)
  const questionId =
    currentQuestion && currentQuestion.status === "active" ? currentQuestion.id : null;
  useEffect(() => {
    if (!questionId) return;
    let active = true;
    supabase
      .from("answers")
      .select("id", { count: "exact", head: true })
      .eq("question_id", questionId)
      .then(({ count }) => {
        if (active && typeof count === "number") setAnswersCount(count);
      });

    const channel = supabase
      .channel(`answers-count-${questionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answers", filter: `question_id=eq.${questionId}` },
        () => setAnswersCount((n) => n + 1),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, questionId]);

  // Tick to re-evaluate timer-based reveal
  useEffect(() => {
    if (!questionId) return;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [questionId]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-neutral-500">Redirecting...</p>
      </div>
    );
  }
  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-neutral-500">Loading room...</p>
      </div>
    );
  }

  const me = players.find((p) => p.id === session.playerId);

  const activeQuestion = currentQuestion?.status === "active" ? currentQuestion : null;
  const submitted = !!(lastResult && activeQuestion && lastResult.questionId === activeQuestion.id);
  const timeUp =
    activeQuestion && activeQuestion.started_at
      ? Date.now() - new Date(activeQuestion.started_at).getTime() >=
        activeQuestion.time_limit_seconds * 1000
      : false;
  const allAnswered = players.length > 0 && answersCount >= players.length;
  const revealPhase = activeQuestion && (timeUp || allAnswered);
  void tick;

  return (
    <div className="min-h-screen p-6 max-w-md mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">You</p>
          <p className="font-semibold">{session.nickname}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Score</p>
          <p className="font-mono font-semibold tabular-nums">{me?.score ?? 0}</p>
        </div>
      </header>

      {room.status === "lobby" && <PlayerLobby players={players} />}

      {room.status === "active" && activeQuestion && (
        revealPhase ? (
          <PlayerBetween
            result={lastResult ?? { is_correct: false, points_awarded: 0, time_taken_ms: 0 }}
            submitted={submitted}
            players={players}
            highlightPlayerId={session.playerId}
            startedAt={activeQuestion.started_at}
            timeLimitSeconds={activeQuestion.time_limit_seconds}
          />
        ) : submitted ? (
          <PlayerLocked
            startedAt={activeQuestion.started_at}
            timeLimitSeconds={activeQuestion.time_limit_seconds}
            answered={answersCount}
            total={players.length}
          />
        ) : (
          <PlayerAnswer
            session={session}
            question={activeQuestion}
            onSubmitted={setLastResult}
          />
        )
      )}

      {room.status === "finished" && (
        <div className="space-y-4">
          <Card className="text-center">
            <h2 className="text-xl font-semibold">Game over</h2>
            <p className="text-sm text-neutral-500 mt-1">Final score: {me?.score ?? 0}</p>
          </Card>
          <Leaderboard players={players} showAll highlightPlayerId={session.playerId} />
        </div>
      )}
    </div>
  );
}
