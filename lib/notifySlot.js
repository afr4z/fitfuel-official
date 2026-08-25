import { createClient } from "@supabase/supabase-js";
import { sendButtons } from "./whatsapp.js";
import { countRemainingDeliveryDays } from "./deliveryDays.js";
import {
  buildExpiryNotice,
  breakfastHeader,
  slotHeader,
  slotItemLine,
  DEADLINE_BREAKFAST,
  DEADLINE_LUNCH_NOTIFICATION,
  DEADLINE_DINNER_NOTIFICATION,
  rescheduledMeal,
} from "../bot/config/messages.js";
import {
  deliveryDateForSlot,
  checkSkipped,
  fetchSlotSubscriptions,
  ensureOrder,
  SLOT_LABELS,
} from "./cronUtils.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SLOT_EMOJI = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
};

export default async function notifySlot(slot) {
  const deliveryDate = deliveryDateForSlot(slot);
  const skipped = await checkSkipped(deliveryDate);
  if (skipped) {
    console.log(`[${slot}] Skipping — ${skipped}`);
    return { skipped, delivery_date: deliveryDate };
  }

  const { data: subs, error } = await fetchSlotSubscriptions(slot, deliveryDate);
  if (error) {
    console.error(`[${slot}] DB error:`, error);
    throw error;
  }

  const activeSubs = subs ?? [];
  console.log(`[${slot}] ${activeSubs.length} subscribers for ${deliveryDate}`);

  const results = await Promise.allSettled(
    activeSubs.map(async (sub) => {
      const slotRow = sub.subscription_slot?.[0];
      if (!slotRow) return;

      const order = await ensureOrder(
        sub.id,
        slotRow.id,
        sub.phone,
        sub.meal_plan_id,
        deliveryDate,
        slot,
        slotRow.delivery_time,
      );

      await supabase
        .from("orders")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", order.id);

      const daysLeft = await countRemainingDeliveryDays(sub.start_date, sub.end_date);
      const expiryNotice = buildExpiryNotice(daysLeft, true);
      const emoji = SLOT_EMOJI[slot] || "🍽️";
      const slotLabel = SLOT_LABELS[slot] || slot;
      const itemLine = slotItemLine({ emoji, slotLabel, itemName: order.item_name });

      const timeStr = order.delivery_time?.slice(0, 5) || "";
      const header = slot === "breakfast"
        ? breakfastHeader({ deliveryDate })
        : slotHeader({ slotLabel, deliveryDate });

      let deadlineMsg;
      if (slot === "breakfast") {
        deadlineMsg = DEADLINE_BREAKFAST;
      } else if (slot === "lunch") {
        deadlineMsg = DEADLINE_LUNCH_NOTIFICATION;
      } else {
        deadlineMsg = DEADLINE_DINNER_NOTIFICATION;
      }

      await sendButtons(
        sub.phone,
        `${header}${itemLine}${timeStr ? ` (${timeStr})` : ""}\n\n${deadlineMsg}${expiryNotice}`,
        [
          { id: `CONFIRM_${order.id}`, title: "✅ Confirm" },
          { id: `CHANGE_${order.id}`, title: "🔄 Change" },
          { id: `SKIP_${order.id}`, title: "⏭️ Skip" },
        ],
      );

      console.log(`[${slot}] Notified ${sub.phone}`);
    }),
  );

  const failed = results.filter((r) => r.status === "rejected");

  let pushedCount = 0;
  const { data: dayOrders } = await supabase
    .from("orders")
    .select("*, meal_plan_subscriptions!inner(end_date)")
    .eq("slot", slot)
    .eq("delivery_date", deliveryDate)
    .eq("status", "pending");

  for (const ord of dayOrders || []) {
    if (ord.delivery_date <= ord.meal_plan_subscriptions.end_date) continue;

    try {
      await sendButtons(
        ord.phone,
        rescheduledMeal({
          slotLabel: SLOT_LABELS[slot] || slot,
          slotEmoji: SLOT_EMOJI[slot] || "🍽️",
          itemName: ord.item_name,
        }),
        [
          { id: `CONFIRM_${ord.id}`, title: "✅ Confirm" },
          { id: `CHANGE_${ord.id}`, title: "🔄 Change" },
          { id: `SKIP_${ord.id}`, title: "⏭️ Skip" },
        ],
      );

      await supabase
        .from("orders")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", ord.id);

      pushedCount++;
      console.log(`[${slot}] Notified pushed order ${ord.id} for ${ord.phone}`);
    } catch (err) {
      console.error(`[${slot}] Pushed-order notify failed for ${ord.id}:`, err.message);
    }
  }

  return {
    delivery_date: deliveryDate,
    processed: activeSubs.length,
    pushed: pushedCount,
    failed: failed.length,
  };
}
