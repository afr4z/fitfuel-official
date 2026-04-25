/**
 * Editable plan configuration.
 *
 * PLAN_CATEGORIES  – each entry becomes a row in the "Choose Your Plan" list.
 * DAY_OPTIONS      – shown as selectable options for subscription duration.
 * MEAL_OPTIONS     – shown as selectable options for meals per day.
 *
 * Price formula:  plan.basePricePerMealPerDay × dayOption.days × mealOption.mealsPerDay
 */

export const PLAN_CATEGORIES = [
  {
    id: "PLAN_WEIGHT_LOSS",
    title: "🔥 Weight Loss",
    description: "Calorie-controlled, high-fibre meals",
    tag: "weight_loss",
    basePricePerMealPerDay: 130,
  },
  {
    id: "PLAN_MUSCLE_GAIN",
    title: "💪 Muscle Gain",
    description: "High-protein meals for strength & size",
    tag: "muscle_gain",
    basePricePerMealPerDay: 150,
  },
  {
    id: "PLAN_KETO",
    title: "🥑 Keto",
    description: "Low-carb, high-fat, zero sugar",
    tag: "keto",
    basePricePerMealPerDay: 160,
  },
  {
    id: "PLAN_DIABETIC",
    title: "🩺 Diabetic-Friendly",
    description: "Low GI, balanced nutrition",
    tag: "diabetic",
    basePricePerMealPerDay: 140,
  },
  {
    id: "PLAN_VEGAN",
    title: "🌱 Vegan",
    description: "100% plant-based, whole foods",
    tag: "vegan",
    basePricePerMealPerDay: 120,
  },
  {
    id: "PLAN_BALANCED",
    title: "⚖️ Balanced",
    description: "Everyday healthy eating, no restrictions",
    tag: "balanced",
    basePricePerMealPerDay: 125,
  },
];

// ─── Duration options ────────────────────────────────────────────────────────
// If you add more than 3 entries the bot will automatically switch from
// buttons to a list message.

export const DAY_OPTIONS = [
  { id: "DAYS_7",  label: "7 Days",  days: 7  },
  { id: "DAYS_14", label: "14 Days", days: 14 },
  { id: "DAYS_30", label: "30 Days", days: 30 },
];

// ─── Meals-per-day options ───────────────────────────────────────────────────
// mealsPerDay is used as the multiplier in the price formula.
// If you add more than 3 entries the bot will automatically switch from
// buttons to a list message.

export const MEAL_OPTIONS = [
  { id: "MEALS_1", label: "🌅 Breakfast only",    mealsPerDay: 1 },
  { id: "MEALS_2", label: "🍽️ Lunch + Dinner",    mealsPerDay: 2 },
  { id: "MEALS_3", label: "🌟 All 3 Meals",        mealsPerDay: 3 },
];
