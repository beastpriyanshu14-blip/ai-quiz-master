import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Plus, Trash2, Lock, Users, Bot, Pencil, Check } from "lucide-react";
import { storage } from "@/lib/storage";
import { generateRoomCode, generateToken, saveHostToken } from "@/lib/live";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Difficulty, QuizQuestion } from "@/types/quiz";

const DIFFICULTIES: { id: Difficulty; emoji: string; label: string }[] = [
  { id: "easy", emoji: "🌱", label: "EASY" },
  { id: "medium", emoji: "🔥", label: "MEDIUM" },
  { id: "hard", emoji: "💀", label: "HARD" },
];

type Mode = "ai" | "manual";

const emptyQ = (): QuizQuestion => ({
  question: "",
  options: ["", "", "", ""],
  correct_answer: "",
  explanation: "",
});

export default function HostCreate() {
  const navigate = useNavigate();
  const user = storage.getUser();

  const [mode, setMode] = useState<Mode>("ai");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [num, setNum] = useState(5);
  const [seconds, setSeconds] = useState(20);
  const [maxPart, setMaxPart] = useState<string>(""); // blank = unlimited
  const [password, setPassword] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([emptyQ()]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  const updateQ = (i: number, patch: Partial<QuizQuestion>) => {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  };
  const updateOpt = (i: number, oi: number, val: string) => {
    setQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== i) return q;
        const newOpts = [...q.options];
        newOpts[oi] = val;
        const newCorrect = q.correct_answer === q.options[oi] ? val : q.correct_answer;
        return { ...q, options: newOpts, correct_answer: newCorrect };
      }),
    );
  };

  const validateManual = (): string | null => {
    if (questions.length < 1) return "Add at least one question";
    for (const [i, q] of questions.entries()) {
      if (!q.question.trim()) return `Question ${i + 1}: text is empty`;
      if (q.options.some((o) => !o.trim())) return `Question ${i + 1}: all 4 options are required`;
      if (!q.correct_answer || !q.options.includes(q.correct_answer))
        return `Question ${i + 1}: pick the correct answer`;
      const uniq = new Set(q.options.map((o) => o.trim()));
      if (uniq.size !== 4) return `Question ${i + 1}: options must be unique`;
    }
    return null;
  };

  const handleCreate = async () => {
    if (!password.trim() || password.length < 4) {
      toast.error("Set a password (min 4 characters)");
      return;
    }
    if (num < 1 || num > 200) {
      toast.error("Number of questions must be between 1 and 200");
      return;
    }
    if (seconds < 5 || seconds > 600) {
      toast.error("Timer must be between 5 and 600 seconds");
      return;
    }
    const maxP = maxPart.trim() === "" ? null : Number(maxPart);
    if (maxP !== null && (!Number.isFinite(maxP) || maxP < 1 || maxP > 1000)) {
      toast.error("Max participants must be 1–1000 (or leave blank for unlimited)");
      return;
    }

    let finalQuestions: QuizQuestion[] = [];
    let resolvedTopic = topic.trim();

    if (mode === "ai") {
      if (!resolvedTopic) {
        toast.error("Enter a topic for AI generation");
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("generate-quiz", {
          body: { topic: resolvedTopic, difficulty, num_questions: num },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        if (!data?.questions?.length) throw new Error("No questions returned");
        finalQuestions = data.questions;
      } catch (e: any) {
        toast.error(e?.message || "Failed to generate questions");
        setLoading(false);
        return;
      }
    } else {
      const err = validateManual();
      if (err) {
        toast.error(err);
        return;
      }
      finalQuestions = questions;
      resolvedTopic = resolvedTopic || "Custom Quiz";
      setLoading(true);
    }

    const code = generateRoomCode();
    const hostToken = generateToken();

    const { data: rpcData, error: rpcErr } = await supabase.rpc("create_live_room", {
      p_code: code,
      p_password: password,
      p_host_token: hostToken,
      p_host_name: user!.name,
      p_topic: resolvedTopic,
      p_difficulty: difficulty,
      p_seconds_per_question: seconds,
      p_max_participants: maxP,
      p_questions: finalQuestions as any,
    });

    const result = rpcData as { ok?: boolean; room_id?: string; error?: string } | null;
    if (rpcErr || !result?.ok || !result.room_id) {
      toast.error(result?.error || rpcErr?.message || "Failed to create room");
      setLoading(false);
      return;
    }

    saveHostToken(result.room_id, hostToken);
    toast.success(`Room created! Code: ${code}`);
    navigate(`/live/host/${result.room_id}`);
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/setup")}>
            <ArrowLeft className="size-4" />
          </Button>
          <BrandLogo size="md" />
        </div>
        <UserAvatar />
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2">
            Host a <span className="text-gradient">Live Quiz</span>
          </h1>
          <p className="text-muted-foreground">Create a room and challenge friends in real-time</p>
        </div>

        <div className="glass-strong rounded-3xl p-6 sm:p-8 space-y-7">
          <div>
            <label className="block text-sm font-semibold mb-3">Question Source</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("ai")}
                className={`rounded-2xl p-4 border-2 transition-all flex items-center gap-3 ${
                  mode === "ai"
                    ? "border-primary bg-primary/10 shadow-glow"
                    : "border-border bg-secondary hover:border-primary/40"
                }`}
              >
                <Bot className="size-5 text-primary" />
                <div className="text-left">
                  <div className="font-semibold text-sm">AI-Generated</div>
                  <div className="text-xs text-muted-foreground">Gemini crafts questions</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`rounded-2xl p-4 border-2 transition-all flex items-center gap-3 ${
                  mode === "manual"
                    ? "border-primary bg-primary/10 shadow-glow"
                    : "border-border bg-secondary hover:border-primary/40"
                }`}
              >
                <Pencil className="size-5 text-primary" />
                <div className="text-left">
                  <div className="font-semibold text-sm">Write Manually</div>
                  <div className="text-xs text-muted-foreground">Custom questions</div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Topic {mode === "manual" && <span className="text-muted-foreground font-normal">(optional)</span>}
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={mode === "ai" ? "e.g., Renaissance Art" : "Friday night trivia"}
              className="w-full bg-input border border-border rounded-xl px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold mb-2">Difficulty</label>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDifficulty(d.id)}
                    className={`rounded-xl py-2.5 text-xs font-bold border-2 transition-all ${
                      difficulty === d.id
                        ? "border-primary bg-primary/10 shadow-glow"
                        : "border-border bg-secondary hover:border-primary/40"
                    }`}
                  >
                    {d.emoji} {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Seconds per question</label>
              <input
                type="number"
                min={5}
                max={600}
                value={seconds}
                onChange={(e) => setSeconds(Math.max(0, Number(e.target.value) || 0))}
                placeholder="20"
                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-base font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-xs text-muted-foreground mt-1">5 – 600 seconds</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {mode === "ai" && (
              <div>
                <label className="block text-sm font-semibold mb-2">Number of Questions</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={num}
                  onChange={(e) => setNum(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="10"
                  className="w-full bg-input border border-border rounded-xl px-4 py-3 text-base font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-xs text-muted-foreground mt-1">1 – 200 questions</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold mb-2">
                <Users className="inline size-3.5 mr-1" /> Max Participants
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={maxPart}
                onChange={(e) => setMaxPart(e.target.value)}
                placeholder="Unlimited"
                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-base font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-xs text-muted-foreground mt-1">Leave blank for unlimited</p>
            </div>
          </div>

          {mode === "manual" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold">Questions ({questions.length})</label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setQuestions((qs) => [...qs, emptyQ()])}
                >
                  <Plus className="size-4 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-4">
                {questions.map((q, i) => (
                  <div key={i} className="rounded-2xl border border-border bg-secondary/40 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold uppercase text-primary tracking-wider">
                        Q{i + 1}
                      </span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                    <textarea
                      value={q.question}
                      onChange={(e) => updateQ(i, { question: e.target.value })}
                      placeholder="Question text..."
                      rows={2}
                      className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                    />
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => {
                        const isCorrect = q.correct_answer && q.correct_answer === opt && opt;
                        return (
                          <div key={oi} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => opt && updateQ(i, { correct_answer: opt })}
                              className={`size-7 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                                isCorrect
                                  ? "border-success bg-success/20"
                                  : "border-border hover:border-success/50"
                              }`}
                              title="Mark as correct"
                            >
                              {isCorrect ? (
                                <Check className="size-3.5 text-success" />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {String.fromCharCode(65 + oi)}
                                </span>
                              )}
                            </button>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => updateOpt(i, oi, e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                              className="flex-1 bg-input border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary"
                            />
                          </div>
                        );
                      })}
                    </div>
                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) => updateQ(i, { explanation: e.target.value })}
                      placeholder="Explanation (optional)"
                      className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-2">
              <Lock className="inline size-3.5 mr-1" /> Room Password
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Participants will need this to join"
              className="w-full bg-input border border-border rounded-xl px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-mono"
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={loading}
            className="w-full h-14 text-base font-semibold bg-gradient-brand hover:opacity-90 hover:scale-[1.01] transition-all shadow-glow disabled:opacity-40"
          >
            {loading ? (
              <>Generating room...</>
            ) : (
              <>
                <Users className="size-4 mr-2" />
                {mode === "ai" ? <><Sparkles className="size-4 mr-2" />Generate & Create Room</> : "Create Room"}
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </main>
  );
}
