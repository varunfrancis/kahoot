// Hand-maintained DB types. Regenerate with:
//   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
// until we wire up the CLI.

export type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "ranking"
  | "word_cloud"
  | "type_answer";

export type RoomStatus = "lobby" | "active" | "finished";

export interface Quiz {
  id: string;
  host_id: string;
  title: string;
  created_at: string;
}

export interface Question {
  id: string;
  quiz_id: string;
  question_order: number;
  question_type: QuestionType;
  text: string;
  options: string[] | null;
  correct_answer: CorrectAnswer | null;
  time_limit_seconds: number;
}

export type CorrectAnswer =
  | { index: number }
  | { value: boolean }
  | { accepted: string[]; fuzzy: boolean }
  | Record<string, never>
  | null;

export interface GameRoom {
  id: string;
  quiz_id: string;
  host_id: string;
  code: string;
  status: RoomStatus;
  current_question_index: number;
  current_question_started_at: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  nickname: string;
  score: number;
  joined_at: string;
}

export type AnswerResponse =
  | { index: number }
  | { value: boolean }
  | { order: number[] }
  | { text: string };

export interface Answer {
  id: string;
  player_id: string;
  question_id: string;
  response: AnswerResponse;
  time_taken_ms: number;
  is_correct: boolean;
  points_awarded: number;
  created_at: string;
}

// RPC return types
export interface CreateGameRoomResult {
  room_id: string;
  code: string;
}

export interface JoinRoomResult {
  player_id: string;
  room_id: string;
  code: string;
}

export type CurrentQuestion =
  | {
      status: "lobby" | "finished";
      total_questions: number;
      current_question_index: number;
    }
  | {
      status: "active";
      total_questions: number;
      current_question_index: number;
      id: string;
      question_type: QuestionType;
      text: string;
      options: string[] | null;
      time_limit_seconds: number;
      started_at: string;
    };

export interface SubmitAnswerResult {
  is_correct: boolean;
  points_awarded: number;
  time_taken_ms: number;
}

export interface RoomReveal {
  question_id: string;
  question_type: QuestionType;
  correct_answer: CorrectAnswer;
  options: string[] | null;
}
