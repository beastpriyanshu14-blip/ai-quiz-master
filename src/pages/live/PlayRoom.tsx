import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock, Trophy, ArrowLeft, Lock as LockIcon, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getParticipant } from "@/lib/live";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { Leaderboard } from "@/components/live/Leaderboard";
import { toast } from "sonner";
import type { LiveRoom, LiveQuestionSafe, LiveParticipant, LiveAnswer } from "@/types/live";

export default function PlayRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [questions, setQuestions] = useState<LiveQuestionSafe[]>([]);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [myAnswers, setMyAnswers] = useState<LiveAnswer[]>([]);
  const [allAnswers, setAllAnswers] = useState<LiveAnswer[]>([]); // populated only after reveal
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const submittingRef = useRef(false);
  const autoSubmittedRef = useRef<number>(-1);

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

  // Realtime (participants/answers). Note: live_rooms has host-only RLS, so
  // postgres_changes events for room status never reach participants — we poll
  // the room status via the public RPC as a safety net to prevent freezes.
  useEffect(() => {
    if (!roomId || !me) return;
    const ch = supabase
      .channel(`play-room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_participants", filter: `room_id=eq.${roomId}` }, () => {
        void refetchParticipants();
      })
      .subscribe();
    const poll = setInterval(() => {
      void refetchRoom();
      void refetchMyAnswers();
      void refetchQuestions();
    }, 1000);
    return () => {
      void supabase.removeChannel(ch);
      clearInterval(poll);
    };
  }, [roomId, me]);

  // When host reveals, load full questions (with correct_answer) + everyone's answers for analytics
  useEffect(() => {
    if (room?.reveal_results && room.status === "ended") {
      void loadRevealedData();
    }
  }, [room?.reveal_results, room?.status]);

  const refetchRoom = async () => {
    const { data, error } = await supabase.rpc("get_room_public" as any, { p_room_id: roomId });
    if (error) {
      console.error("get_room_public error:", error);
      return;
    }
    if (!data) return;
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.id) setRoom(row as LiveRoom);
  };

  const load = async () => {
    await refetchRoom();
    if (!me) return;
    await refetchQuestions();
    await refetchParticipants();
    await refetchMyAnswers();
  };
  const refetchQuestions = async () => {
    if (!me || !roomId) return;
    const { data: qs, error } = await supabase.rpc("get_room_questions_safe" as any, {
      p_room_id: roomId,
      p_participant_token: me.token,
    });
    if (error) {
      console.error("get_room_questions_safe error:", error);
      return;
    }
    const next = ((qs ?? []) as unknown) as LiveQuestionSafe[];
    if (next.length > 0) setQuestions(next);
  };
  const refetchParticipants = async () => {
    const { data } = await supabase
      .from("live_participants_public" as any)
      .select("*")
      .eq("room_id", roomId!);
    setParticipants(((data ?? []) as unknown) as LiveParticipant[]);
  };
  const refetchMyAnswers = async () => {
    if (!me) return;
    const { data } = await supabase.rpc("get_my_answers" as any, {
      p_room_id: roomId,
      p_participant_token: me.token,
    });
    setMyAnswers((data ?? []) as LiveAnswer[]);
  };
  const loadRevealedData = async () => {
    if (!me) return;
    // After the host reveals, RPC returns all answers in the room for analytics.
    const { data: ans } = await supabase.rpc("get_revealed_answers" as any, {
      p_room_id: roomId,
      p_participant_token: me.token,
    });
    setAllAnswers((ans ?? []) as LiveAnswer[]);
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

  const currentQ = room ? questions[room.current_question_index] : undefined;
  const totalMs = (room?.seconds_per_question ?? 30) * 1000;
  const elapsedMs = room?.question_started_at && room.status === "active"
    ? now - new Date(room.question_started_at).getTime()
    : 0;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const remainingSec = Math.ceil(remainingMs / 1000);

  const myAnswerForCurrent = currentQ && room
    ? myAnswers.find((a) => a.question_order_index === room.current_question_index)
    : undefined;
  const confirmed = !!myAnswerForCurrent;
  // Locked = already confirmed/submitted OR room not active anymore.
  // Timer expiry no longer locks the UI directly — we auto-submit on expiry.
  const locked = confirmed || room?.status !== "active";

  const submit = async (answer: string | null) => {
    if (!room || !currentQ || submittingRef.current || confirmed) return;
    submittingRef.current = true;

    const { data, error } = await supabase.rpc("submit_live_answer", {
      p_room_id: room.id,
      p_question_id: currentQ.id,
      p_participant_token: me.token,
      p_selected: answer,
    });
    const result = data as { ok?: boolean; error?: string } | null;

    if (error || !result?.ok) {
      submittingRef.current = false;
      // "already answered" / "time up" are benign races — silently refetch.
      const benign = result?.error && ["already answered", "time up"].includes(result.error);
      if (!benign) toast.error(result?.error || "Couldn't submit — try again");
      await refetchMyAnswers();
      return;
    }
    await refetchMyAnswers();
  };

  const confirmAnswer = () => {
    if (!selected || confirmed) return;
    void submit(selected);
  };

  // Auto-submit on timer expiry (with whatever's selected, or null)
  useEffect(() => {
    if (!room || !currentQ || confirmed || room.status !== "active") return;
    if (remainingMs > 0) return;
    if (autoSubmittedRef.current === room.current_question_index) return;
    autoSubmittedRef.current = room.current_question_index;
    void submit(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, confirmed, room?.status, room?.current_question_index]);

  // ------ Analytics (only after reveal) ------
  const myCorrect = allAnswers.filter((a) => a.participant_id === me.participantId && a.is_correct).length;
  const myTotal = allAnswers.filter((a) => a.participant_id === me.participantId).length;
  const accuracy = myTotal ? Math.round((myCorrect / myTotal) * 100) : 0;

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
          {room.reveal_results && (
            <span className="font-mono bg-primary/15 text-primary border border-primary/30 rounded-full px-3 py-1">
              {(meRecord?.score ?? 0).toLocaleString()} pts
            </span>
          )}
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
            <div className="text-sm text-muted-foreground mb-4">
              {participants.filter((p) => !p.is_kicked).length} player(s) in lobby
              {room.max_participants ? ` / ${room.max_participants}` : ""}
            </div>
            <Leaderboard participants={participants} currentParticipantId={me.participantId} />
          </div>
        )}

        {(room.status === "active" || room.status === "paused") && !currentQ && (
          <div className="glass-strong rounded-3xl p-8 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="text-4xl mb-4"
            >
              ⏳
            </motion.div>
            <h2 className="text-xl font-display font-semibold mb-1">Loading question…</h2>
            <p className="text-sm text-muted-foreground">Syncing with the host</p>
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
                  const submittedPick = myAnswerForCurrent?.selected_answer;
                  const isSelected = !confirmed && selected === opt;
                  const isConfirmed = confirmed && submittedPick === opt;
                  const isHighlighted = isSelected || isConfirmed;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => !locked && setSelected(opt)}
                      disabled={locked}
                      className={`rounded-2xl border-2 px-4 py-3.5 text-left flex items-center gap-3 transition-all ${
                        isConfirmed
                          ? "border-success bg-success/15 shadow-glow"
                          : isSelected
                            ? "border-primary bg-primary/15 shadow-glow"
                            : "border-border bg-secondary/50 hover:border-primary/50 hover:bg-secondary"
                      } ${locked && !isHighlighted ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`size-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                          isConfirmed
                            ? "bg-success text-success-foreground"
                            : isSelected
                              ? "bg-gradient-brand text-primary-foreground"
                              : "bg-background text-muted-foreground"
                        }`}
                      >
                        {isConfirmed ? <LockIcon className="size-4" /> : isSelected ? <Check className="size-4" /> : String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1 text-sm sm:text-base">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {!confirmed && room.status === "active" && remainingMs > 0 && (
                <Button
                  onClick={confirmAnswer}
                  disabled={!selected}
                  className="w-full h-12 bg-gradient-brand hover:opacity-90 shadow-glow disabled:opacity-40"
                >
                  <Send className="size-4 mr-2" />
                  {selected ? "Confirm Answer" : "Select an option"}
                </Button>
              )}

              {confirmed && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  ✓ Answer locked. Results will be revealed by the host at the end.
                </p>
              )}
              {!confirmed && remainingMs <= 0 && (
                <p className="text-xs text-center text-warning mt-2">⏱ Time's up — submitting your selection…</p>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {room.status === "ended" && !room.reveal_results && (
          <div className="glass-strong rounded-3xl p-8 text-center">
            <LockIcon className="size-14 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-display font-bold mb-2">Quiz finished!</h2>
            <p className="text-muted-foreground">Waiting for the host to reveal results…</p>
          </div>
        )}

        {room.status === "ended" && room.reveal_results && (
          <>
            <div className="glass-strong rounded-3xl p-8 text-center">
              <div className="text-6xl mb-4">🏁</div>
              <h2 className="text-3xl font-display font-bold mb-2">Final Results</h2>
              <p className="text-muted-foreground mb-4">
                Final score: <span className="text-foreground font-bold">{(meRecord?.score ?? 0).toLocaleString()}</span>
              </p>
              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto text-sm">
                <div className="rounded-xl border border-border bg-secondary/40 p-3">
                  <div className="text-2xl font-bold text-success">{myCorrect}</div>
                  <div className="text-xs text-muted-foreground">Correct</div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 p-3">
                  <div className="text-2xl font-bold">{myTotal}</div>
                  <div className="text-xs text-muted-foreground">Answered</div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 p-3">
                  <div className="text-2xl font-bold text-primary">{accuracy}%</div>
                  <div className="text-xs text-muted-foreground">Accuracy</div>
                </div>
              </div>
            </div>
            <div className="glass-strong rounded-3xl p-5">
              <h3 className="font-display font-bold mb-3">🏆 Final Leaderboard</h3>
              <Leaderboard participants={participants} currentParticipantId={me.participantId} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
