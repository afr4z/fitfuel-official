import { createClient } from "@supabase/supabase-js";
import { sendButtons } from "../../lib/whatsapp.js";
import { countRemainingDeliveryDays } from "../../lib/deliveryDays.js";

// --- Clients ------------------------------------------------------------------

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// --- Slot Config --------------------------------------------------------------

const SLOT_LABELS = {
  breakfast: "🌅 Breakfast",
  lunch: "☀️ Lunch",
  dinner: "🌙 Dinner",
};

const SLOT_CUTOFF_MINUTES = {
  breakfast: 30,
  lunch: 60,
  dinner: 60,
};

// --- Handler ------------------------------------------------------------------

/**
 * GET /api/cron/process-meal-plans?slot=breakfast|lunch|dinner
 *
 * Vercel Cron Job — processes a meal-plan slot by creating today's orders
 * and sending WhatsApp notifications to active subscribers.
 *
 * Secured via CRON_SECRET (Vercel automatically sends
 * `Authorization: Bearer <secret>` on every cron invocation).
 */
export default async function handler(req, res) {
  // Only allow GET (Vercel cron uses GET)
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

  const slot = req.query.slot;

  if (!slot || !["breakfast", "lunch", "dinner"].includes(slot)) {
    return res.status(400).json({ error: "Invalid or missing slot query param" });
  }

  const today = new Date().toISOString().split("T")[0];

  // Skip Sundays — the kitchen is closed
  const todayDate = new Date(today + "T00:00:00Z");
  if (todayDate.getUTCDay() === 0) {
    console.log(`[CRON] Sunday — kitchen closed, no deliveries today`);
    return res.status(200).json({ skipped: "sunday" });
  }

  console.log(`[CRON] Processing slot=${slot} date=${today}`);

  // Check if today is a manually-marked kitchen-closed day
  const { data: kitchenClosed } = await supabase
    .from("kitchen_closed_days")
    .select("reason")
    .eq("date", today)
    .maybeSingle();

  if (kitchenClosed) {
    console.log(`[CRON] Kitchen closed today (${today}) — skipping`);
    return res.status(200).json({ skipped: "kitchen_closed" });
  }

  // 1. Fetch all active subscription slots that include this slot
  const { data: slots, error } = await supabase
    .from("subscription_slots")
    .select(
      `
      *,
      meal_plan_subscriptions!inner (
        id,
        phone,
        status,
        end_date,
        plan_type
      )
    `,
    )
    .eq("slot", slot)
    .eq("meal_plan_subscriptions.status", "active")
    .gte("meal_plan_subscriptions.end_date", today);

  if (error) {
    console.error("[CRON] DB fetch error:", error);
    return res.status(500).json({ error });
  }

  const activeSlots = slots ?? [];
  console.log(`[CRON] Found ${activeSlots.length} active ${slot} subscribers`);

  // 2. Process each subscriber
  const results = await Promise.allSettled(
    activeSlots.map(async (slotRow) => {
      const sub = slotRow.meal_plan_subscriptions;
      const phone = sub.phone;

      // 2a. Check if order already exists for today (avoid duplicates on retry)
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("slot_id", slotRow.id)
        .eq("delivery_date", today)
        .single();

      if (existing) {
        console.log(
          `[CRON] Order already exists for ${phone} ${slot} ${today} — skipping`,
        );
        return;
      }

      // 2b. Create today's order with default meal
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          subscription_id: sub.id,
          slot_id: slotRow.id,
          phone,
          delivery_date: today,
          slot,
          delivery_time: slotRow.delivery_time,
          item_id: slotRow.default_item_id,
          item_name: slotRow.default_item_name,
          is_default: true,
          status: "pending",
        })
        .select()
        .single();

      if (orderError) {
        console.error(
          `[CRON] Failed to create order for ${phone}:`,
          orderError,
        );
        return;
      }

      // 2c. Count remaining delivery days (non-Sunday days from today to end_date)
      const daysLeft = countRemainingDeliveryDays(sub.end_date);

      // 2d. Build expiry notice
      let expiryNotice = "";
      if (daysLeft === 1) {
        expiryNotice =
          `\n\n🚨 *This is your last delivery day!* Reply with any message to renew your plan.`;
      } else if (daysLeft <= 3) {
        expiryNotice =
          `\n\n⚠️ Your plan expires in *${daysLeft}* delivery day(s)! Reply with any message to renew.`;
      }

      // 2e. Send WhatsApp notification, then record the timestamp
      const slotLabel = SLOT_LABELS[slot];
      const cutoffMins = SLOT_CUTOFF_MINUTES[slot];
      const mealName = slotRow.default_item_name || "your default meal";

      await sendButtons(
        phone,
        `${slotLabel} is coming up! 🍽️\n\n` +
          `*Today's meal:* ${mealName}\n` +
          `*Delivery at:* ${slotRow.delivery_time}\n\n` +
          `You have ${cutoffMins} mins to change your meal, or we'll deliver the default.` +
          expiryNotice,
        [
          { id: `CONFIRM_${order.id}`, title: "✅ Looks good" },
          { id: `CHANGE_${order.id}`, title: "🔄 Change meal" },
          { id: `SKIP_${order.id}`, title: "⏭️ Skip today" },
        ],
      );

      await supabase
        .from("orders")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", order.id);

      console.log(`[CRON] Notified ${phone} for ${slot}`);
    }),
  );

  // 3. Log any failures
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    console.error(`[CRON] ${failed.length} notifications failed`);
  }

  // 4. Mark expired subscriptions
  const { error: expireError } = await supabase
    .from("meal_plan_subscriptions")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("end_date", today);

  if (expireError) {
    console.error("[CRON] Failed to mark expired subscriptions:", expireError);
  }

  return res.status(200).json({
    slot,
    processed: activeSlots.length,
    failed: failed.length,
  });
}
