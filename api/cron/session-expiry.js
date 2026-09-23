import { sendNotification } from "../../lib/sendNotification.js";
import { findExpiredSessions, clearSession } from "../../bot/session.js";
import { SESSION_EXPIRED } from "../../bot/config/messages.js";

export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers["authorization"] ?? "";
    if (auth !== `Bearer ${secret}`)
      return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const phones = await findExpiredSessions();

    const details = [];
    for (const phone of phones) {
      try {
        await sendNotification(
          phone,
          process.env.WHATSAPP_SESSION_EXPIRED_TEMPLATE || "session_expired",
          [],
          SESSION_EXPIRED,
          null,
        );
        await clearSession(phone);
        details.push({ phone, status: "notified" });
      } catch (err) {
        console.error(`[SESSION-EXPIRY] Failed for ${phone}:`, err.message);
        try {
          await clearSession(phone);
          details.push({
            phone,
            status: "cleared-no-notify",
            error: err.message,
          });
        } catch {
          details.push({ phone, status: "failed", error: err.message });
        }
      }
    }

    const notified = details.filter((d) => d.status === "notified").length;
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const checkedAt = new Date(now.getTime() + istOffset)
      .toISOString()
      .replace("T", " ")
      .replace("Z", " IST");
    return res
      .status(200)
      .json({ checkedAt, found: phones.length, notified, details });
  } catch (err) {
    console.error("[CRON/session-expiry]", err);
    return res.status(500).json({ error: err.message });
  }
}
