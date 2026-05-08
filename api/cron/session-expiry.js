import { findExpiredSessions, markSessionExpired } from "../../bot/session.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers["authorization"] ?? "";
    if (auth !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const phones = await findExpiredSessions();
    console.log(`[SESSION-EXPIRY] Found ${phones.length} expired session(s)`);

    const details = [];
    for (const phone of phones) {
      try {
        await markSessionExpired(phone);
        details.push({ phone, status: "marked" });
        console.log(`[SESSION-EXPIRY] Marked expired ${phone}`);
      } catch (err) {
        details.push({ phone, status: "failed", error: err.message });
        console.error(`[SESSION-EXPIRY] Failed for ${phone}:`, err.message);
      }
    }

    const marked = details.filter((d) => d.status === "marked").length;
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const checkedAt = new Date(now.getTime() + istOffset)
      .toISOString()
      .replace("T", " ")
      .replace("Z", " IST");
    return res.status(200).json({ checkedAt, found: phones.length, marked, details });
  } catch (err) {
    console.error("[CRON/session-expiry]", err);
    return res.status(500).json({ error: err.message });
  }
}
