import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const TTL = 60 * 60 * 24;
const ACTIVITY_SET_KEY = "session:activity";
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

  if (data.state === "SESSION_EXPIRED") {
    await redis.del(`session:${phone}`);
    return { state: "SESSION_EXPIRED", data: {} };
  }

  if (isExpired(data)) {
    await redis.del(`session:${phone}`);
    return { state: "SESSION_EXPIRED", data: {} };
  }

  return data;
}

export async function setSession(phone, session) {
  const stamped = { ...session, lastActivityAt: Date.now() };
  await redis.set(`session:${phone}`, stamped, { ex: TTL });
  await redis.zadd(ACTIVITY_SET_KEY, { score: Date.now(), member: phone });
}

export async function clearSession(phone) {
  await redis.del(`session:${phone}`);
  await redis.zrem(ACTIVITY_SET_KEY, phone);
}

export async function deleteSession(phone) {
  await redis.del(`session:${phone}`);
  await redis.zrem(ACTIVITY_SET_KEY, phone);
}

export async function markSessionExpired(phone) {
  const session = await redis.get(`session:${phone}`);
  if (!session) return;
  const stamped = { ...session, state: "SESSION_EXPIRED", lastActivityAt: Date.now() };
  await redis.set(`session:${phone}`, stamped, { ex: TTL });
  await redis.zadd(ACTIVITY_SET_KEY, { score: Date.now(), member: phone });
}

export async function findExpiredSessions() {
  const cutoff = Date.now() - IDLE_TIMEOUT_MS;
  const candidatePhones = await redis.zrange(
    ACTIVITY_SET_KEY,
    "-inf",
    cutoff,
    { byScore: true },
  );

  if (!candidatePhones || candidatePhones.length === 0) return [];

  const expired = [];
  for (const phone of candidatePhones) {
    const session = await redis.get(`session:${phone}`);
    if (!session) continue;
    if (isExpired(session)) {
      expired.push(phone);
    }
  }

  return expired;
}
