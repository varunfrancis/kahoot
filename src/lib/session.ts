// Player identity persistence keyed by room code, stored in sessionStorage.

const KEY_PREFIX = "quiz_player_";

export interface PlayerSession {
  playerId: string;
  nickname: string;
  roomId: string;
}

export function savePlayerSession(code: string, session: PlayerSession) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY_PREFIX + code.toUpperCase(), JSON.stringify(session));
}

export function loadPlayerSession(code: string): PlayerSession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY_PREFIX + code.toUpperCase());
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}

export function clearPlayerSession(code: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY_PREFIX + code.toUpperCase());
}
