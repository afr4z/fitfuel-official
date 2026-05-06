import { createClient } from "@supabase/supabase-js";
import { sendButtons } from "../../lib/whatsapp.js";
import { countRemainingDeliveryDays } from "../../lib/deliveryDays.js";
import { getPlanLabel } from "../../bot/config/plans.js";

// --- Clients ------------------------------------------------------------------

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// --- Handler ------------------------------------------------------------------

/**
 * GET /api/cron/expiry-reminder
 *
 * Vercel Cron Job — runs once per day and sends a WhatsApp reminder to every
 * active subscriber whose plan has exactly 2 delivery days remaining.
 *
 * Secured via CRON_SECRET (Vercel automatically sends
 * `Authorization: Bearer <secret>` on every cron invocation).
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify the cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers["authorization"] ?? "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const today = new Date().toISOString().split("T")[0];

  // Skip Sundays — the kitchen is closed, no deliveries to remind about
  const todayDate = new Date(today + "T00:00:00Z");
  if (todayDate.getUTCDay() === 0) {
    console.log(`[EXPIRY-REMINDER] Sunday — skipping`);
    return res.status(200).json({ skipped: "sunday" });
  }

  console.log(`[EXPIRY-REMINDER] Running for date=${today}`);

  // Fetch all active subscriptions whose end_date falls within the next 7
  // calendar days (wide enough to always include the 2-delivery-day window,
  // even accounting for Sundays).
  const windowEnd = new Date(today + "T00:00:00Z");
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 7);
  const windowEndStr = windowEnd.toISOString().split("T")[0];

  const { data: subs, error } = await supabase
    .from("meal_plan_subscriptions")
    .select("id, phone, plan_type, end_date")
    .eq("status", "active")
    .gte("end_date", today)
    .lte("end_date", windowEndStr);

  if (error) {
    console.error("[EXPIRY-REMINDER] DB fetch error:", error);
    return res.status(500).json({ error });
  }

  // Filter to exactly 2 remaining delivery days
  const targets = (subs ?? []).filter(
    (sub) => countRemainingDeliveryDays(sub.end_date) === 2,
  );

  console.log(`[EXPIRY-REMINDER] ${targets.length} subscriber(s) to remind`);

  const results = await Promise.allSettled(
    targets.map(async (sub) => {
      const planLabel = getPlanLabel(sub.plan_type);
      await sendButtons(
        sub.phone,
        `⏳ *Your FitFuel plan is almost over!*\n\n` +
          `Your *${planLabel} plan* has only *2 delivery days* remaining.\n\n` +
          `Don't miss your healthy streak — renew now to keep your meals coming! 🥗`,
        [
          { id: "ORDER_NOW", title: "🔄 Renew Plan" },
          { id: "CONTACT_US", title: "📞 Contact Us" },
        ],
      );
      console.log(`[EXPIRY-REMINDER] Reminded ${sub.phone} (${planLabel})`);
    }),
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    console.error(`[EXPIRY-REMINDER] ${failed.length} notification(s) failed`);
  }

  return res.status(200).json({ reminded: targets.length, failed: failed.length });
}
