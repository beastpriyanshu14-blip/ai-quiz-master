import { motion, AnimatePresence } from "framer-motion";
import { Crown, UserX } from "lucide-react";
import { getInitials } from "@/lib/storage";
import type { LiveParticipant } from "@/types/live";

interface Props {
  participants: LiveParticipant[];
  currentParticipantId?: string;
  onKick?: (id: string) => void;
}

export function Leaderboard({ participants, currentParticipantId, onKick }: Props) {
  const sorted = [...participants]
    .filter((p) => !p.is_kicked)
    .sort((a, b) => b.score - a.score || a.joined_at.localeCompare(b.joined_at));

  if (sorted.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">
        Waiting for participants to join...
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      <AnimatePresence initial={false}>
        {sorted.map((p, i) => {
          const isMe = p.id === currentParticipantId;
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
          return (
            <motion.li
              layout
              key={p.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
                isMe
                  ? "border-primary bg-primary/10 shadow-glow"
                  : i === 0
                    ? "border-warning/40 bg-warning/5"
                    : "border-border bg-secondary/40"
              }`}
            >
              <div className="w-7 text-center font-bold text-muted-foreground text-sm">
                {medal || `#${i + 1}`}
              </div>
              <div className="size-9 rounded-full bg-gradient-brand flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                {getInitials(p.display_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                  {p.display_name}
                  {isMe && <span className="text-[10px] text-primary">(you)</span>}
                  {i === 0 && <Crown className="size-3.5 text-warning" />}
                </div>
              </div>
              <div className="font-mono font-bold text-sm tabular-nums">
                {p.score.toLocaleString()}
              </div>
              {onKick && !isMe && (
                <button
                  onClick={() => onKick(p.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Kick participant"
                >
                  <UserX className="size-4" />
                </button>
              )}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
