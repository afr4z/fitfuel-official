import { sendText, sendButtons } from "./whatsapp.js";
import { safeEqualStrings } from "./timingSafe.js";

/**
 * Internal WhatsApp sender used by the VPS dispatch service.
 *
 * Reached via the `/api/notify` rewrite, which points at `api/webhook.js` with
 * `?route=notify`. It lives here rather than in its own `api/` file because the
 * Hobby plan caps a deployment at 12 serverless functions and the project is
 * already at the limit.
 *
 * Body (JSON): { to: string, body: string, buttons?: { id, title }[] }
 *
 * Fail-closed: without a configured CRON_SECRET this refuses to send rather
 * than becoming an open WhatsApp relay.
 */
export async function handleNotify(req, res) {
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
