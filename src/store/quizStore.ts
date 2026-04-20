import { create } from "zustand";
import type { AnsweredQuestion, Difficulty, QuizQuestion } from "@/types/quiz";

interface QuizState {
  topic: string;
  difficulty: Difficulty;
  numQuestions: number;
  questions: QuizQuestion[];
  answered: AnsweredQuestion[];
  startedAt: number | null;
  setSetup: (topic: string, difficulty: Difficulty, numQuestions: number) => void;
  setQuestions: (qs: QuizQuestion[]) => void;
  recordAnswer: (a: AnsweredQuestion) => void;
  reset: () => void;
}

export const useQuizStore = create<QuizState>((set) => ({
  topic: "",
  difficulty: "medium",
  numQuestions: 10,
  questions: [],
  answered: [],
  startedAt: null,
  setSetup: (topic, difficulty, numQuestions) => set({ topic, difficulty, numQuestions }),
  setQuestions: (questions) => set({ questions, answered: [], startedAt: Date.now() }),
  recordAnswer: (a) => set((s) => ({ answered: [...s.answered, a] })),
  reset: () => set({ questions: [], answered: [], startedAt: null }),
}));
