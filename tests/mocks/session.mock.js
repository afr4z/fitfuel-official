const store = new Map();

export function resetSessions() {
  store.clear();
}

// Mirrors the same idle-state set and timeout logic as the real session module
// so tests that manipulate time behave identically.
const IDLE_STATES = new Set(["GREETING", "MAIN_MENU"]);
export const IDLE_TIMEOUT_MS =
  (parseInt(process.env.SESSION_TIMEOUT_MINUTES, 10) || 30) * 60 * 1000;

function isExpired(session) {
  if (IDLE_STATES.has(session.state)) return false;
  if (!session.lastActivityAt) return false;
  return Date.now() - session.lastActivityAt > IDLE_TIMEOUT_MS;
}

export async function getSession(phone) {
  const data = store.get(phone);
  if (!data) return { state: "GREETING", data: {} };
  if (isExpired(data)) {
    store.delete(phone);
    return { state: "GREETING", data: {} };
  }
  return data;
}

export async function setSession(phone, session) {
  store.set(phone, { ...session, lastActivityAt: Date.now() });
}

export async function clearSession(phone) {
  store.delete(phone);
}

// Test helper — inspect session directly (bypasses expiry check)
export function peekSession(phone) {
  return store.get(phone);
}
