import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const TTL = 60 * 60 * 24;
const IDLE_TIMEOUT_MS =
  (parseInt(process.env.SESSION_TIMEOUT_MINUTES, 10) || 5) * 60 * 1000;
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
    // Delete the stale session but tell the router WHY
    await redis.del(`session:${phone}`);
    return { state: "SESSION_EXPIRED", data: {} };
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
