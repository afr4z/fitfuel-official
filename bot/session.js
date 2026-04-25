import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const TTL = 60 * 60 * 24; // 24h Redis key expiry

// How long (ms) an in-progress session stays valid without activity.
// Override with SESSION_TIMEOUT_MINUTES env var (default: 30).
const IDLE_TIMEOUT_MS =
  (parseInt(process.env.SESSION_TIMEOUT_MINUTES, 10) || 30) * 60 * 1000;

// States considered "at rest" — no timeout needed because the user has
// finished a flow or hasn't started one yet.
const IDLE_STATES = new Set(["GREETING", "MAIN_MENU"]);

function isExpired(session) {
  if (IDLE_STATES.has(session.state)) return false;
  if (!session.lastActivityAt) return false;
  return Date.now() - session.lastActivityAt > IDLE_TIMEOUT_MS;
}

export async function getSession(phone) {
  const data = await redis.get(`session:${phone}`);
  if (!data) return { state: "GREETING", data: {} };
  if (isExpired(data)) {
    await redis.del(`session:${phone}`);
    return { state: "GREETING", data: {} };
  }
  return data;
}

export async function setSession(phone, session) {
  const stamped = { ...session, lastActivityAt: Date.now() };
  await redis.set(`session:${phone}`, stamped, { ex: TTL });
}

export async function clearSession(phone) {
  await redis.del(`session:${phone}`);
}
