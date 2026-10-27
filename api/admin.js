import { createClient } from "@supabase/supabase-js";
import { sendNotification } from "../lib/sendNotification.js";
import {
  addDeliveryDays,
  countRemainingDeliveryDays,
} from "../lib/deliveryDays.js";
import {
  kitchenClosed,
  subscriptionCancelled,
} from "../bot/config/messages.js";
import { getPlanLabel } from "../bot/config/plans.js";
import { isPastIST, tomorrowDateStrIST } from "../lib/cronUtils.js";
import { safeEqualStrings } from "../lib/timingSafe.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function unauthorized(res) {
  return res.status(401).json({ error: "Unauthorized" });
}

const SLOTS = ["breakfast", "lunch", "dinner"];
const DAYS = [1, 2, 3, 4, 5, 6];
const DAY_LABELS = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

const SLOT_ORDER = { breakfast: 0, lunch: 1, dinner: 2 };
const SUBSCRIPTION_SELECT = `
  id,
  phone,
  plan_type,
  status,
  start_date,
  end_date,
  payment_status,
  razorpay_payment_id,
  created_at,
  customers!meal_plan_subscriptions_customer_id_fkey (name, email),
  meal_plans!meal_plan_subscriptions_meal_plan_id_fkey (name, emoji, tag),
  customer_addresses!meal_plan_subscriptions_address_id_fkey (label, address),
  subscription_slots!subscription_slots_subscription_id_fkey (slot, delivery_time)
`;

function adminRoute(path) {
  if (path.startsWith("/api/admin/")) return path.slice("/api/admin/".length);
  return path.replace(/^\/+/, "");
}

function todayDateStrIST() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value || "",
  );
}

function addDateDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function countDeliveryDays(startDate, endDate, today, closedDates) {
  const first = startDate > today ? startDate : today;
  const d = new Date(first + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  let count = 0;

  while (d <= end) {
    const date = d.toISOString().split("T")[0];
    if (d.getUTCDay() !== 0 && !closedDates.has(date)) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return count;
}

async function remainingDaysForSubscriptions(subs) {
  const today = todayDateStrIST();
  const maxEnd = subs.reduce(
    (latest, sub) => (sub.end_date > latest ? sub.end_date : latest),
    "",
  );
  const closedDates = new Set();

  if (maxEnd) {
    const { data, error } = await supabase
      .from("kitchen_closed_days")
      .select("date")
      .gte("date", today)
      .lte("date", maxEnd);

    if (error) {
      console.error("[ADMIN] Closed-day lookup failed:", error.message);
    } else {
      for (const row of data ?? []) closedDates.add(row.date);
    }
  }

  return Object.fromEntries(
    subs.map((sub) => [
      sub.id,
      sub.status === "active"
        ? countDeliveryDays(sub.start_date, sub.end_date, today, closedDates)
        : 0,
    ]),
  );
}

function normalizeSubscription(sub, remainingDays) {
  const slots = (sub.subscription_slots ?? [])
    .slice()
    .sort((a, b) => (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9));
  const plan = sub.meal_plans;
  const customer = sub.customers;
  const address = sub.customer_addresses;

  return {
    id: sub.id,
    phone: sub.phone,
    customer_name: customer?.name || null,
    customer_email: customer?.email || null,
    plan_name: plan ? `${plan.emoji || "🥗"} ${plan.name}` : "Unknown plan",
    plan_tag: plan?.tag || null,
    plan_type: sub.plan_type,
    plan_label: getPlanLabel(sub.plan_type),
    status: sub.status,
    start_date: sub.start_date,
    end_date: sub.end_date,
    remaining_days: remainingDays,
    slots: slots.map((s) => s.slot),
    delivery_times: Object.fromEntries(
      slots.map((s) => [s.slot, s.delivery_time]),
    ),
    meals_per_day: slots.length,
    payment_status: sub.payment_status,
    razorpay_payment_id: sub.razorpay_payment_id,
    address: address
      ? `${address.label ? `${address.label}: ` : ""}${address.address}`
      : null,
    created_at: sub.created_at,
  };
}

async function buildSubscriptionQuery({ status, plan, q, expiring, from, to }) {
  const today = todayDateStrIST();
  const term = q.replace(/[(),]/g, " ").trim();
  let customerIds = [];

  if (term) {
    const { data: matches } = await supabase
      .from("customers")
      .select("id")
      .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
      .limit(100);
    customerIds = (matches ?? []).map((m) => m.id);
  }

  let query = supabase
    .from("meal_plan_subscriptions")
    .select(SUBSCRIPTION_SELECT, { count: "exact" });

  if (status) query = query.eq("status", status);
  if (plan) query = query.eq("meal_plan_id", plan);

  if (expiring === "1") {
    query = query
      .eq("status", "active")
      .gte("end_date", today)
      .lte("end_date", addDateDays(today, 2));
  }

  if (term) {
    const clauses = [`phone.ilike.%${term}%`];
    if (customerIds.length) {
      clauses.push(`customer_id.in.(${customerIds.join(",")})`);
    }
    query = query.or(clauses.join(","));
  }

  return query.order("created_at", { ascending: false }).range(from, to);
}

async function handleSubscriptions(req, res, url) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit")) || 25),
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await buildSubscriptionQuery({
    status: url.searchParams.get("status") || "",
    plan: url.searchParams.get("plan") || "",
    q: url.searchParams.get("q") || "",
    expiring: url.searchParams.get("expiring") || "",
    from,
    to,
  });

  if (error) {
    console.error("[ADMIN] Subscription list failed:", error.message);
    return res.status(500).json({ error: "Failed to load subscriptions" });
  }

  const remaining = await remainingDaysForSubscriptions(data ?? []);

  return res.status(200).json({
    subscriptions: (data ?? []).map((sub) =>
      normalizeSubscription(sub, remaining[sub.id] ?? 0),
    ),
    total: count ?? 0,
    page,
    limit,
  });
}

async function handleSubscriptionSummary(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const today = todayDateStrIST();
  const soon = addDateDays(today, 2);

  const [activeRes, cancelledRes, todayOrdersRes] = await Promise.all([
    supabase
      .from("meal_plan_subscriptions")
      .select(
        `
        id, end_date,
        meal_plans!meal_plan_subscriptions_meal_plan_id_fkey (name, emoji)
      `,
        { count: "exact" },
      )
      .eq("status", "active")
      .gte("end_date", today),
    supabase
      .from("meal_plan_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "cancelled"),
    supabase
      .from("orders")
      .select("slot")
      .eq("delivery_date", today)
      .neq("status", "cancelled"),
  ]);

  if (activeRes.error || cancelledRes.error || todayOrdersRes.error) {
    console.error(
      "[ADMIN] Subscription summary failed:",
      activeRes.error?.message ||
        cancelledRes.error?.message ||
        todayOrdersRes.error?.message,
    );
    return res.status(500).json({ error: "Failed to load summary" });
  }

  const activeByPlan = {};
  let expiringSoon = 0;

  for (const sub of activeRes.data ?? []) {
    const plan = sub.meal_plans;
    const name = plan ? `${plan.emoji || "🥗"} ${plan.name}` : "Unknown plan";
    activeByPlan[name] = (activeByPlan[name] || 0) + 1;
    if (sub.end_date <= soon) expiringSoon++;
  }

  const todayMeals = { breakfast: 0, lunch: 0, dinner: 0 };
  for (const order of todayOrdersRes.data ?? []) {
    if (todayMeals[order.slot] !== undefined) todayMeals[order.slot]++;
  }

  return res.status(200).json({
    active_total: activeRes.count ?? (activeRes.data ?? []).length,
    active_by_plan: Object.entries(activeByPlan)
      .map(([plan, count]) => ({ plan, count }))
      .sort((a, b) => b.count - a.count || a.plan.localeCompare(b.plan)),
    expiring_soon: expiringSoon,
    cancelled_total: cancelledRes.count ?? 0,
    today_meals: todayMeals,
  });
}

async function handleSubscriptionDetail(req, res, subscriptionId) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isUuid(subscriptionId)) {
    return res.status(400).json({ error: "Invalid subscription id" });
  }

  const { data: sub, error } = await supabase
    .from("meal_plan_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("id", subscriptionId)
    .maybeSingle();

  if (error) {
    console.error("[ADMIN] Subscription detail failed:", error.message);
    return res.status(500).json({ error: "Failed to load subscription" });
  }

  if (!sub) return res.status(404).json({ error: "Subscription not found" });

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(
      "id, delivery_date, slot, item_name, status, delivery_time, petpooja_client_id, created_at",
    )
    .eq("subscription_id", subscriptionId)
    .order("delivery_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (ordersError) {
    console.error("[ADMIN] Subscription orders failed:", ordersError.message);
    return res.status(500).json({ error: "Failed to load order history" });
  }

  const remaining = await remainingDaysForSubscriptions([sub]);
  const sortedOrders = (orders ?? []).slice().sort((a, b) => {
    const dateCompare = b.delivery_date.localeCompare(a.delivery_date);
    if (dateCompare !== 0) return dateCompare;
    return (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9);
  });

  const cancelledFrom =
    (orders ?? [])
      .filter((order) => order.status === "cancelled")
      .sort((a, b) => a.delivery_date.localeCompare(b.delivery_date))[0]
      ?.delivery_date ?? null;

  return res.status(200).json({
    subscription: normalizeSubscription(sub, remaining[sub.id] ?? 0),
    orders: sortedOrders,
    cancelled_from: cancelledFrom,
  });
}

async function handleCancelSubscription(req, res, subscriptionId) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isUuid(subscriptionId)) {
    return res.status(400).json({ error: "Invalid subscription id" });
  }

  const { data: sub, error } = await supabase
    .from("meal_plan_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("id", subscriptionId)
    .maybeSingle();

  if (error) {
    console.error("[ADMIN] Cancel lookup failed:", error.message);
    return res.status(500).json({ error: "Failed to load subscription" });
  }

  if (!sub) return res.status(404).json({ error: "Subscription not found" });
  if (sub.status !== "active") {
    return res
      .status(400)
      .json({ error: "Only active subscriptions can be cancelled" });
  }

  const today = todayDateStrIST();
  const { data: futureOrders, error: ordersError } = await supabase
    .from("orders")
    .select("id, delivery_date, slot, status")
    .eq("subscription_id", subscriptionId)
    .gte("delivery_date", today)
    .order("delivery_date", { ascending: true });

  if (ordersError) {
    console.error("[ADMIN] Cancel order lookup failed:", ordersError.message);
    return res.status(500).json({ error: "Failed to load future orders" });
  }

  const sorted = (futureOrders ?? []).slice().sort((a, b) => {
    const dateCompare = a.delivery_date.localeCompare(b.delivery_date);
    if (dateCompare !== 0) return dateCompare;
    return (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9);
  });

  const dispatchedStatuses = new Set([
    "sent_to_kitchen",
    "accepted",
    "ready",
    "delivered",
  ]);
  const firstCancellable = sorted.find(
    (order) =>
      !["cancelled", "skipped"].includes(order.status) &&
      !dispatchedStatuses.has(order.status),
  );
  const cancelledFrom =
    firstCancellable?.delivery_date || addDateDays(today, 1);
  const orderIdsToCancel = sorted
    .filter(
      (order) =>
        order.delivery_date >= cancelledFrom &&
        ["pending", "confirmed"].includes(order.status),
    )
    .map((order) => order.id);

  if (orderIdsToCancel.length) {
    const { error: cancelOrdersError } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .in("id", orderIdsToCancel);

    if (cancelOrdersError) {
      console.error(
        "[ADMIN] Cancel future orders failed:",
        cancelOrdersError.message,
      );
      return res.status(500).json({ error: "Failed to cancel future orders" });
    }
  }

  const { error: cancelSubError } = await supabase
    .from("meal_plan_subscriptions")
    .update({ status: "cancelled" })
    .eq("id", subscriptionId);

  if (cancelSubError) {
    console.error(
      "[ADMIN] Cancel subscription failed:",
      cancelSubError.message,
    );
    return res.status(500).json({ error: "Failed to cancel subscription" });
  }

  const plan = sub.meal_plans;
  const planLabel = plan
    ? `${plan.emoji || "🥗"} ${plan.name} (${getPlanLabel(sub.plan_type)})`
    : getPlanLabel(sub.plan_type);
  const dispatchedOrders = sorted.filter((order) =>
    ["sent_to_kitchen", "accepted", "ready"].includes(order.status),
  );
  let notificationSent = false;

  try {
    await sendNotification(
      sub.phone,
      process.env.WHATSAPP_CANCELLED_TEMPLATE || "subscription_cancelled",
      [
        { type: "text", text: planLabel },
        { type: "text", text: cancelledFrom },
      ],
      subscriptionCancelled({ planLabel, effectiveDate: cancelledFrom }),
      null,
    );
    notificationSent = true;
  } catch (err) {
    console.error("[ADMIN] Cancellation notification failed:", err.message);
  }

  return res.status(200).json({
    ok: true,
    cancelled_from: cancelledFrom,
    cancelled_orders: orderIdsToCancel.length,
    notification_sent: notificationSent,
    warning: dispatchedOrders.length
      ? `${dispatchedOrders.length} order(s) were already sent to Petpooja. Cancel them in Petpooja too.`
      : null,
  });
}

async function handleSubscriptionsExport(req, res, url) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { data, error } = await buildSubscriptionQuery({
    status: url.searchParams.get("status") || "",
    plan: url.searchParams.get("plan") || "",
    q: url.searchParams.get("q") || "",
    expiring: url.searchParams.get("expiring") || "",
    from: 0,
    to: 4999,
  });

  if (error) {
    console.error("[ADMIN] Subscription export failed:", error.message);
    return res.status(500).json({ error: "Failed to export subscriptions" });
  }

  const remaining = await remainingDaysForSubscriptions(data ?? []);
  const rows = (data ?? []).map((sub) =>
    normalizeSubscription(sub, remaining[sub.id] ?? 0),
  );
  const header = [
    "Customer",
    "Phone",
    "Plan",
    "Duration",
    "Slots",
    "Meals/day",
    "Start",
    "End",
    "Remaining days",
    "Status",
    "Payment",
    "Razorpay payment ID",
    "Address",
  ];
  const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [
    header.map(escapeCsv).join(","),
    ...rows.map((row) =>
      [
        row.customer_name,
        row.phone,
        row.plan_name,
        row.plan_label,
        row.slots.join(" / "),
        row.meals_per_day,
        row.start_date,
        row.end_date,
        row.remaining_days,
        row.status,
        row.payment_status,
        row.razorpay_payment_id,
        row.address,
      ]
        .map(escapeCsv)
        .join(","),
    ),
  ].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="fitfuel-subscriptions-${todayDateStrIST()}.csv"`,
  );
  return res.status(200).send(csv);
}

export default async function handler(req, res) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret) {
    const auth = req.headers["authorization"] ?? "";
    if (!safeEqualStrings(auth, `Bearer ${adminSecret}`))
      return unauthorized(res);
  }

  // Under Vercel's `/api/admin/:path*` rewrite, the route arrives as a `path`
  // query param (`/api/admin.js?path=kitchen-closed`); when invoked directly
  // the full pathname is present. Accept both forms, same as api/auth.js.
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.searchParams.get("path") || url.pathname;
  const route = adminRoute(path);

  // Subscriptions
  if (route === "subscriptions") {
    return handleSubscriptions(req, res, url);
  }
  if (route === "subscriptions/summary") {
    return handleSubscriptionSummary(req, res);
  }
  if (route === "subscriptions/export") {
    return handleSubscriptionsExport(req, res, url);
  }

  const subscriptionCancelMatch = route.match(
    /^subscriptions\/([^/]+)\/cancel$/,
  );
  if (subscriptionCancelMatch) {
    return handleCancelSubscription(req, res, subscriptionCancelMatch[1]);
  }

  const subscriptionDetailMatch = route.match(/^subscriptions\/([^/]+)$/);
  if (subscriptionDetailMatch) {
    return handleSubscriptionDetail(req, res, subscriptionDetailMatch[1]);
  }

  // Kitchen Closed endpoints
  if (path === "/api/admin/kitchen-closed" || path === "kitchen-closed") {
    return handleKitchenClosed(req, res);
  }

  // Plan Defaults endpoints
  if (path === "/api/admin/plan-defaults" || path === "plan-defaults") {
    return handlePlanDefaults(req, res);
  }

  return res.status(404).json({ error: "Not found" });
}

async function handleKitchenClosed(req, res) {
  if (req.method === "GET") {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("kitchen_closed_days")
      .select("date, reason")
      .gte("date", today)
      .order("date");

    if (error) {
      console.error("[KITCHEN-CLOSED] GET error:", error);
      return res.status(500).json({ error: "Failed to fetch closed days" });
    }

    return res.status(200).json({ closedDays: data ?? [] });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { date, reason } = req.body ?? {};

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res
      .status(400)
      .json({ error: "Missing or invalid date (expected YYYY-MM-DD)" });
  }

  const { error: insertError } = await supabase
    .from("kitchen_closed_days")
    .insert({ date, reason: reason ?? null });

  if (insertError) {
    if (insertError.code === "23505") {
      return res
        .status(409)
        .json({ error: "Kitchen already marked as closed on that date" });
    }
    console.error("[KITCHEN-CLOSED] Insert error:", insertError);
    return res.status(500).json({ error: "Failed to mark kitchen as closed" });
  }

  const { data: activeSubs, error: fetchError } = await supabase
    .from("meal_plan_subscriptions")
    .select("id, phone, end_date, start_date")
    .eq("status", "active")
    .gte("end_date", date);

  if (fetchError) {
    console.error("[KITCHEN-CLOSED] Fetch subscriptions error:", fetchError);
    return res
      .status(500)
      .json({ error: "Failed to fetch active subscriptions" });
  }

  const subs = activeSubs ?? [];

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      const newEndStr = addDeliveryDays(sub.end_date, 1);

      const { error: updateError } = await supabase
        .from("meal_plan_subscriptions")
        .update({ end_date: newEndStr })
        .eq("id", sub.id);

      if (updateError) {
        console.error(
          `[KITCHEN-CLOSED] Failed to extend sub ${sub.id}:`,
          updateError,
        );
        return;
      }

      const remaining = await countRemainingDeliveryDays(
        sub.start_date,
        newEndStr,
      );
      const reasonLine = reason ? `\nReason: _${reason}_\n` : "\n";

      const templateParams = [
        { type: "text", text: date },
        {
          type: "text",
          text: reasonLine.replace(/\n/g, " ").replace(/_/g, ""),
        },
        { type: "text", text: remaining.toString() },
      ];

      await sendNotification(
        sub.phone,
        process.env.WHATSAPP_KITCHEN_CLOSED_TEMPLATE || "kitchen_closed",
        templateParams,
        kitchenClosed({ date, reasonLine, remaining }),
        null,
      );
    }),
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    console.error(`[KITCHEN-CLOSED] ${failed.length} notifications failed`);
  }

  return res.status(200).json({
    date,
    extended: subs.length,
    failed: failed.length,
  });
}

async function handlePlanDefaults(req, res) {
  if (req.method === "GET") {
    const tomorrow = tomorrowDateStrIST();
    const isLocked = isPastIST(19, 45);

    const [plansRes, dishesRes, weeklyRes, nextDayRes] = await Promise.all([
      supabase
        .from("meal_plans")
        .select("id, name, tag, emoji")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("dishes")
        .select("id, meal_plan_id, name, is_veg, price")
        .eq("is_available", true)
        .order("name"),
      supabase
        .from("weekly_meal_schedule")
        .select("plan_id, day_of_week, slot, dish_id"),
      supabase
        .from("next_day_meals")
        .select("plan_id, date, slot, dish_id")
        .eq("date", tomorrow),
    ]);

    if (plansRes.error)
      return res.status(500).json({ error: plansRes.error.message });
    if (dishesRes.error)
      return res.status(500).json({ error: dishesRes.error.message });
    if (weeklyRes.error)
      return res.status(500).json({ error: weeklyRes.error.message });
    if (nextDayRes.error)
      return res.status(500).json({ error: nextDayRes.error.message });

    const weeklyIndex = {};
    for (const w of weeklyRes.data) {
      weeklyIndex[`${w.plan_id}:${w.day_of_week}:${w.slot}`] = w.dish_id;
    }

    const nextDayIndex = {};
    for (const n of nextDayRes.data) {
      nextDayIndex[`${n.plan_id}:${n.slot}`] = n.dish_id;
    }

    const plans = plansRes.data.map((p) => ({
      id: p.id,
      name: `${p.emoji || "🥗"} ${p.name}`,
      tag: p.tag,
      dishes: dishesRes.data
        .filter((d) => d.meal_plan_id === p.id)
        .map((d) => ({
          id: d.id,
          name: d.name,
          is_veg: d.is_veg,
          price: d.price,
        })),
      week: Object.fromEntries(
        DAYS.map((dow) => [
          dow,
          Object.fromEntries(
            SLOTS.map((slot) => [
              slot,
              weeklyIndex[`${p.id}:${dow}:${slot}`] || null,
            ]),
          ),
        ]),
      ),
      nextDay: Object.fromEntries(
        SLOTS.map((slot) => [slot, nextDayIndex[`${p.id}:${slot}`] || null]),
      ),
    }));

    return res.status(200).json({
      plans,
      dayLabels: DAY_LABELS,
      slots: SLOTS,
      tomorrow,
      locked: isLocked,
    });
  }

  if (req.method === "POST") {
    const { type, plan_id, day_of_week, slot, dish_id, date } = req.body ?? {};

    if (!plan_id || !slot || !type) {
      return res
        .status(400)
        .json({ error: "type, plan_id, and slot are required" });
    }

    if (!SLOTS.includes(slot)) {
      return res.status(400).json({ error: "Invalid slot" });
    }

    if (type === "weekly") {
      if (![1, 2, 3, 4, 5, 6].includes(day_of_week)) {
        return res
          .status(400)
          .json({ error: "Invalid day_of_week for weekly schedule" });
      }

      if (dish_id) {
        const { error: upsertErr } = await supabase
          .from("weekly_meal_schedule")
          .upsert(
            { plan_id, day_of_week, slot, dish_id },
            { onConflict: "plan_id,day_of_week,slot" },
          );

        if (upsertErr) {
          console.error("[ADMIN] Weekly upsert failed:", upsertErr.message);
          return res.status(500).json({ error: "Failed to save" });
        }
      } else {
        return res
          .status(400)
          .json({ error: "dish_id is required for weekly schedule" });
      }

      return res.status(200).json({ ok: true, type: "weekly" });
    }

    if (type === "nextday") {
      if (isPastIST(19, 45)) {
        return res
          .status(403)
          .json({ error: "Tomorrow's menu is locked after 7:45pm IST" });
      }

      const targetDate = date || tomorrowDateStrIST();

      if (dish_id) {
        const { error: upsertErr } = await supabase
          .from("next_day_meals")
          .upsert(
            { plan_id, date: targetDate, slot, dish_id },
            { onConflict: "plan_id,date,slot" },
          );

        if (upsertErr) {
          console.error("[ADMIN] Nextday upsert failed:", upsertErr.message);
          return res.status(500).json({ error: "Failed to save" });
        }
      } else {
        const { error: deleteErr } = await supabase
          .from("next_day_meals")
          .delete()
          .eq("plan_id", plan_id)
          .eq("date", targetDate)
          .eq("slot", slot);

        if (deleteErr) {
          console.error("[ADMIN] Nextday delete failed:", deleteErr.message);
          return res.status(500).json({ error: "Failed to clear" });
        }
      }

      return res.status(200).json({ ok: true, type: "nextday" });
    }

    return res
      .status(400)
      .json({ error: 'Invalid type — must be "weekly" or "nextday"' });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
