const store = new Map();

export function resetSessions() {
  store.clear();
}

export async function getSession(phone) {
  return store.get(phone) || { state: "GREETING", data: {} };
}

export async function setSession(phone, session) {
  store.set(phone, session);
}

export async function clearSession(phone) {
  store.delete(phone);
}

// Test helper — inspect session directly
export function peekSession(phone) {
  return store.get(phone);
}
