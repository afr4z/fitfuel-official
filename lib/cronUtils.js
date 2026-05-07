import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SLOT_LABELS = {
  breakfast: "🌅 Breakfast",
  lunch: "☀️ Lunch",
  dinner: "🌙 Dinner",
};

const SLOT_DELIVERY_TIMES = {
  breakfast: "08:00:00",
  lunch: "12:30:00",
  dinner: "19:30:00",
};

function toIST(t) {
  return new Date(t.getTime() + 5.5 * 60 * 60 * 1000);
}

function todayDateStrIST() {
  return toIST(new Date()).toISOString().split("T")[0];
}

export function tomorrowDateStrIST() {
  const d = toIST(new Date());
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

function dayOfWeekIST(dateStr) {
  return new Date(dateStr + "T00:00:00Z").getUTCDay();
}

export function deliveryDateForSlot(slot) {
  if (slot === "breakfast") return tomorrowDateStrIST();
  return todayDateStrIST();
}

export function acceptUntilUTC(slot) {
  const now = new Date();
  const d = new Date(now);
  switch (slot) {
    case "breakfast":
      d.setUTCHours(16, 30, 0, 0);
      break;
    case "lunch":
      d.setUTCHours(4, 0, 0, 0);
      break;
    case "dinner":
      d.setUTCHours(11, 30, 0, 0);
      break;
  }
  return d.toISOString();
}

export function isPastIST(hour, minute) {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const totalMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return totalMinutes >= hour * 60 + minute;
}

export function acceptDeadline(hoursFromNow = 1) {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d.toISOString();
}

export async function checkSkipped(deliveryDate) {
  const dow = dayOfWeekIST(deliveryDate);
  if (dow === 0) return "sunday";

  const { data: closed } = await supabase
    .from("kitchen_closed_days")
    .select("reason")
    .eq("date", deliveryDate)
    .maybeSingle();

  return closed ? "kitchen_closed" : null;
}

export async function fetchSlotSubscriptions(slot, deliveryDate) {
  return supabase
    .from("meal_plan_subscriptions")
    .select(`
      id, phone, meal_plan_id, start_date, end_date,
      subscription_slot:subscription_slots!inner(id, slot, delivery_time)
    `)
    .eq("status", "active")
    .gte("end_date", deliveryDate)
    .eq("subscription_slots.slot", slot);
}

export async function fetchDefaultDish(mealPlanId, deliveryDate, slot) {
  const dow = dayOfWeekIST(deliveryDate);
  if (dow === 0) return null;

  const { data: nextDay } = await supabase
    .from("next_day_meals")
    .select("dish_id, dishes!inner(name)")
    .eq("plan_id", mealPlanId)
    .eq("date", deliveryDate)
    .eq("slot", slot)
    .maybeSingle();

  if (nextDay) {
    return { id: nextDay.dish_id, name: nextDay.dishes?.name || null };
  }

  const { data: weekly } = await supabase
    .from("weekly_meal_schedule")
    .select("dish_id, dishes!inner(name)")
    .eq("plan_id", mealPlanId)
    .eq("day_of_week", dow)
    .eq("slot", slot)
    .maybeSingle();

  if (!weekly) return null;
  return {
    id: weekly.dish_id,
    name: weekly.dishes?.name || null,
  };
}

export async function createOrder({
  subscriptionId,
  slotId,
  phone,
  deliveryDate,
  slot,
  deliveryTime,
  itemId,
  itemName,
  acceptUntil,
}) {
  return supabase
    .from("orders")
    .insert({
      subscription_id: subscriptionId,
      slot_id: slotId,
      phone,
      delivery_date: deliveryDate,
      slot,
      delivery_time: deliveryTime,
      item_id: itemId,
      item_name: itemName,
      is_default: true,
      status: "pending",
      accept_until: acceptUntil,
    })
    .select()
    .single();
}

export async function orderExists(slotId, deliveryDate) {
  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("slot_id", slotId)
    .eq("delivery_date", deliveryDate)
    .maybeSingle();
  return !!data;
}

export async function getExistingOrder(slotId, deliveryDate) {
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("slot_id", slotId)
    .eq("delivery_date", deliveryDate)
    .maybeSingle();
  return data || null;
}

export async function autoFillNextDay(deliveryDate) {
  const dow = dayOfWeekIST(deliveryDate);
  if (dow === 0) return { skipped: "sunday" };

  const { data: closed } = await supabase
    .from("kitchen_closed_days")
    .select("id")
    .eq("date", deliveryDate)
    .maybeSingle();
  if (closed) return { skipped: "kitchen_closed" };

  const { data: plans } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("is_active", true);

  if (!plans || plans.length === 0) return { filled: 0 };

  let filled = 0;
  for (const plan of plans) {
    for (const slot of ["breakfast", "lunch", "dinner"]) {
      const { data: existing } = await supabase
        .from("next_day_meals")
        .select("id")
        .eq("plan_id", plan.id)
        .eq("date", deliveryDate)
        .eq("slot", slot)
        .maybeSingle();

      if (existing) continue;

      const defaultDish = await fetchDefaultDish(plan.id, deliveryDate, slot);
      if (!defaultDish) continue;

      const { error } = await supabase
        .from("next_day_meals")
        .insert({
          plan_id: plan.id,
          date: deliveryDate,
          slot,
          dish_id: defaultDish.id,
        });

      if (!error) filled++;
    }
  }

  return { filled };
}

export async function commitOrders(deliveryDate) {
  const skipped = await checkSkipped(deliveryDate);
  if (skipped) return { skipped, delivery_date: deliveryDate, created: 0 };

  const { data: subs } = await supabase
    .from("meal_plan_subscriptions")
    .select(`
      id, phone, meal_plan_id,
      subscription_slots!inner(id, slot, delivery_time)
    `)
    .eq("status", "active")
    .gte("end_date", deliveryDate);

  const activeSubs = subs ?? [];
  let created = 0;

  for (const sub of activeSubs) {
    const slots = sub.subscription_slots ?? [];
    for (const slotRow of slots) {
      if (await orderExists(slotRow.id, deliveryDate)) continue;

      const defaultDish = await fetchDefaultDish(sub.meal_plan_id, deliveryDate, slotRow.slot);
      const acceptUntil = acceptUntilUTC(slotRow.slot);

      const { error } = await createOrder({
        subscriptionId: sub.id,
        slotId: slotRow.id,
        phone: sub.phone,
        deliveryDate,
        slot: slotRow.slot,
        deliveryTime: slotRow.delivery_time,
        itemId: defaultDish?.id ?? null,
        itemName: defaultDish?.name ?? null,
        acceptUntil,
      });

      if (!error) created++;
    }
  }

  return { delivery_date: deliveryDate, created };
}

export async function ensureOrder(subscriptionId, slotId, phone, mealPlanId, deliveryDate, slot, deliveryTime, acceptUntilOverride) {
  const existing = await getExistingOrder(slotId, deliveryDate);
  if (existing) return existing;

  const defaultDish = await fetchDefaultDish(mealPlanId, deliveryDate, slot);
  const acceptUntil = acceptUntilOverride || acceptUntilUTC(slot);

  const { data: order, error } = await createOrder({
    subscriptionId,
    slotId,
    phone,
    deliveryDate,
    slot,
    deliveryTime,
    itemId: defaultDish?.id ?? null,
    itemName: defaultDish?.name ?? null,
    acceptUntil,
  });

  if (error) throw error;
  return order;
}

export { SLOT_LABELS };
