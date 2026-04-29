import type { Difficulty, QuizQuestion } from "@/types/quiz";

export type RoomStatus = "lobby" | "active" | "paused" | "ended";

export interface LiveRoom {
  id: string;
  code: string;
  password: string;
  host_token: string;
  host_name: string;
  topic: string;
  difficulty: Difficulty;
  status: RoomStatus;
  current_question_index: number;
  question_started_at: string | null;
  seconds_per_question: number;
  total_questions: number;
  max_participants: number | null;
  reveal_results: boolean;
  created_at: string;
  updated_at: string;
}

/** Full question — only available to the host. */
export interface LiveQuestion {
  id: string;
  room_id: string;
  order_index: number;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

/** Safe shape sent to participants (no correct_answer / explanation). */
export interface LiveQuestionSafe {
  id: string;
  room_id: string;
  order_index: number;
  question: string;
  options: string[];
}

export interface LiveParticipant {
  id: string;
  room_id: string;
  participant_token: string;
  display_name: string;
  score: number;
  is_kicked: boolean;
  joined_at: string;
  last_seen_at: string;
}

export interface LiveAnswer {
  id: string;
  room_id: string;
  question_id: string;
  participant_id: string;
  question_order_index: number;
  selected_answer: string | null;
  is_correct: boolean;
  time_taken_ms: number;
  points_earned: number;
}

export type DraftQuestion = QuizQuestion;
