import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, LogIn, Lock, Hash, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { storage } from "@/lib/storage";
import { generateToken, saveParticipant } from "@/lib/live";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { toast } from "sonner";

export default function JoinRoom() {
  const navigate = useNavigate();
  const user = storage.getUser();

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  const handleJoin = async () => {
    const c = code.trim().toUpperCase();
    if (c.length !== 6) return toast.error("Room code must be 6 characters");
    if (!password.trim()) return toast.error("Enter the room password");
    if (name.trim().length < 2) return toast.error("Display name must be at least 2 characters");

    setLoading(true);
    const token = generateToken();
    const { data, error } = await supabase.rpc("join_live_room", {
      p_code: c,
      p_password: password,
      p_display_name: name.trim(),
      p_token: token,
    });

    const result = data as { ok?: boolean; room_id?: string; participant_id?: string; error?: string } | null;

    if (error || !result?.ok || !result.room_id || !result.participant_id) {
      const errMap: Record<string, string> = {
        "room not found": "Room not found",
        "wrong password": "Incorrect password",
        "room ended": "This room has ended",
        "name taken": "That display name is taken in this room",
        "room full": "Room is full",
        "kicked": "You were removed from this room",
        "quiz already started": "Quiz already in progress — can't join now",
        "name too short": "Display name too short",
      };
      toast.error(errMap[result?.error ?? ""] || result?.error || error?.message || "Failed to join");
      setLoading(false);
      return;
    }

    saveParticipant(result.room_id, { token, name: name.trim(), participantId: result.participant_id });
    toast.success(`Joined ${c}!`);
    navigate(`/live/play/${result.room_id}`);
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 flex flex-col">
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/setup")}>
            <ArrowLeft className="size-4" />
          </Button>
          <BrandLogo size="md" />
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full mx-auto flex-1 flex flex-col justify-center"
      >
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2">
            Join a <span className="text-gradient">Live Quiz</span>
          </h1>
          <p className="text-muted-foreground">Enter the room code and password</p>
        </div>

        <div className="glass-strong rounded-3xl p-6 sm:p-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-2">
              <Hash className="inline size-3.5 mr-1" /> Room Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              maxLength={6}
              className="w-full bg-input border border-border rounded-xl px-4 py-4 text-2xl font-mono font-bold tracking-[0.4em] text-center outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              <Lock className="inline size-3.5 mr-1" /> Password
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Room password"
              className="w-full bg-input border border-border rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              <User className="inline size-3.5 mr-1" /> Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-input border border-border rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <Button
            onClick={handleJoin}
            disabled={loading}
            className="w-full h-14 text-base font-semibold bg-gradient-brand hover:opacity-90 hover:scale-[1.01] transition-all shadow-glow"
          >
            <LogIn className="size-4 mr-2" />
            {loading ? "Joining..." : "Join Room"}
          </Button>
        </div>
      </motion.div>
    </main>
  );
}
