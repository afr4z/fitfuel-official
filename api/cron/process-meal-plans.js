import { createClient } from "@supabase/supabase-js";
import { sendButtons } from "../../lib/whatsapp.js";
import { countRemainingDeliveryDays } from "../../lib/deliveryDays.js";
import { buildExpiryNotice } from "../../bot/config/plans.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SLOT_LABELS = {
  breakfast: "🌅 Breakfast",
  lunch: "☀️ Lunch",
  dinner: "🌙 Dinner",
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers["authorization"] ?? "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const deliveryDate = tomorrow.toISOString().split("T")[0];

  const deliveryDateObj = new Date(deliveryDate + "T00:00:00Z");
  if (deliveryDateObj.getUTCDay() === 0) {
    console.log(`[CRON] Tomorrow (${deliveryDate}) is Sunday — kitchen closed, skipping`);
    return res.status(200).json({ skipped: "sunday" });
  }

  const { data: kitchenClosed } = await supabase
    .from("kitchen_closed_days")
    .select("reason")
    .eq("date", deliveryDate)
    .maybeSingle();

  if (kitchenClosed) {
    console.log(`[CRON] Kitchen closed on ${deliveryDate} — skipping`);
    return res.status(200).json({ skipped: "kitchen_closed" });
  }

  console.log(`[CRON] Processing meal plans for delivery on ${deliveryDate}`);

  const { data: subs, error } = await supabase
    .from("meal_plan_subscriptions")
    .select(`
      id, phone, start_date, end_date,
      subscription_slot:subscription_slots (*)
    `)
    .eq("status", "active")
    .gte("end_date", deliveryDate);

  if (error) {
    console.error("[CRON] DB fetch error:", error);
    return res.status(500).json({ error });
  }

  const activeSubs = subs ?? [];
  console.log(`[CRON] Found ${activeSubs.length} active subscribers`);

  const results = await Promise.allSettled(
    activeSubs.map(async (sub) => {
      const phone = sub.phone;
      const slots = sub.subscription_slot ?? [];
      if (slots.length === 0) return;

      const createdOrders = [];

      for (const slotRow of slots) {
        const { data: existing } = await supabase
          .from("orders")
          .select("id")
          .eq("slot_id", slotRow.id)
          .eq("delivery_date", deliveryDate)
          .maybeSingle();

        if (existing) continue;

        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            subscription_id: sub.id,
            slot_id: slotRow.id,
            phone,
            delivery_date: deliveryDate,
            slot: slotRow.slot,
            delivery_time: slotRow.delivery_time,
            item_id: slotRow.default_item_id,
            item_name: slotRow.default_item_name,
            is_default: true,
            status: "pending",
          })
          .select()
          .single();

        if (orderError) {
          console.error(`[CRON] Failed to create order for ${phone} ${slotRow.slot}:`, orderError);
        } else {
          createdOrders.push(order);
        }
      }

      if (createdOrders.length === 0) return;

      const mealLines = createdOrders.map(
        (o) => `${SLOT_LABELS[o.slot] || o.slot}: *${o.item_name || "Default meal"}* (${o.delivery_time?.slice(0, 5) || "—"})`,
      ).join("\n");

      const daysLeft = countRemainingDeliveryDays(sub.start_date, sub.end_date);
      const expiryNotice = buildExpiryNotice(daysLeft, true);

      await sendButtons(
        phone,
        `🍽️ *Tomorrow's Meals (${deliveryDate})*\n\n${mealLines}\n\n` +
          `You have until *midnight* to make changes.` +
          expiryNotice,
        [
          { id: `CONFIRM_ALL_${sub.id}`, title: "✅ Confirm All" },
          { id: `CHANGE_ORDER_${sub.id}`, title: "🔄 Change" },
          { id: `SKIP_ALL_${sub.id}`, title: "⏭️ Skip All" },
        ],
      );

      const orderIds = createdOrders.map((o) => o.id);
      await supabase
        .from("orders")
        .update({ notified_at: new Date().toISOString() })
        .in("id", orderIds);

      console.log(`[CRON] Notified ${phone} — ${createdOrders.length} meal(s)`);
    }),
  );

  const { error: expireError } = await supabase
    .from("meal_plan_subscriptions")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("end_date", deliveryDate);

  if (expireError) {
    console.error("[CRON] Failed to mark expired subscriptions:", expireError);
  }

  const failed = results.filter((r) => r.status === "rejected");
  return res.status(200).json({
    delivery_date: deliveryDate,
    processed: activeSubs.length,
    failed: failed.length,
  });
}
