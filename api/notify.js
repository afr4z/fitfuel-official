import { sendText, sendButtons } from "../lib/whatsapp.js";

/**
 * POST /api/notify
 *
 * Sends a WhatsApp message. Protected by CRON_SECRET to prevent unauthorized use.
 *
 * Body (JSON):
 *   { to: string, body: string, buttons?: { id: string, title: string }[] }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify shared secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers["authorization"] ?? "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const { to, body, buttons } = req.body ?? {};

  if (!to || !body) {
    return res.status(400).json({ error: "Missing required fields: to, body" });
  }

  try {
    if (buttons && Array.isArray(buttons) && buttons.length > 0) {
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
