// Helpers for live quiz hosting (room codes, tokens, scoring, local persistence)

const HOST_KEY = "quizmaster_host_tokens"; // { [roomId]: token }
const PARTICIPANT_KEY = "quizmaster_participant_tokens"; // { [roomId]: { token, name, participantId } }

export function generateRoomCode(): string {
  // 6-char uppercase alphanumeric, ambiguous chars removed
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Speed-weighted scoring: 500 base + up to 500 bonus the faster you answer. */
export function calcPoints(isCorrect: boolean, timeTakenMs: number, totalMs: number): number {
  if (!isCorrect) return 0;
  const ratio = Math.max(0, Math.min(1, 1 - timeTakenMs / Math.max(1, totalMs)));
  return Math.round(500 + 500 * ratio);
}

// --- Host token persistence ---
function readHostMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(HOST_KEY) || "{}");
  } catch {
    return {};
  }
}
export function saveHostToken(roomId: string, token: string) {
  const map = readHostMap();
  map[roomId] = token;
  localStorage.setItem(HOST_KEY, JSON.stringify(map));
}
export function getHostToken(roomId: string): string | null {
  return readHostMap()[roomId] ?? null;
}

// --- Participant token persistence ---
interface ParticipantEntry {
  token: string;
  name: string;
  participantId: string;
}
function readPartMap(): Record<string, ParticipantEntry> {
  try {
    return JSON.parse(localStorage.getItem(PARTICIPANT_KEY) || "{}");
  } catch {
    return {};
  }
}
export function saveParticipant(roomId: string, entry: ParticipantEntry) {
  const map = readPartMap();
  map[roomId] = entry;
  localStorage.setItem(PARTICIPANT_KEY, JSON.stringify(map));
}
export function getParticipant(roomId: string): ParticipantEntry | null {
  return readPartMap()[roomId] ?? null;
}
