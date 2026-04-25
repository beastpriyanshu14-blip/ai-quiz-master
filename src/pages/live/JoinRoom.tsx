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
    const { data: room, error } = await supabase
      .from("live_rooms")
      .select("*")
      .eq("code", c)
      .maybeSingle();

    if (error || !room) {
      toast.error("Room not found");
      setLoading(false);
      return;
    }
    if (room.password !== password) {
      toast.error("Incorrect password");
      setLoading(false);
      return;
    }
    if (room.status === "ended") {
      toast.error("This room has ended");
      setLoading(false);
      return;
    }

    // Check duplicate name
    const { data: existing } = await supabase
      .from("live_participants")
      .select("id, is_kicked")
      .eq("room_id", room.id)
      .eq("display_name", name.trim())
      .maybeSingle();

    if (existing) {
      if (existing.is_kicked) {
        toast.error("You were removed from this room");
        setLoading(false);
        return;
      }
      toast.error("That display name is already taken in this room");
      setLoading(false);
      return;
    }

    const token = generateToken();
    const { data: part, error: pErr } = await supabase
      .from("live_participants")
      .insert({
        room_id: room.id,
        participant_token: token,
        display_name: name.trim(),
      })
      .select()
      .single();

    if (pErr || !part) {
      toast.error("Failed to join room");
      setLoading(false);
      return;
    }

    saveParticipant(room.id, { token, name: name.trim(), participantId: part.id });
    toast.success(`Joined ${room.code}!`);
    navigate(`/live/play/${room.id}`);
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
