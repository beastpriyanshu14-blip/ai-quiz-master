import type { QuizResult, UserProfile } from "@/types/quiz";

const USER_KEY = "quizmaster_user";
const HISTORY_KEY = "quizmaster_history";

export const storage = {
  getUser(): UserProfile | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
      return null;
    }
  },
  setUser(user: UserProfile) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clearUser() {
    localStorage.removeItem(USER_KEY);
  },
  getHistory(): QuizResult[] {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as QuizResult[]) : [];
    } catch {
      return [];
    }
  },
  addResult(result: QuizResult) {
    const history = storage.getHistory();
    history.unshift(result);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 200)));
  },
  clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  },
};

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function getGrade(score: number): {
  emoji: string;
  label: string;
  color: string;
} {
  if (score >= 90) return { emoji: "🏆", label: "Outstanding! You're a master!", color: "text-warning" };
  if (score >= 70) return { emoji: "🌟", label: "Excellent! Great knowledge!", color: "text-primary" };
  if (score >= 50) return { emoji: "👍", label: "Good effort! Keep learning!", color: "text-primary-glow" };
  if (score >= 30) return { emoji: "📚", label: "Needs practice. Don't give up!", color: "text-warning" };
  return { emoji: "💪", label: "Keep studying! You'll get there!", color: "text-destructive" };
}
