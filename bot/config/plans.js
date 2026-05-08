/**
 * Editable plan configuration.
 *
 * Plan categories are now fetched from the `meal_plans` Supabase table via lib/mealPlans.js.
 * DAY_OPTIONS        – shown as selectable options for subscription duration.
 * MEAL_OPTIONS       – shown as selectable options for meals per day.
 * PLAN_TYPE_LABELS   – human-readable labels for plan_type values stored in DB.
 *
 * Helpers:
 *   getPlanLabel(planType)          – returns the display label for a plan_type.
 *   buildExpiryNotice(daysLeft)     – returns an expiry warning string (or "").
 *   SUNDAY_HOLIDAY_NOTE             – disclaimer shown during duration selection.
 *
 * Price formula:  plan.basePricePerMealPerDay × dayOption.days × mealOption.mealsPerDay
 */

/** Maps the plan_type stored in meal_plan_subscriptions to a display label. */
export const PLAN_TYPE_LABELS = {
  "3day": "3-Day",
  weekly: "7-Day",
  biweekly: "14-Day",
  monthly: "30-Day",
};

/** Returns a human-readable label for a plan_type, falling back to the raw value. */
export function getPlanLabel(planType) {
  return PLAN_TYPE_LABELS[planType] ?? planType;
}

/**
 * Returns an expiry-warning string when the plan is ending soon, or "" otherwise.
 * Used in meal-slot cron notifications, greeting, and plan-detail messages.
 *
 * @param {number} daysLeft  Remaining delivery days (from countRemainingDeliveryDays).
 * @param {boolean} [inline] When true, prefixes a newline for inline use in longer strings.
 */
export function buildExpiryNotice(daysLeft, inline = false) {
  const prefix = inline ? "\n\n" : "";
  const threshold = parseInt(process.env.RENEWAL_THRESHOLD_DAYS, 10) || 2;
  if (daysLeft === 1) {
    return `${prefix}🚨 *This is your last delivery day!* Tap *Renew Plan* below to continue.`;
  }
  if (daysLeft <= threshold) {
    return `${prefix}⚠️ Your plan expires in *${daysLeft}* delivery day(s)! Tap *Renew Plan* below to continue.`;
  }
  return "";
}

/** Disclaimer appended to the duration-selection message. */
export const SUNDAY_HOLIDAY_NOTE =
  `_Note: Sundays are a kitchen holiday — no deliveries on Sundays. ` +
  `Your plan will be extended by a day for every Sunday it falls on, ` +
  `so you always get the full number of delivery days you pay for._`;

// ─── Duration options ────────────────────────────────────────────────────────
// If you add more than 3 entries the bot will automatically switch from
// buttons to a list message.

export const DAY_OPTIONS = [
  { id: "DAYS_3", label: "3 Days", days: 3 },
  { id: "DAYS_7", label: "7 Days", days: 7 },
  { id: "DAYS_14", label: "14 Days", days: 14 },
  { id: "DAYS_30", label: "30 Days", days: 30 },
];
// ─── Meals-per-day options ───────────────────────────────────────────────────
// mealsPerDay is used as the multiplier in the price formula.
// If you add more than 3 entries the bot will automatically switch from
// buttons to a list message.

export const MEAL_OPTIONS = [
  { id: "MEALS_1", label: "🌅 Breakfast only", mealsPerDay: 1 },
  { id: "MEALS_2", label: "🍽️ Lunch + Dinner", mealsPerDay: 2 },
  { id: "MEALS_3", label: "🌟 All 3 Meals", mealsPerDay: 3 },
];
