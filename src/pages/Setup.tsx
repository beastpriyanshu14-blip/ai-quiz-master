import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Sparkles, BarChart3, Bot, Radio, LogIn } from "lucide-react";
import { storage } from "@/lib/storage";
import { useQuizStore } from "@/store/quizStore";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { UserAvatar } from "@/components/UserAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Difficulty } from "@/types/quiz";

const TOPIC_CHIPS = [
  { emoji: "🔬", label: "Science" },
  { emoji: "🏛️", label: "History" },
  { emoji: "💻", label: "Programming" },
  { emoji: "🌍", label: "Geography" },
  { emoji: "🎭", label: "Literature" },
  { emoji: "🔢", label: "Mathematics" },
  { emoji: "🎬", label: "Movies" },
  { emoji: "⚽", label: "Sports" },
];

const DIFFICULTIES: { id: Difficulty; emoji: string; label: string; sub: string }[] = [
  { id: "easy", emoji: "🌱", label: "EASY", sub: "Beginner concepts" },
  { id: "medium", emoji: "🔥", label: "MEDIUM", sub: "Intermediate knowledge" },
  { id: "hard", emoji: "💀", label: "HARD", sub: "Expert mastery" },
];

const QUESTION_COUNTS = [5, 10, 15, 20];

const TIPS = [
  "Did you know? AI reads millions of sources to create your questions.",
  "Harder questions test deeper understanding.",
  "Take your time — reading carefully helps!",
  "Specific topics yield better questions than broad ones.",
];

export default function Setup() {
  const navigate = useNavigate();
  const user = storage.getUser();
  const totalPlayed = useMemo(() => storage.getHistory().length, []);
  const { setSetup, setQuestions } = useQuizStore();

  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [num, setNum] = useState(10);
  const [loading, setLoading] = useState(false);
  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 2500);
    return () => clearInterval(interval);
  }, [loading]);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic first");
      return;
    }
    setLoading(true);
    setSetup(topic.trim(), difficulty, num);

    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { topic: topic.trim(), difficulty, num_questions: num },
      });

      if (error) {
        const msg = (error as any)?.message || "Failed to generate quiz";
        if (msg.includes("429")) toast.error("Rate limit reached. Try again in a moment.");
        else if (msg.includes("402")) toast.error("AI credits exhausted. Add credits in Workspace Settings.");
        else toast.error(msg);
        setLoading(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setLoading(false);
        return;
      }

      if (!data?.questions?.length) {
        toast.error("No questions returned. Try a different topic.");
        setLoading(false);
        return;
      }

      setQuestions(data.questions);
      toast.success("Quiz generated! Good luck 🎯");
      navigate("/quiz");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate quiz. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="size-4" />
          </Button>
          <BrandLogo size="md" />
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/stats")}>
            <BarChart3 className="size-4 sm:mr-1.5" />
            <span className="hidden sm:inline">My Stats</span>
          </Button>
          <ThemeToggle />
          <UserAvatar />
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-3xl mx-auto"
      >
        {user && (
          <motion.section
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
              <Sparkles className="size-3" /> AI-Powered Quiz Platform
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold mb-3 leading-tight">
              Welcome back, <span className="text-gradient">{user.name.split(" ")[0]}</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
              Create AI quizzes on any topic, or join a live room with friends.
            </p>
            {totalPlayed > 0 && (
              <div className="mt-5 inline-flex items-center gap-2 text-sm bg-secondary/60 border border-border rounded-full px-4 py-1.5">
                <BarChart3 className="size-3.5 text-primary" />
                <span className="font-semibold">{totalPlayed}</span>
                <span className="text-muted-foreground">{totalPlayed === 1 ? "quiz" : "quizzes"} played</span>
              </div>
            )}
          </motion.section>
        )}

        {/* Live quiz entry points */}
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate("/live/host")}
            className="group rounded-2xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary hover:scale-[1.01] transition-all p-4 text-left flex items-center gap-3"
          >
            <div className="size-10 rounded-xl bg-gradient-brand flex items-center justify-center shrink-0">
              <Radio className="size-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Host Live Quiz</div>
              <div className="text-xs text-muted-foreground truncate">Create a room with friends</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => navigate("/live/join")}
            className="group rounded-2xl border-2 border-accent/30 bg-accent/5 hover:bg-accent/10 hover:border-accent hover:scale-[1.01] transition-all p-4 text-left flex items-center gap-3"
          >
            <div className="size-10 rounded-xl bg-accent/30 border border-accent/40 flex items-center justify-center shrink-0">
              <LogIn className="size-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Join Live Quiz</div>
              <div className="text-xs text-muted-foreground truncate">Enter a 6-character room code</div>
            </div>
          </button>
        </div>

        <div className="glass-strong rounded-3xl p-6 sm:p-8 space-y-8">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold text-center">
            — or play solo —
          </div>
          {/* Topic */}
          <div>
            <label className="block text-sm font-semibold mb-3">Topic</label>
            <div className="relative">
              <Search className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Python Programming, World War II, Human Biology..."
                className="w-full bg-input border border-border rounded-xl pl-11 pr-4 py-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {TOPIC_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setTopic(chip.label)}
                  className="text-sm bg-secondary hover:bg-secondary/70 hover:scale-105 transition-all border border-border rounded-full px-3 py-1.5"
                >
                  {chip.emoji} {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-semibold mb-3">Difficulty</label>
            <div className="grid grid-cols-3 gap-3">
              {DIFFICULTIES.map((d) => {
                const active = difficulty === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDifficulty(d.id)}
                    className={`relative rounded-2xl p-4 text-center transition-all border-2 ${
                      active
                        ? "border-primary bg-primary/10 shadow-glow scale-[1.03]"
                        : "border-border bg-secondary hover:border-primary/50 hover:scale-[1.02]"
                    }`}
                  >
                    <div className="text-3xl mb-2">{d.emoji}</div>
                    <div className="font-display font-bold text-sm tracking-wider">{d.label}</div>
                    <div className="text-xs text-muted-foreground mt-1 hidden sm:block">{d.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Number of questions */}
          <div>
            <label className="block text-sm font-semibold mb-3">Number of Questions</label>
            <div className="flex flex-wrap gap-2">
              {QUESTION_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNum(n)}
                  className={`min-w-14 px-5 py-2.5 rounded-full font-semibold transition-all border ${
                    num === n
                      ? "bg-gradient-brand text-primary-foreground border-transparent shadow-glow scale-105"
                      : "bg-secondary border-border hover:border-primary/50"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!topic.trim() || loading}
            className="w-full h-14 text-base font-semibold bg-gradient-brand hover:opacity-90 hover:scale-[1.01] transition-all shadow-glow disabled:opacity-40 disabled:scale-100"
          >
            <Sparkles className="size-4 mr-2" />
            Generate Quiz with AI
          </Button>
        </div>
      </motion.div>

      {/* Loading overlay */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="glass-strong rounded-3xl p-8 max-w-md w-full text-center shadow-glow-strong">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-gradient-brand rounded-full blur-2xl opacity-60 animate-pulse-glow" />
              <div className="relative bg-gradient-brand rounded-full p-5 animate-float">
                <Bot className="size-10 text-primary-foreground" />
              </div>
            </div>
            <h3 className="text-2xl font-display font-bold mb-2">Generating your quiz...</h3>
            <p className="text-muted-foreground mb-6">
              Crafting {num} {difficulty} questions about <span className="text-foreground font-medium">{topic}</span>
            </p>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-6">
              <motion.div
                className="h-full bg-gradient-brand"
                initial={{ width: "0%" }}
                animate={{ width: "95%" }}
                transition={{ duration: 8, ease: "easeOut" }}
              />
            </div>
            <motion.p
              key={tipIdx}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-muted-foreground italic"
            >
              💡 {TIPS[tipIdx]}
            </motion.p>
          </div>
        </motion.div>
      )}
    </main>
  );
}
