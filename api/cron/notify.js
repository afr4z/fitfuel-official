import notifySlot from "../../lib/notifySlot.js";

/**
 * GET /api/cron/notify
 *
 * Sends the meal notification for one slot. This replaces the three identical
 * `notify-{breakfast,lunch,dinner}.js` functions: the Hobby plan caps a
 * deployment at 12 serverless functions, so the three are folded into one.
 *
 * The slot comes from `?slot=` when given (manual runs, and the legacy paths
 * `/api/cron/notify-{breakfast,lunch,dinner}` which rewrite here). Scheduled
 * runs share this path and are told apart by Vercel's
 * `x-vercel-cron-schedule` header, which is why each schedule is mapped below.
 */

const SLOT_BY_SCHEDULE = {
  "30 14 * * *": "breakfast",
  "0 3 * * *": "lunch",
  "30 10 * * *": "dinner",
};

const SLOTS = ["breakfast", "lunch", "dinner"];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[CRON/notify] CRON_SECRET is not configured — refusing to send");
    return res.status(500).json({ error: "Cron is not configured" });
  }

  const auth = req.headers["authorization"] ?? "";
  if (auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const schedule = String(req.headers["x-vercel-cron-schedule"] ?? "").trim();
  const slot = req.query?.slot || SLOT_BY_SCHEDULE[schedule];

  if (!SLOTS.includes(slot)) {
    return res.status(400).json({
      error: "Invalid or missing slot",
      schedule: schedule || null,
    });
  }

  try {
    const result = await notifySlot(slot);
    return res.status(200).json({ slot, ...result });
  } catch (err) {
    console.error(`[CRON/${slot}]`, err);
    return res.status(500).json({ error: err.message });
  }
}
