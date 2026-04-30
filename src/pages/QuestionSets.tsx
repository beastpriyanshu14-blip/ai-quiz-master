import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, Pencil, Check, Save, FolderOpen, X } from "lucide-react";
import { storage } from "@/lib/storage";
import { getOrCreateHostId } from "@/lib/live";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { UserAvatar } from "@/components/UserAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import type { QuizQuestion } from "@/types/quiz";
import type { QuestionSet } from "@/types/live";

const emptyQ = (): QuizQuestion => ({
  question: "",
  options: ["", "", "", ""],
  correct_answer: "",
  explanation: "",
});

export default function QuestionSets() {
  const navigate = useNavigate();
  const user = storage.getUser();
  const hostId = getOrCreateHostId();

  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<QuestionSet | null>(null);
  const [name, setName] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([emptyQ()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_question_sets" as any, { p_host_id: hostId });
    if (error) toast.error("Couldn't load your sets");
    setSets(((data ?? []) as unknown) as QuestionSet[]);
    setLoading(false);
  };

  const startNew = () => {
    setEditing({ id: "", name: "", questions: [emptyQ()], created_at: "", updated_at: "" });
    setName("");
    setQuestions([emptyQ()]);
  };

  const startEdit = (s: QuestionSet) => {
    setEditing(s);
    setName(s.name);
    setQuestions(s.questions.length ? s.questions : [emptyQ()]);
  };

  const cancel = () => {
    setEditing(null);
    setName("");
    setQuestions([emptyQ()]);
  };

  const updateQ = (i: number, patch: Partial<QuizQuestion>) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const updateOpt = (i: number, oi: number, val: string) =>
    setQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== i) return q;
        const newOpts = [...q.options];
        newOpts[oi] = val;
        const newCorrect = q.correct_answer === q.options[oi] ? val : q.correct_answer;
        return { ...q, options: newOpts, correct_answer: newCorrect };
      }),
    );

  const validate = (): string | null => {
    if (!name.trim()) return "Set name is required";
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

  const save = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("upsert_question_set" as any, {
      p_host_id: hostId,
      p_id: editing?.id || null,
      p_name: name.trim(),
      p_questions: questions as any,
    });
    setSaving(false);
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      toast.error(result?.error || error?.message || "Couldn't save");
      return;
    }
    toast.success("Set saved");
    cancel();
    void load();
  };

  const remove = async (s: QuestionSet) => {
    if (!confirm(`Delete "${s.name}"?`)) return;
    const { data, error } = await supabase.rpc("delete_question_set" as any, {
      p_host_id: hostId,
      p_id: s.id,
    });
    const result = data as { ok?: boolean } | null;
    if (error || !result?.ok) {
      toast.error("Couldn't delete");
      return;
    }
    toast.success("Deleted");
    void load();
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
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserAvatar />
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2">
            My <span className="text-gradient">Question Sets</span>
          </h1>
          <p className="text-muted-foreground">Save reusable quiz banks and load them when hosting</p>
        </div>

        {!editing && (
          <>
            <div className="flex justify-end mb-4">
              <Button onClick={startNew} className="bg-gradient-brand hover:opacity-90 shadow-glow">
                <Plus className="size-4 mr-2" /> New Set
              </Button>
            </div>

            {loading ? (
              <div className="text-center text-muted-foreground py-12">Loading…</div>
            ) : sets.length === 0 ? (
              <div className="glass-strong rounded-3xl p-12 text-center">
                <FolderOpen className="size-12 mx-auto text-primary mb-4 opacity-60" />
                <h2 className="text-xl font-display font-bold mb-2">No saved sets yet</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Build a question bank you can reuse for any live quiz.
                </p>
                <Button onClick={startNew} variant="outline">
                  <Plus className="size-4 mr-2" /> Create your first set
                </Button>
              </div>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-3">
                {sets.map((s) => (
                  <li
                    key={s.id}
                    className="glass-strong rounded-2xl p-5 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display font-bold text-lg truncate">{s.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {s.questions.length} question{s.questions.length === 1 ? "" : "s"} ·
                          {" "}{new Date(s.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => startEdit(s)}>
                        <Pencil className="size-3.5 mr-1.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => remove(s)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {editing && (
          <div className="glass-strong rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-xl">
                {editing.id ? "Edit Set" : "New Set"}
              </h2>
              <Button variant="ghost" size="icon" onClick={cancel}>
                <X className="size-4" />
              </Button>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Set Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Science Quiz Set 1"
                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>

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
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={cancel}>Cancel</Button>
              <Button
                onClick={save}
                disabled={saving}
                className="bg-gradient-brand hover:opacity-90 shadow-glow"
              >
                <Save className="size-4 mr-2" />
                {saving ? "Saving…" : "Save Set"}
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </main>
  );
}
