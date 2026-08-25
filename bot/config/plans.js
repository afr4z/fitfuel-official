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
 *
 * Price formula:  plan.basePricePerMealPerDay × dayOption.days × mealOption.mealsPerDay
 *
 * User-facing messages live in ./messages.js.
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
