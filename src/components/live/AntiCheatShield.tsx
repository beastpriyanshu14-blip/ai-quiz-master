import { AlertTriangle, ShieldAlert, WifiOff, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  violations: number;
  maxViolations: number;
  offline: boolean;
  paused: boolean;
  multiTabBlocked: boolean;
  showIdlePrompt: boolean;
  lastViolationMsg?: string | null;
  onDismissIdle: () => void;
  onResumeFullscreen: () => void;
}

export function AntiCheatShield({
  violations,
  maxViolations,
  offline,
  paused,
  multiTabBlocked,
  showIdlePrompt,
  lastViolationMsg,
  onDismissIdle,
  onResumeFullscreen,
}: Props) {
  return (
    <>
      {/* Persistent violation counter */}
      <div className="fixed top-3 right-3 z-40">
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-mono border backdrop-blur-md ${
            violations === 0
              ? "bg-secondary/70 border-border text-muted-foreground"
              : violations < maxViolations
                ? "bg-warning/15 border-warning/40 text-warning"
                : "bg-destructive/15 border-destructive/40 text-destructive"
          }`}
          title="Anti-cheat monitor"
        >
          <ShieldAlert className="size-3.5" />
          Warnings {violations}/{maxViolations}
        </div>
      </div>

      {/* Offline banner */}
      {offline && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-destructive/20 border border-destructive/40 text-destructive px-4 py-1.5 text-xs backdrop-blur-md">
          <WifiOff className="size-3.5" /> Connection lost. Reconnecting…
        </div>
      )}

      {/* Paused / fullscreen exit modal */}
      {paused && !multiTabBlocked && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-sm w-full rounded-3xl border-2 border-warning/40 bg-card p-6 text-center shadow-2xl">
            <AlertTriangle className="size-12 mx-auto text-warning mb-3" />
            <h3 className="text-lg font-display font-bold mb-2">Quiz Paused</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {lastViolationMsg ?? "This quiz must be taken in Fullscreen mode."}
            </p>
            <div className="text-xs mb-4 font-mono text-warning">
              Warnings: {violations}/{maxViolations}
            </div>
            <Button onClick={onResumeFullscreen} className="w-full bg-gradient-brand shadow-glow">
              <Maximize className="size-4 mr-2" /> Resume in Fullscreen
            </Button>
          </div>
        </div>
      )}

      {/* Multi-tab block */}
      {multiTabBlocked && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-sm w-full rounded-3xl border-2 border-destructive/50 bg-card p-6 text-center shadow-2xl">
            <ShieldAlert className="size-12 mx-auto text-destructive mb-3" />
            <h3 className="text-lg font-display font-bold mb-2">Quiz Already Open</h3>
            <p className="text-sm text-muted-foreground">
              This quiz is running in another tab. Answering is disabled here.
            </p>
          </div>
        </div>
      )}

      {/* Idle prompt */}
      {showIdlePrompt && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-sm w-full rounded-3xl border-2 border-primary/40 bg-card p-6 text-center shadow-2xl">
            <div className="text-4xl mb-2">👀</div>
            <h3 className="text-lg font-display font-bold mb-2">Are you still there?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              We'll auto-submit your quiz in 30 seconds without a response.
            </p>
            <Button onClick={onDismissIdle} className="w-full bg-gradient-brand shadow-glow">
              I'm still here
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
