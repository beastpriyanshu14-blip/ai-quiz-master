import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Check, X, Clock, RotateCw, Sparkles, BarChart3 } from "lucide-react";
import { storage, formatTime, getGrade } from "@/lib/storage";
import { useQuizStore } from "@/store/quizStore";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";

export default function Results() {
  const navigate = useNavigate();
  const { reset, setQuestions } = useQuizStore();

  const result = useMemo(() => {
    const id = sessionStorage.getItem("quizmaster_last_result_id");
    return storage.getHistory().find((r) => r.id === id) || storage.getHistory()[0];
  }, []);

  useEffect(() => {
    if (!result) {
      navigate("/setup");
      return;
    }
    if (result.score >= 70) {
      const fire = (particleRatio: number, opts: confetti.Options) => {
        confetti({
          origin: { y: 0.7 },
          colors: ["#6366f1", "#8b5cf6", "#10b981", "#f59e0b"],
          ...opts,
          particleCount: Math.floor(200 * particleRatio),
        });
      };
      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.9 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    }
  }, [result, navigate]);

  if (!result) return null;
  const grade = getGrade(result.score);

  const handleRetake = () => {
    const { questions } = useQuizStore.getState();
    if (questions.length) {
      setQuestions(questions);
      navigate("/quiz");
    } else {
      navigate("/setup");
    }
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-8">
        <BrandLogo size="md" />
        <Button variant="ghost" size="sm" onClick={() => navigate("/stats")}>
          <BarChart3 className="size-4 mr-1.5" />
          <span className="hidden sm:inline">My Stats</span>
        </Button>
      </header>

      <div className="max-w-4xl mx-auto space-y-8">
        <motion.section
          initial={{ opacity: 0, y: -40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="text-center glass-strong rounded-3xl p-8 sm:p-12 shadow-glow-strong"
        >
          <div className="text-6xl mb-4 animate-float">{grade.emoji}</div>
          <div className="font-display font-extrabold text-6xl sm:text-7xl mb-2">
            <span className="text-gradient">
              {result.correctAnswers}
            </span>
            <span className="text-muted-foreground"> / {result.totalQuestions}</span>
          </div>
          <div className="text-3xl sm:text-4xl font-display font-bold mb-3">{result.score}%</div>
          <p className={`text-lg font-medium ${grade.color}`}>{grade.label}</p>
        </motion.section>

        <section className="grid grid-cols-3 gap-3 sm:gap-4">
          <StatCard icon={Check} label="Correct" value={result.correctAnswers} color="text-success" />
          <StatCard icon={X} label="Incorrect" value={result.incorrectAnswers} color="text-destructive" />
          <StatCard icon={Clock} label="Skipped" value={result.skipped} color="text-warning" />
        </section>

        <section className="glass rounded-2xl p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <InfoCell label="Topic" value={result.topic} />
          <InfoCell label="Difficulty" value={result.difficulty.toUpperCase()} />
          <InfoCell label="Time" value={formatTime(result.timeTaken)} />
          <InfoCell label="Date" value={new Date(result.date).toLocaleDateString()} />
        </section>

        <section>
          <h2 className="text-2xl font-display font-bold mb-4">📋 Question Review</h2>
          <div className="space-y-3">
            {result.questions.map((q, i) => {
              const status = q.userAnswer === null
                ? { label: "TIMED OUT", color: "text-warning", border: "border-warning/40", bg: "bg-warning/5", icon: "⏭" }
                : q.isCorrect
                  ? { label: "CORRECT", color: "text-success", border: "border-success/40", bg: "bg-success/5", icon: "✅" }
                  : { label: "INCORRECT", color: "text-destructive", border: "border-destructive/40", bg: "bg-destructive/5", icon: "❌" };

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`glass rounded-2xl p-5 border-l-4 ${status.border} ${status.bg}`}
                >
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">Q{i + 1}</span>
                    <span className={`text-xs font-bold tracking-wider ${status.color}`}>
                      {status.icon} {status.label}
                    </span>
                  </div>
                  <p className="font-medium mb-4">{q.question}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">Your answer:</span>
                      <span className={q.userAnswer === null ? "text-muted-foreground italic" : q.isCorrect ? "text-success" : "text-destructive"}>
                        {q.userAnswer ?? "— (not answered)"}
                      </span>
                    </div>
                    {!q.isCorrect && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground shrink-0">Correct:</span>
                        <span className="text-success">{q.correct_answer}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/60 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">💡 Explanation: </span>
                    {q.explanation}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-wrap gap-3 justify-center pt-4">
          <Button variant="outline" onClick={handleRetake} className="border-border hover:border-primary">
            <RotateCw className="size-4 mr-2" />
            Retake Same Quiz
          </Button>
          <Button
            onClick={() => {
              reset();
              navigate("/setup");
            }}
            className="bg-gradient-brand hover:opacity-90 hover:scale-[1.02] transition-all shadow-glow"
          >
            <Sparkles className="size-4 mr-2" />
            New Topic
          </Button>
          <Button variant="outline" onClick={() => navigate("/stats")} className="border-border hover:border-primary">
            <BarChart3 className="size-4 mr-2" />
            View My Stats
          </Button>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="glass rounded-2xl p-4 sm:p-5 text-center">
      <Icon className={`size-5 mx-auto mb-2 ${color}`} />
      <div className="text-2xl sm:text-3xl font-display font-bold">{value}</div>
      <div className="text-xs sm:text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}
