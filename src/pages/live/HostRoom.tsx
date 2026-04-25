import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Copy, Play, Pause, SkipForward, Square, Users, ArrowLeft, Lock, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getHostToken } from "@/lib/live";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { Leaderboard } from "@/components/live/Leaderboard";
import { toast } from "sonner";
import type { LiveRoom, LiveQuestion, LiveParticipant, LiveAnswer } from "@/types/live";

export default function HostRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [answers, setAnswers] = useState<LiveAnswer[]>([]);
  const [now, setNow] = useState(Date.now());

  const hostToken = roomId ? getHostToken(roomId) : null;

  useEffect(() => {
    if (!roomId) return navigate("/setup");
    if (!hostToken) {
      toast.error("You're not the host of this room");
      navigate("/setup");
      return;
    }
    void load();
  }, [roomId]);

  // Tick for timer display
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase
      .channel(`host-room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` }, (p) => {
        if (p.new) setRoom(p.new as LiveRoom);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_participants", filter: `room_id=eq.${roomId}` }, () => {
        void refetchParticipants();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_answers", filter: `room_id=eq.${roomId}` }, () => {
        void refetchAnswers();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [roomId]);

  const load = async () => {
    const { data: r } = await supabase.from("live_rooms").select("*").eq("id", roomId!).maybeSingle();
    if (!r) { navigate("/setup"); return; }
    setRoom(r as LiveRoom);
    const { data: qs } = await supabase.from("live_questions").select("*").eq("room_id", roomId!).order("order_index");
    setQuestions((qs ?? []) as LiveQuestion[]);
    await refetchParticipants();
    await refetchAnswers();
  };
  const refetchParticipants = async () => {
    const { data } = await supabase.from("live_participants").select("*").eq("room_id", roomId!);
    setParticipants((data ?? []) as LiveParticipant[]);
  };
  const refetchAnswers = async () => {
    const { data } = await supabase.from("live_answers").select("*").eq("room_id", roomId!);
    setAnswers((data ?? []) as LiveAnswer[]);
  };

  if (!room) return null;

  const currentQ = questions[room.current_question_index];
  const totalMs = room.seconds_per_question * 1000;
  const elapsedMs = room.question_started_at && room.status === "active"
    ? now - new Date(room.question_started_at).getTime()
    : 0;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const remainingSec = Math.ceil(remainingMs / 1000);

  const activePart = participants.filter((p) => !p.is_kicked);
  const answeredCount = currentQ
    ? answers.filter((a) => a.question_order_index === room.current_question_index).length
    : 0;

  const advanceTo = async (index: number) => {
    if (index >= room.total_questions) {
      await endQuiz();
      return;
    }
    await supabase.from("live_rooms").update({
      status: "active",
      current_question_index: index,
      question_started_at: new Date().toISOString(),
    }).eq("id", room.id);
  };

  const startQuiz = async () => {
    if (activePart.length === 0) {
      toast.error("Wait for at least one participant to join");
      return;
    }
    await advanceTo(0);
    toast.success("Quiz started!");
  };
  const next = async () => advanceTo(room.current_question_index + 1);
  const pause = async () => {
    await supabase.from("live_rooms").update({ status: "paused" }).eq("id", room.id);
  };
  const resume = async () => {
    // Restart this question's timer
    await supabase.from("live_rooms").update({ status: "active", question_started_at: new Date().toISOString() }).eq("id", room.id);
  };
  const endQuiz = async () => {
    await supabase.from("live_rooms").update({ status: "ended" }).eq("id", room.id);
    toast.success("Quiz ended");
  };
  const kick = async (participantId: string) => {
    await supabase.from("live_participants").update({ is_kicked: true }).eq("id", participantId);
    toast.info("Participant removed");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    toast.success("Room code copied!");
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <header className="max-w-6xl mx-auto flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/setup")}>
            <ArrowLeft className="size-4" />
          </Button>
          <BrandLogo size="md" />
        </div>
        <span className="text-xs uppercase tracking-wider font-bold bg-primary/15 text-primary border border-primary/30 rounded-full px-3 py-1">
          HOST · {room.status}
        </span>
      </header>

      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr,360px] gap-6">
        {/* Main */}
        <div className="space-y-6">
          {/* Room info */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Topic</div>
                <h2 className="text-xl sm:text-2xl font-display font-bold">{room.topic}</h2>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="bg-accent/15 text-accent border border-accent/30 rounded-full px-3 py-1 text-xs font-semibold uppercase">
                  {room.difficulty}
                </span>
                <span className="bg-secondary border border-border rounded-full px-3 py-1 text-xs font-mono">
                  {room.seconds_per_question}s/Q
                </span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <button
                onClick={copyCode}
                className="group rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all p-4 text-left"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Hash className="size-3" /> Room Code
                  </span>
                  <Copy className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="font-mono text-3xl font-bold tracking-[0.3em] text-gradient">
                  {room.code}
                </div>
              </button>
              <div className="rounded-2xl border border-border bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                  <Lock className="size-3" /> Password
                </div>
                <div className="font-mono text-2xl font-bold">{room.password}</div>
              </div>
            </div>
          </motion.div>

          {/* Quiz state */}
          <div className="glass-strong rounded-3xl p-6 sm:p-8">
            {room.status === "lobby" && (
              <div className="text-center py-8">
                <Users className="size-12 mx-auto text-primary mb-4" />
                <h3 className="text-xl font-display font-bold mb-2">Waiting in lobby</h3>
                <p className="text-muted-foreground mb-6">
                  {activePart.length} {activePart.length === 1 ? "participant" : "participants"} joined ·{" "}
                  {questions.length} questions ready
                </p>
                <Button
                  onClick={startQuiz}
                  className="h-12 px-8 bg-gradient-brand hover:opacity-90 hover:scale-[1.02] transition-all shadow-glow"
                >
                  <Play className="size-4 mr-2" /> Start Quiz
                </Button>
              </div>
            )}

            {(room.status === "active" || room.status === "paused") && currentQ && (
              <>
                <div className="flex items-center justify-between mb-4 text-sm">
                  <span className="text-muted-foreground">
                    Q{room.current_question_index + 1} of {room.total_questions}
                  </span>
                  <span className="font-mono font-bold text-lg">
                    ⏱ {room.status === "paused" ? "Paused" : `${remainingSec}s`}
                  </span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-5">
                  <div
                    className="h-full bg-gradient-brand transition-all"
                    style={{ width: `${(remainingMs / totalMs) * 100}%` }}
                  />
                </div>
                <h3 className="text-lg sm:text-xl font-display font-semibold mb-4">
                  {currentQ.question}
                </h3>
                <div className="grid sm:grid-cols-2 gap-2 mb-5">
                  {currentQ.options.map((opt, i) => {
                    const isCorrect = opt === currentQ.correct_answer;
                    const reveal = remainingMs <= 0;
                    return (
                      <div
                        key={opt}
                        className={`rounded-xl border-2 px-4 py-3 text-sm flex items-center gap-2 ${
                          reveal && isCorrect
                            ? "border-success bg-success/15"
                            : "border-border bg-secondary/40"
                        }`}
                      >
                        <span className="size-7 rounded bg-background flex items-center justify-center font-bold text-xs">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {reveal && isCorrect && <span className="text-success text-xs font-bold">✓</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                  <span>{answeredCount} / {activePart.length} answered</span>
                  {remainingMs <= 0 && <span className="text-warning">Time's up — reveal & advance</span>}
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {room.status === "active" ? (
                    <Button variant="outline" onClick={pause}>
                      <Pause className="size-4 mr-2" /> Pause
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={resume}>
                      <Play className="size-4 mr-2" /> Resume
                    </Button>
                  )}
                  <Button variant="outline" onClick={endQuiz} className="text-destructive hover:text-destructive">
                    <Square className="size-4 mr-2" /> End
                  </Button>
                  <Button onClick={next} className="bg-gradient-brand hover:opacity-90 shadow-glow">
                    <SkipForward className="size-4 mr-2" />
                    {room.current_question_index + 1 >= room.total_questions ? "Finish" : "Next Question"}
                  </Button>
                </div>
              </>
            )}

            {room.status === "ended" && (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">🏁</div>
                <h3 className="text-2xl font-display font-bold mb-2">Quiz ended</h3>
                <p className="text-muted-foreground mb-6">Check the final leaderboard →</p>
                <Button onClick={() => navigate("/setup")} variant="outline">
                  Back to Setup
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar leaderboard */}
        <aside className="glass-strong rounded-3xl p-5 h-fit lg:sticky lg:top-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">Leaderboard</h3>
            <span className="text-xs text-muted-foreground">{activePart.length} players</span>
          </div>
          <Leaderboard participants={participants} onKick={kick} />
        </aside>
      </div>
    </main>
  );
}
