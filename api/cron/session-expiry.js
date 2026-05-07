import { sendText } from "../../lib/whatsapp.js";
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
        await sendText(
          phone,
          `⏰ *Your session expired due to inactivity.*\n\nType *hi* to start again!`,
        );
        await markSessionExpired(phone);
        details.push({ phone, status: "notified" });
        console.log(`[SESSION-EXPIRY] Notified + marked expired ${phone}`);
      } catch (err) {
        console.error(`[SESSION-EXPIRY] Failed for ${phone}:`, err.message);
        await markSessionExpired(phone);
        details.push({ phone, status: "failed", error: err.message });
        console.log(`[SESSION-EXPIRY] Marked expired (no notify) ${phone}`);
      }
    }

    const notified = details.filter((d) => d.status === "notified").length;
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const checkedAt = new Date(now.getTime() + istOffset)
      .toISOString()
      .replace("T", " ")
      .replace("Z", " IST");
    return res.status(200).json({ checkedAt, found: phones.length, notified, details });
  } catch (err) {
    console.error("[CRON/session-expiry]", err);
    return res.status(500).json({ error: err.message });
  }
}
