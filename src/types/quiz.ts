export type Difficulty = "easy" | "medium" | "hard";

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

export interface AnsweredQuestion extends QuizQuestion {
  userAnswer: string | null; // null = skipped/timed out
  isCorrect: boolean;
  timedOut: boolean;
}

export interface QuizResult {
  id: string;
  topic: string;
  difficulty: Difficulty;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  skipped: number;
  score: number; // percentage
  timeTaken: number; // seconds
  date: string; // ISO
  questions: AnsweredQuestion[];
}

export interface UserProfile {
  name: string;
  email: string;
  joinedDate: string;
}
