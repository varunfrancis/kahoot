"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { loadPlayerSession, type PlayerSession } from "@/lib/session";
import type { CurrentQuestion, GameRoom, Player } from "@/lib/supabase/types";
import { PlayerLobby } from "./player-lobby";
import { PlayerAnswer } from "./player-answer";
import { PlayerLocked } from "./player-locked";
import { FinalResultsDashboard } from "@/components/final-results-dashboard";

export function PlayerRoom({ code }: { code: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestion | null>(null);
  const [quizTitle, setQuizTitle] = useState<string>("");
  const [submittedQuestionId, setSubmittedQuestionId] = useState<string | null>(null);
  const [answeredPlayerIds, setAnsweredPlayerIds] = useState<Set<string>>(() => new Set());
  const [, setTick] = useState(0);
  // Count only players that are currently in this room — answers.question_id
  // is shared across rooms that play the same quiz, so we filter client-side.
  const answersCount = useMemo(
    () => players.reduce((n, p) => n + (answeredPlayerIds.has(p.id) ? 1 : 0), 0),
    [players, answeredPlayerIds],
  );

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
  }, [supabase, session, code]);

  // Load quiz title once we know the quiz_id (for the final results header).
  useEffect(() => {
    if (!room?.quiz_id) return;
    let active = true;
    supabase
      .from("quizzes")
      .select("title")
      .eq("id", room.quiz_id)
      .single()
      .then(({ data }) => {
        if (active && data) setQuizTitle(data.title as string);
      });
    return () => {
      active = false;
    };
  }, [supabase, room?.quiz_id]);

  // Load current question whenever the host moves forward
  useEffect(() => {
    if (!room) return;
    if (room.status !== "active") {
      setCurrentQuestion(null);
      return;
    }
    supabase
      .rpc("get_current_question", { p_code: code })
      .then(({ data }) => setCurrentQuestion((data ?? null) as CurrentQuestion | null));
    setAnsweredPlayerIds(new Set());
  }, [supabase, code, room?.status, room?.current_question_index]);

  // Count answers for the current question (drives "all answered" for UI)
  const questionId =
    currentQuestion && currentQuestion.status === "active" ? currentQuestion.id : null;

  useEffect(() => {
    if (!questionId) return;
    let active = true;
    const channel = supabase
      .channel(`answers-count-${questionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answers", filter: `question_id=eq.${questionId}` },
        (payload) => {
          const pid = (payload.new as { player_id: string }).player_id;
          setAnsweredPlayerIds((prev) => {
            if (prev.has(pid)) return prev;
            const next = new Set(prev);
            next.add(pid);
            return next;
          });
        },
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" || !active) return;
        supabase
          .from("answers")
          .select("player_id")
          .eq("question_id", questionId)
          .then(({ data }) => {
            if (!active || !data) return;
            setAnsweredPlayerIds((prev) => {
              const next = new Set(prev);
              for (const row of data as { player_id: string }[]) next.add(row.player_id);
              return next;
            });
          });
      });
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, questionId]);

  // Tick so timer-derived UI re-renders
  useEffect(() => {
    if (!questionId) return;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [questionId]);

  // On entering a new question, check if I already have an answer on file
  // (covers reconnects / refreshes).
  useEffect(() => {
    if (!questionId || !session) return;
    let cancelled = false;
    supabase
      .from("answers")
      .select("id")
      .eq("player_id", session.playerId)
      .eq("question_id", questionId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setSubmittedQuestionId(questionId);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, questionId, session]);

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
  const submitted = submittedQuestionId === activeQuestion?.id;
  const timeUp =
    activeQuestion && activeQuestion.started_at
      ? Date.now() - new Date(activeQuestion.started_at).getTime() >=
        activeQuestion.time_limit_seconds * 1000
      : false;

  return (
    <div
      className={`min-h-screen p-6 mx-auto ${
        room.status === "finished" ? "max-w-4xl" : "max-w-md"
      }`}
    >
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
        submitted || timeUp ? (
          <PlayerLocked
            variant={submitted ? "submitted" : "timeout"}
            startedAt={activeQuestion.started_at}
            timeLimitSeconds={activeQuestion.time_limit_seconds}
            answered={answersCount}
            total={players.length}
          />
        ) : (
          <PlayerAnswer
            session={session}
            question={activeQuestion}
            onSubmitted={() => setSubmittedQuestionId(activeQuestion.id)}
          />
        )
      )}

      {room.status === "finished" && (
        <FinalResultsDashboard
          roomId={room.id}
          quizId={room.quiz_id}
          quizTitle={quizTitle}
          players={players}
          highlightPlayerId={session.playerId}
        />
      )}
    </div>
  );
}
