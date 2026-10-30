import { sendText, sendButtons } from "../lib/whatsapp.js";
import { sendNotification } from "../lib/sendNotification.js";
import { safeEqualStrings } from "../lib/timingSafe.js";

/**
 * POST /api/notify
 *
 * Sends a WhatsApp message on behalf of a trusted internal caller — the VPS
 * dispatch service, which posts here when Petpooja marks an order `ready`.
 *
 * Body (JSON):
 *   { to: string, body: string, buttons?: { id, title }[],
 *     slot?: "breakfast"|"lunch"|"dinner", item?: string }
 *
 * When `slot` and `item` are present the message is sent through
 * `sendNotification`, which tries the free-form text first and falls back to
 * the `meal_dispatched` template on error 131047 (re-engagement required).
 * Free-form text is only delivered inside the 24-hour customer service window,
 * so without that fallback a dispatch notice silently disappears for anyone
 * who has not messaged recently.
 *
 * This endpoint was deleted in c90116c (2026-09-19), which silently broke the
 * "Meal Dispatched" notification: the VPS kept posting here and every call
 * returned 404 until it was restored. Fail-closed: without a configured
 * CRON_SECRET it refuses to send rather than acting as an open WhatsApp relay.
 */

const DISPATCH_TEMPLATE =
  process.env.WHATSAPP_DISPATCH_TEMPLATE || "meal_dispatched";

// The template was approved as en_US; sending it as "en" returns 132001.
const DISPATCH_TEMPLATE_LANG =
  process.env.WHATSAPP_DISPATCH_TEMPLATE_LANG || "en_US";

const SLOT_LABEL = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

function dispatchParams(slot, item) {
  return [
    {
      type: "text",
      parameter_name: "meal_slot",
      text: SLOT_LABEL[slot] || "Meal",
    },
    {
      type: "text",
      parameter_name: "dish_name",
      text: item,
    },
  ];
}

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

  const { to, body, buttons, slot, item } = req.body ?? {};

  if (!to || !body) {
    return res.status(400).json({ error: "Missing required fields: to, body" });
  }

  try {
    if (slot && item) {
      await sendNotification(
        to,
        DISPATCH_TEMPLATE,
        dispatchParams(slot, item),
        body,
        undefined,
        DISPATCH_TEMPLATE_LANG,
      );
    } else if (Array.isArray(buttons) && buttons.length > 0) {
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
