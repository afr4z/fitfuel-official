const PLAN_TYPE_DAYS = {
  "3day": 3,
  weekly: 7,
  biweekly: 14,
  monthly: 28,
};

export function todayDateStrIST(now = new Date()) {
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}

function timeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ""));
  if (!match) return 24 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

function countNonSundayDays(startDate, endDate) {
  const d = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  let count = 0;
  while (d <= end) {
    if (d.getUTCDay() !== 0) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

/**
 * Counts meals whose scheduled delivery time has passed.
 *
 * The plan total is based on the paid plan duration and the number of slots,
 * not the calendar span, so kitchen-closed-day extensions do not inflate it.
 *
 * @param {object} sub Active subscription with subscription_slots.
 * @param {Array<object>} orders Orders for that subscription up to today.
 * @param {Date} [now] Injectable clock for tests.
 * @returns {{ completed_meals: number, total_meals: number, progress: number }}
 */
export function calculateMealProgress(sub, orders, now = new Date()) {
  const totalDays =
    PLAN_TYPE_DAYS[sub.plan_type] ??
    countNonSundayDays(sub.start_date, sub.end_date);
  const mealsPerDay = (sub.subscription_slots ?? []).length;
  const totalMeals = totalDays * mealsPerDay;

  if (!totalMeals) {
    return { completed_meals: 0, total_meals: 0, progress: 0 };
  }

  const today = todayDateStrIST(now);
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const nowMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const seen = new Set();
  let completed = 0;

  for (const order of orders ?? []) {
    if (order.subscription_id !== sub.id) continue;
    if (order.status === "cancelled") continue;
    if (order.delivery_date < sub.start_date) continue;
    if (order.delivery_date > today) continue;

    const key = `${order.delivery_date}:${order.slot}`;
    if (seen.has(key)) continue;

    const delivered =
      order.delivery_date < today ||
      timeToMinutes(order.delivery_time) <= nowMinutes;
    if (delivered) {
      seen.add(key);
      completed++;
    }
  }

  const completedMeals = Math.min(completed, totalMeals);
  return {
    completed_meals: completedMeals,
    total_meals: totalMeals,
    progress: Math.round((completedMeals / totalMeals) * 100),
  };
}
