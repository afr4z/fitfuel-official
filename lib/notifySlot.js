import { createClient } from "@supabase/supabase-js";
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
import { sendNotification } from "./sendNotification.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SLOT_EMOJI = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
};

const TEMPLATE_NAMES = {
  breakfast: "breakfast_notification",
  lunch: "lunch_notification",
  dinner: "dinner_notification",
  rescheduled: "rescheduled_meal",
};

function buildBody(slot, header, itemLine, timeStr, deadlineMsg, expiryNotice) {
  return `${header}${itemLine}${timeStr ? ` (${timeStr})` : ""}\n\n${deadlineMsg}${expiryNotice}`;
}

function buildRescheduledBody(slot, slotLabel, slotEmoji, itemName) {
  return rescheduledMeal({ slotLabel, slotEmoji, itemName });
}

function getTemplateParams(slot, header, itemLine, timeStr, deadlineMsg, expiryNotice) {
  return [
    { type: "text", text: header.replace(/\*/g, "") },
    { type: "text", text: itemLine },
    { type: "text", text: timeStr },
    { type: "text", text: deadlineMsg },
    { type: "text", text: expiryNotice },
  ];
}

function getRescheduledParams(slot, slotLabel, slotEmoji, itemName) {
  return [
    { type: "text", text: slotLabel },
    { type: "text", text: slotEmoji },
    { type: "text", text: itemName || "Your meal" },
  ];
}

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

      const fallbackBody = buildBody(slot, header, itemLine, timeStr, deadlineMsg, expiryNotice);
      const fallbackButtons = [
        { id: `CONFIRM_${order.id}`, title: "✅ Confirm" },
        { id: `CHANGE_${order.id}`, title: "🔄 Change" },
        { id: `SKIP_${order.id}`, title: "⏭️ Skip" },
      ];
      const templateParams = getTemplateParams(slot, header, itemLine, timeStr, deadlineMsg, expiryNotice);

      await sendNotification(
        sub.phone,
        TEMPLATE_NAMES[slot],
        templateParams,
        fallbackBody,
        fallbackButtons,
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
      const slotLabel = SLOT_LABELS[slot] || slot;
      const slotEmoji = SLOT_EMOJI[slot] || "🍽️";
      const itemName = ord.item_name;

      const fallbackBody = buildRescheduledBody(slot, slotLabel, slotEmoji, itemName);
      const fallbackButtons = [
        { id: `CONFIRM_${ord.id}`, title: "✅ Confirm" },
        { id: `CHANGE_${ord.id}`, title: "🔄 Change" },
        { id: `SKIP_${ord.id}`, title: "⏭️ Skip" },
      ];
      const templateParams = getRescheduledParams(slot, slotLabel, slotEmoji, itemName);

      await sendNotification(
        ord.phone,
        TEMPLATE_NAMES.rescheduled,
        templateParams,
        fallbackBody,
        fallbackButtons,
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