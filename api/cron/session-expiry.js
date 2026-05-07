import { sendText } from "../../lib/whatsapp.js";
import { findExpiredSessions, deleteSession } from "../../bot/session.js";

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

    let notified = 0;
    for (const phone of phones) {
      try {
        await sendText(
          phone,
          `⏰ *Your session expired due to inactivity.*\n\nType *hi* to start again!`,
        );
        await deleteSession(phone);
        notified++;
        console.log(`[SESSION-EXPIRY] Notified + cleaned up ${phone}`);
      } catch (err) {
        console.error(`[SESSION-EXPIRY] Failed for ${phone}:`, err.message);
      }
    }

    return res.status(200).json({ found: phones.length, notified });
  } catch (err) {
    console.error("[CRON/session-expiry]", err);
    return res.status(500).json({ error: err.message });
  }
}
