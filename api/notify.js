import { sendText, sendButtons } from "../lib/whatsapp.js";
import { safeEqualStrings } from "../lib/timingSafe.js";

/**
 * POST /api/notify
 *
 * Sends a WhatsApp message on behalf of a trusted internal caller (the VPS
 * dispatch service). Protected by CRON_SECRET.
 *
 * Body (JSON):
 *   { to: string, body: string, buttons?: { id: string, title: string }[] }
 *
 * This endpoint was deleted in c90116c (2026-09-19), which silently broke the
 * "Meal Dispatched" notification: the VPS kept POSTing here and every call
 * returned 404. Restored here, and made fail-closed — without a configured
 * secret it refuses to send rather than becoming an open WhatsApp relay.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[NOTIFY] CRON_SECRET is not configured — refusing to send");
    return res.status(500).json({ error: "Notify is not configured" });
  }

  const authHeader = req.headers["authorization"] ?? "";
  if (!safeEqualStrings(authHeader, `Bearer ${cronSecret}`)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { to, body, buttons } = req.body ?? {};

  if (!to || !body) {
    return res.status(400).json({ error: "Missing required fields: to, body" });
  }

  try {
    if (Array.isArray(buttons) && buttons.length > 0) {
      await sendButtons(to, body, buttons);
    } else {
      await sendText(to, body);
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[NOTIFY] Failed to send message:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
