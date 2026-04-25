import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock, Trophy, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getParticipant, calcPoints } from "@/lib/live";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { Leaderboard } from "@/components/live/Leaderboard";
import { toast } from "sonner";
import type { LiveRoom, LiveQuestion, LiveParticipant, LiveAnswer } from "@/types/live";

export default function PlayRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [myAnswers, setMyAnswers] = useState<LiveAnswer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const submittingRef = useRef(false);

  const me = roomId ? getParticipant(roomId) : null;

  useEffect(() => {
    if (!roomId) return navigate("/setup");
    if (!me) {
      toast.error("You haven't joined this room");
      navigate("/live/join");
      return;
    }
    void load();
  }, [roomId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Reset selection when question changes
  useEffect(() => {
    setSelected(null);
    submittingRef.current = false;
  }, [room?.current_question_index]);

  // Realtime
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase
      .channel(`play-room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` }, (p) => {
        if (p.new) setRoom(p.new as LiveRoom);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_participants", filter: `room_id=eq.${roomId}` }, () => {
        void refetchParticipants();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_answers", filter: `room_id=eq.${roomId}` }, () => {
        void refetchMyAnswers();
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
    await refetchMyAnswers();
  };
  const refetchParticipants = async () => {
    const { data } = await supabase.from("live_participants").select("*").eq("room_id", roomId!);
    setParticipants((data ?? []) as LiveParticipant[]);
  };
  const refetchMyAnswers = async () => {
    if (!me) return;
    const { data } = await supabase
      .from("live_answers")
      .select("*")
      .eq("room_id", roomId!)
      .eq("participant_id", me.participantId);
    setMyAnswers((data ?? []) as LiveAnswer[]);
  };

  // Detect kick
  const meRecord = useMemo(
    () => participants.find((p) => p.id === me?.participantId),
    [participants, me],
  );
  useEffect(() => {
    if (meRecord?.is_kicked) {
      toast.error("You were removed by the host");
      navigate("/setup");
    }
  }, [meRecord, navigate]);

  if (!room || !me) return null;

  const currentQ = questions[room.current_question_index];
  const totalMs = room.seconds_per_question * 1000;
  const elapsedMs = room.question_started_at && room.status === "active"
    ? now - new Date(room.question_started_at).getTime()
    : 0;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const remainingSec = Math.ceil(remainingMs / 1000);

  const myAnswerForCurrent = currentQ
    ? myAnswers.find((a) => a.question_order_index === room.current_question_index)
    : undefined;
  const locked = !!myAnswerForCurrent || remainingMs <= 0 || room.status !== "active";
  const reveal = remainingMs <= 0 || !!myAnswerForCurrent;

  const submit = async (answer: string) => {
    if (!currentQ || submittingRef.current || locked) return;
    submittingRef.current = true;
    setSelected(answer);
    const timeTakenMs = elapsedMs;
    const isCorrect = answer === currentQ.correct_answer;
    const points = calcPoints(isCorrect, timeTakenMs, totalMs);

    const { error } = await supabase.from("live_answers").insert({
      room_id: room.id,
      question_id: currentQ.id,
      participant_id: me.participantId,
      question_order_index: room.current_question_index,
      selected_answer: answer,
      is_correct: isCorrect,
      time_taken_ms: timeTakenMs,
      points_earned: points,
    });
    if (error) {
      submittingRef.current = false;
      setSelected(null);
      toast.error("Couldn't submit — try again");
      return;
    }

    // Increment my score (read-modify-write)
    const newScore = (meRecord?.score ?? 0) + points;
    await supabase.from("live_participants").update({ score: newScore, last_seen_at: new Date().toISOString() }).eq("id", me.participantId);
  };

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <header className="max-w-3xl mx-auto flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/setup")}>
            <ArrowLeft className="size-4" />
          </Button>
          <BrandLogo size="sm" />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono bg-secondary border border-border rounded-full px-3 py-1">
            {room.code}
          </span>
          <span className="font-mono bg-primary/15 text-primary border border-primary/30 rounded-full px-3 py-1">
            {(meRecord?.score ?? 0).toLocaleString()} pts
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto space-y-5">
        {room.status === "lobby" && (
          <div className="glass-strong rounded-3xl p-8 text-center">
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
              <Trophy className="size-14 mx-auto text-primary mb-4" />
            </motion.div>
            <h2 className="text-2xl font-display font-bold mb-2">Waiting for host to start</h2>
            <p className="text-muted-foreground mb-6">
              Topic: <span className="text-foreground font-medium">{room.topic}</span>
            </p>
            <Leaderboard participants={participants} currentParticipantId={me.participantId} />
          </div>
        )}

        {(room.status === "active" || room.status === "paused") && currentQ && (
          <AnimatePresence mode="wait">
            <motion.div
              key={room.current_question_index}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.3 }}
              className="glass-strong rounded-3xl p-6 sm:p-8"
            >
              <div className="flex items-center justify-between mb-4 text-sm">
                <span className="text-muted-foreground">
                  Q{room.current_question_index + 1} / {room.total_questions}
                </span>
                <span
                  className={`font-mono font-bold flex items-center gap-1 ${
                    remainingSec <= 5 ? "text-destructive animate-pulse" : remainingSec <= 10 ? "text-warning" : ""
                  }`}
                >
                  <Clock className="size-4" />
                  {room.status === "paused" ? "Paused" : `${remainingSec}s`}
                </span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-5">
                <div
                  className={`h-full transition-all ${remainingSec <= 5 ? "bg-destructive" : remainingSec <= 10 ? "bg-warning" : "bg-gradient-brand"}`}
                  style={{ width: `${(remainingMs / totalMs) * 100}%` }}
                />
              </div>

              <h2 className="text-xl sm:text-2xl font-display font-semibold mb-6 leading-snug">
                {currentQ.question}
              </h2>

              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                {currentQ.options.map((opt, i) => {
                  const isMyPick = (myAnswerForCurrent?.selected_answer ?? selected) === opt;
                  const isCorrect = opt === currentQ.correct_answer;
                  const showRight = reveal && isCorrect;
                  const showWrong = reveal && isMyPick && !isCorrect;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => submit(opt)}
                      disabled={locked}
                      className={`rounded-2xl border-2 px-4 py-3.5 text-left flex items-center gap-3 transition-all ${
                        showRight
                          ? "border-success bg-success/20"
                          : showWrong
                            ? "border-destructive bg-destructive/15"
                            : isMyPick
                              ? "border-primary bg-primary/15 shadow-glow"
                              : "border-border bg-secondary/50 hover:border-primary/50 hover:bg-secondary"
                      } ${locked && !isMyPick && !showRight ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`size-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                          isMyPick ? "bg-gradient-brand text-primary-foreground" : "bg-background text-muted-foreground"
                        }`}
                      >
                        {isMyPick ? <Check className="size-4" /> : String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1 text-sm sm:text-base">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {reveal && currentQ.explanation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-primary/5 border border-primary/20 p-4 text-sm"
                >
                  💡 {currentQ.explanation}
                </motion.div>
              )}
              {myAnswerForCurrent && !reveal && (
                <p className="text-xs text-center text-muted-foreground">Answer locked. Waiting for others...</p>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {room.status === "ended" && (
          <div className="glass-strong rounded-3xl p-8 text-center">
            <div className="text-6xl mb-4">🏁</div>
            <h2 className="text-3xl font-display font-bold mb-2">Game Over!</h2>
            <p className="text-muted-foreground mb-6">Final score: <span className="text-foreground font-bold">{(meRecord?.score ?? 0).toLocaleString()}</span></p>
          </div>
        )}

        {/* Live leaderboard */}
        {room.status !== "lobby" && (
          <div className="glass-strong rounded-3xl p-5">
            <h3 className="font-display font-bold mb-3">Live Leaderboard</h3>
            <Leaderboard participants={participants} currentParticipantId={me.participantId} />
          </div>
        )}
      </div>
    </main>
  );
}
