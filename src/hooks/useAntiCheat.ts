import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type ViolationType =
  | "fullscreen_exit"
  | "tab_switch"
  | "window_blur"
  | "devtools"
  | "copy"
  | "right_click"
  | "shortcut"
  | "print_screen"
  | "resize"
  | "multi_tab"
  | "idle"
  | "network"
  | "auto_click"
  | "bot_pattern";

export interface AntiCheatEvent {
  type: ViolationType | "quiz_started" | "question_changed" | "answer_selected" | "quiz_submitted" | "refresh";
  ts: number;
  questionIndex?: number;
  meta?: Record<string, unknown>;
}

interface Options {
  enabled: boolean;
  roomId: string;
  participantId: string;
  questionIndex: number;
  maxViolations?: number;
  idleMs?: number;
  idleGraceMs?: number;
  onTerminate: (reason: string) => void;
  onViolation?: (type: ViolationType, count: number) => void;
  onLogEvent?: (event: AntiCheatEvent) => void;
  onPauseChange?: (paused: boolean) => void;
}

const CH_NAME = (roomId: string) => `quizmaster_ac_${roomId}`;
const LS_TAB_KEY = (roomId: string) => `quizmaster_ac_tab_${roomId}`;

export function useAntiCheat({
  enabled,
  roomId,
  participantId,
  questionIndex,
  maxViolations = 3,
  idleMs = 120_000,
  idleGraceMs = 30_000,
  onTerminate,
  onViolation,
  onLogEvent,
  onPauseChange,
}: Options) {
  const [violations, setViolations] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showIdlePrompt, setShowIdlePrompt] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [multiTabBlocked, setMultiTabBlocked] = useState(false);
  const [lastViolation, setLastViolation] = useState<{ type: ViolationType; msg: string } | null>(null);

  const terminatedRef = useRef(false);
  const violationsRef = useRef(0);
  const clickTimesRef = useRef<number[]>([]);
  const idleTimerRef = useRef<number | null>(null);
  const idleGraceTimerRef = useRef<number | null>(null);
  const tabIdRef = useRef<string>(Math.random().toString(36).slice(2));

  const log = useCallback((e: AntiCheatEvent) => {
    onLogEvent?.({ ...e, ts: Date.now() });
  }, [onLogEvent]);

  const doPause = useCallback((p: boolean) => {
    setPaused(p);
    onPauseChange?.(p);
  }, [onPauseChange]);

  const terminate = useCallback((reason: string) => {
    if (terminatedRef.current) return;
    terminatedRef.current = true;
    log({ type: "quiz_submitted", ts: Date.now(), meta: { reason } });
    onTerminate(reason);
  }, [log, onTerminate]);

  const record = useCallback((type: ViolationType, msg: string, weight = 1) => {
    if (!enabled || terminatedRef.current) return;
    violationsRef.current += weight;
    const count = violationsRef.current;
    setViolations(count);
    setLastViolation({ type, msg });
    log({ type, ts: Date.now(), questionIndex });
    onViolation?.(type, count);
    if (count >= maxViolations) {
      terminate(`Auto-submitted after ${count} violations (${type})`);
    }
  }, [enabled, questionIndex, log, onViolation, maxViolations, terminate]);

  const requestFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* user gesture required — will retry on next interaction */
    }
  }, []);

  // ---- Multi-tab detection (BroadcastChannel + localStorage fallback) ----
  useEffect(() => {
    if (!enabled) return;
    const existing = localStorage.getItem(LS_TAB_KEY(roomId));
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(CH_NAME(roomId));
    } catch { /* older browsers */ }

    const claim = () => {
      localStorage.setItem(LS_TAB_KEY(roomId), tabIdRef.current);
      bc?.postMessage({ type: "claim", tabId: tabIdRef.current });
    };

    // Announce presence
    bc?.postMessage({ type: "hello", tabId: tabIdRef.current });

    // If another tab existed, ask it to respond
    const helloTimer = window.setTimeout(claim, 300);

    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as { type: string; tabId: string };
      if (data.tabId === tabIdRef.current) return;
      if (data.type === "hello") {
        // Another tab appeared — we are the older one, tell them
        bc?.postMessage({ type: "already_here", tabId: tabIdRef.current });
      } else if (data.type === "already_here") {
        // We are the newcomer
        setMultiTabBlocked(true);
        record("multi_tab", "This quiz is already open in another tab.");
      } else if (data.type === "claim") {
        // Race lost — become the blocked one
        if (localStorage.getItem(LS_TAB_KEY(roomId)) !== tabIdRef.current) {
          setMultiTabBlocked(true);
          record("multi_tab", "This quiz is already open in another tab.");
        }
      }
    };
    bc?.addEventListener("message", onMessage);

    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_TAB_KEY(roomId) && e.newValue && e.newValue !== tabIdRef.current) {
        // A newer tab claimed — but we're older, reclaim
        claim();
      }
    };
    window.addEventListener("storage", onStorage);

    if (!existing) claim();

    return () => {
      window.clearTimeout(helloTimer);
      bc?.removeEventListener("message", onMessage);
      bc?.close();
      window.removeEventListener("storage", onStorage);
      if (localStorage.getItem(LS_TAB_KEY(roomId)) === tabIdRef.current) {
        localStorage.removeItem(LS_TAB_KEY(roomId));
      }
    };
  }, [enabled, roomId, record]);

  // ---- Fullscreen ----
  useEffect(() => {
    if (!enabled) return;
    void requestFullscreen();
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        doPause(true);
        record("fullscreen_exit", "You exited fullscreen. Please return to continue.");
        // Retry after brief delay
        window.setTimeout(() => { void requestFullscreen(); }, 800);
      } else {
        doPause(false);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [enabled, requestFullscreen, doPause, record]);

  // ---- Tab / focus detection ----
  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        record("tab_switch", `Tab switch detected. Warning ${violationsRef.current + 1}/${maxViolations}`);
      }
    };
    const onBlur = () => {
      // Small debounce so devtools focus doesn't double-count with visibility
      window.setTimeout(() => {
        if (!document.hasFocus() && document.visibilityState === "visible") {
          record("window_blur", "Window lost focus.");
        }
      }, 150);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, maxViolations, record]);

  // ---- Copy / right-click / selection / drag ----
  useEffect(() => {
    if (!enabled) return;
    const block = (e: Event, type: ViolationType, msg: string) => {
      e.preventDefault();
      record(type, msg, 0); // log but don't count toward auto-submit
      toast.warning(msg);
    };
    const onCopy = (e: Event) => block(e, "copy", "Copying is disabled during the quiz.");
    const onContext = (e: Event) => block(e, "right_click", "Right-click is disabled during the quiz.");
    const onSelect = (e: Event) => e.preventDefault();
    const onDrag = (e: Event) => e.preventDefault();
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("selectstart", onSelect);
    document.addEventListener("dragstart", onDrag);

    // Apply CSS user-select none
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("selectstart", onSelect);
      document.removeEventListener("dragstart", onDrag);
      document.body.style.userSelect = prev;
    };
  }, [enabled, record]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      let blocked = false;
      if (k === "F12") blocked = true;
      else if (ctrl && shift && ["I", "J", "C"].includes(k.toUpperCase())) blocked = true;
      else if (ctrl && ["u", "s", "p", "a", "c", "x"].includes(k.toLowerCase())) {
        // Note: "c"/"x" also caught by copy handler; block here too for select-then-key
        blocked = true;
      }
      if (k === "PrintScreen") {
        record("print_screen", "Screenshots are discouraged during the quiz.", 0);
        toast.warning("Screenshots are discouraged during the quiz.");
      }
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        record("shortcut", "Developer tools and shortcuts are disabled during the quiz.", 0);
        toast.warning("That shortcut is disabled during the quiz.");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled, record]);

  // ---- DevTools detection (size-diff heuristic) ----
  useEffect(() => {
    if (!enabled) return;
    let opened = false;
    const check = () => {
      const threshold = 170;
      const widthGap = window.outerWidth - window.innerWidth > threshold;
      const heightGap = window.outerHeight - window.innerHeight > threshold;
      const isOpen = widthGap || heightGap;
      if (isOpen && !opened) {
        opened = true;
        record("devtools", "Developer tools detected. Please close them.");
      } else if (!isOpen) {
        opened = false;
      }
    };
    const id = window.setInterval(check, 1200);
    return () => window.clearInterval(id);
  }, [enabled, record]);

  // ---- Resize (split-screen heuristic) ----
  useEffect(() => {
    if (!enabled) return;
    let flagged = false;
    const onResize = () => {
      if (window.innerWidth < 480 && window.innerWidth > 0) {
        if (!flagged) {
          flagged = true;
          record("resize", "Split-screen / small window detected.");
        }
      } else {
        flagged = false;
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [enabled, record]);

  // ---- Idle detection ----
  const armIdle = useCallback(() => {
    if (!enabled) return;
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    if (idleGraceTimerRef.current) window.clearTimeout(idleGraceTimerRef.current);
    setShowIdlePrompt(false);
    idleTimerRef.current = window.setTimeout(() => {
      setShowIdlePrompt(true);
      idleGraceTimerRef.current = window.setTimeout(() => {
        record("idle", "No response — auto-submitting.");
        terminate("Inactive too long");
      }, idleGraceMs);
    }, idleMs);
  }, [enabled, idleMs, idleGraceMs, record, terminate]);

  useEffect(() => {
    if (!enabled) return;
    const events = ["mousemove", "keydown", "touchstart", "click"];
    const reset = () => armIdle();
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    armIdle();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      if (idleGraceTimerRef.current) window.clearTimeout(idleGraceTimerRef.current);
    };
  }, [enabled, armIdle]);

  const dismissIdle = useCallback(() => {
    setShowIdlePrompt(false);
    armIdle();
  }, [armIdle]);

  // ---- Network ----
  useEffect(() => {
    if (!enabled) return;
    const onOnline = () => { setOffline(false); toast.success("Reconnected"); };
    const onOffline = () => {
      setOffline(true);
      record("network", "Connection lost. Reconnecting…", 0);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [enabled, record]);

  // ---- beforeunload ----
  useEffect(() => {
    if (!enabled) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [enabled]);

  // ---- Anti auto-click / bot pattern ----
  const trackClick = useCallback((e?: { isTrusted?: boolean }) => {
    if (!enabled) return;
    if (e && e.isTrusted === false) {
      record("bot_pattern", "Synthetic event detected.");
      return;
    }
    const now = Date.now();
    const arr = clickTimesRef.current;
    arr.push(now);
    if (arr.length > 6) arr.shift();
    if (arr.length >= 2) {
      const gap = now - arr[arr.length - 2];
      if (gap < 300) {
        record("auto_click", "Suspiciously fast interaction detected.", 0);
      }
    }
    if (arr.length >= 4) {
      const gaps = arr.slice(1).map((t, i) => t - arr[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const variance = gaps.reduce((a, b) => a + (b - avg) ** 2, 0) / gaps.length;
      if (avg > 0 && variance < 20) {
        record("bot_pattern", "Automated interaction pattern detected.", 0);
      }
    }
  }, [enabled, record]);

  // ---- Question change log ----
  useEffect(() => {
    if (!enabled) return;
    log({ type: "question_changed", ts: Date.now(), questionIndex });
  }, [enabled, questionIndex, log]);

  return {
    violations,
    maxViolations,
    paused,
    offline,
    multiTabBlocked,
    showIdlePrompt,
    lastViolation,
    dismissIdle,
    requestFullscreen,
    trackClick,
    terminated: terminatedRef.current,
    participantId,
  };
}
