import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const TTL = 60 * 60 * 24; // 24h

export async function getSession(phone) {
  const data = await redis.get(`session:${phone}`);
  return data || { state: "GREETING", data: {} };
}

export async function setSession(phone, session) {
  await redis.set(`session:${phone}`, session, { ex: TTL });
}

export async function clearSession(phone) {
  await redis.del(`session:${phone}`);
}
