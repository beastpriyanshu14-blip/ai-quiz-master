import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, SkipForward } from "lucide-react";
import { useQuizStore } from "@/store/quizStore";
import { storage, formatTime } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { toast } from "sonner";
import type { AnsweredQuestion, QuizResult } from "@/types/quiz";

const PER_QUESTION_SECONDS = 30;

export default function Quiz() {
  const navigate = useNavigate();
  const { topic, difficulty, questions, answered, recordAnswer, startedAt } = useQuizStore();
  const user = storage.getUser();

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(PER_QUESTION_SECONDS);
  const [globalSeconds, setGlobalSeconds] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const lockRef = useRef(false);

  const total = questions.length;
  const current = questions[idx];

  useEffect(() => {
    if (!user) navigate("/");
    else if (!questions.length) navigate("/setup");
  }, [user, questions.length, navigate]);

  // Global timer
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setGlobalSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  // Per-question countdown
  useEffect(() => {
    setTimeLeft(PER_QUESTION_SECONDS);
    setSelected(null);
    lockRef.current = false;
  }, [idx]);

  useEffect(() => {
    if (transitioning) return;
    if (timeLeft <= 0) {
      handleAdvance(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, transitioning]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (transitioning || !current) return;
      if (["1", "2", "3", "4"].includes(e.key)) {
        const i = parseInt(e.key, 10) - 1;
        if (current.options[i]) setSelected(current.options[i]);
      } else if (e.key === "Enter" && selected) {
        handleAdvance(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, selected, transitioning]);

  const finishQuiz = (allAnswered: AnsweredQuestion[]) => {
    const correct = allAnswered.filter((a) => a.isCorrect).length;
    const skipped = allAnswered.filter((a) => a.userAnswer === null).length;
    const incorrect = allAnswered.length - correct - skipped;
    const score = Math.round((correct / allAnswered.length) * 100);

    const result: QuizResult = {
      id: crypto.randomUUID(),
      topic,
      difficulty,
      totalQuestions: allAnswered.length,
      correctAnswers: correct,
      incorrectAnswers: incorrect,
      skipped,
      score,
      timeTaken: globalSeconds,
      date: new Date().toISOString(),
      questions: allAnswered,
    };
    storage.addResult(result);
    sessionStorage.setItem("quizmaster_last_result_id", result.id);
    navigate("/results");
  };

  const handleAdvance = (timedOut: boolean) => {
    if (lockRef.current || !current) return;
    lockRef.current = true;

    const userAnswer = selected;
    const isCorrect = userAnswer === current.correct_answer;
    const ans: AnsweredQuestion = { ...current, userAnswer, isCorrect, timedOut: timedOut && !userAnswer };

    if (timedOut && !userAnswer) {
      toast.warning("⏰ Time's up! Moving on...");
    }

    recordAnswer(ans);
    const next = [...answered, ans];

    setTransitioning(true);
    setTimeout(() => {
      if (idx + 1 >= total) {
        finishQuiz(next);
      } else {
        setIdx((i) => i + 1);
        setTransitioning(false);
      }
    }, timedOut && !userAnswer ? 1500 : 350);
  };

  const handleSkip = () => {
    setSelected(null);
    handleAdvance(true);
  };

  const ringColor = useMemo(() => {
    if (timeLeft <= 5) return "stroke-destructive";
    if (timeLeft <= 10) return "stroke-warning";
    return "stroke-primary";
  }, [timeLeft]);

  if (!current) return null;

  const progress = ((idx + 1) / total) * 100;

  return (
    <main className="min-h-screen flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <BrandLogo size="sm" />
          <div className="text-sm font-medium text-muted-foreground hidden sm:block">
            Question <span className="text-foreground font-semibold">{idx + 1}</span> of {total}
          </div>
          <div className="flex items-center gap-2 text-sm font-mono">
            <span className="text-muted-foreground">⏱</span>
            <span>{formatTime(globalSeconds)}</span>
          </div>
        </div>
        <div className="h-1 bg-secondary">
          <motion.div
            className="h-full bg-gradient-brand"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="glass-strong rounded-3xl p-6 sm:p-8 shadow-card"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30 rounded-full px-3 py-1">
                    {topic}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider bg-accent/15 text-accent border border-accent/30 rounded-full px-3 py-1">
                    {difficulty}
                  </span>
                </div>

                {/* Timer ring */}
                <div className="relative size-16 shrink-0">
                  <svg className="size-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" strokeWidth="4" className="stroke-secondary fill-none" />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      strokeWidth="4"
                      strokeLinecap="round"
                      className={`${ringColor} fill-none transition-colors ${timeLeft <= 5 ? "animate-pulse" : ""}`}
                      strokeDasharray={2 * Math.PI * 28}
                      strokeDashoffset={2 * Math.PI * 28 * (1 - timeLeft / PER_QUESTION_SECONDS)}
                      style={{ transition: "stroke-dashoffset 1s linear" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-lg">
                    {timeLeft}
                  </div>
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-display font-semibold mb-6 leading-snug">
                <span className="text-muted-foreground mr-2">Q{idx + 1}.</span>
                {current.question}
              </h2>

              <div className="space-y-3 mb-6">
                {current.options.map((opt, i) => {
                  const isSelected = selected === opt;
                  const dimmed = selected && !isSelected;
                  const letter = String.fromCharCode(65 + i);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSelected(opt)}
                      disabled={transitioning}
                      className={`w-full text-left rounded-2xl border-2 px-4 py-3.5 sm:px-5 sm:py-4 transition-all flex items-center gap-3 ${
                        isSelected
                          ? "border-primary bg-primary/15 shadow-glow scale-[1.01]"
                          : "border-border bg-secondary/50 hover:border-primary/50 hover:bg-secondary"
                      } ${dimmed ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`size-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                          isSelected
                            ? "bg-gradient-brand text-primary-foreground"
                            : "bg-background text-muted-foreground"
                        }`}
                      >
                        {isSelected ? <Check className="size-4" /> : letter}
                      </span>
                      <span className="flex-1 text-sm sm:text-base">{opt}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={transitioning}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  <SkipForward className="size-4" />
                  Skip Question
                </button>
                <Button
                  onClick={() => handleAdvance(false)}
                  disabled={!selected || transitioning}
                  className="bg-gradient-brand hover:opacity-90 hover:scale-[1.02] transition-all shadow-glow disabled:opacity-40 disabled:scale-100 px-8 h-12"
                >
                  {idx + 1 === total ? "Finish Quiz" : "Next Question →"}
                </Button>
              </div>

              <div className="mt-4 text-xs text-muted-foreground text-center">
                Tip: press <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border font-mono">1-4</kbd> to select •{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border font-mono">Enter</kbd> to advance
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
