import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

export const DEFAULT_DELIVERY_SETTINGS = {
  freeKm: envNumber("DELIVERY_FREE_KM", 3),
  standardPerMeal: envNumber("DELIVERY_STANDARD_PER_MEAL", 20),
  longPlanPerMeal: envNumber("DELIVERY_LONG_PLAN_PER_MEAL", 15),
  longPlanMinDays: envNumber("DELIVERY_LONG_PLAN_MIN_DAYS", 20),
  unknownPolicy:
    process.env.DELIVERY_UNKNOWN_POLICY === "free" ? "free" : "charge",
};

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeDeliverySettings(row = {}) {
  const defaults = DEFAULT_DELIVERY_SETTINGS;
  return {
    freeKm: roundMoney(Math.max(0, finiteOr(row.free_km, defaults.freeKm))),
    standardPerMeal: roundMoney(
      Math.max(0, finiteOr(row.standard_per_meal, defaults.standardPerMeal)),
    ),
    longPlanPerMeal: roundMoney(
      Math.max(0, finiteOr(row.long_plan_per_meal, defaults.longPlanPerMeal)),
    ),
    longPlanMinDays: Math.max(
      1,
      Math.round(finiteOr(row.long_plan_min_days, defaults.longPlanMinDays)),
    ),
    unknownPolicy: row.unknown_policy === "free" ? "free" : "charge",
  };
}

export function publicDeliveryConfig(settings = DEFAULT_DELIVERY_SETTINGS) {
  return {
    freeKm: settings.freeKm,
    standardPerMeal: settings.standardPerMeal,
    longPlanPerMeal: settings.longPlanPerMeal,
    longPlanMinDays: settings.longPlanMinDays,
    unknownPolicy: settings.unknownPolicy,
  };
}

export async function getDeliverySettings() {
  const { data, error } = await supabase
    .from("delivery_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    console.error("[DELIVERY] Settings lookup failed:", error.message);
    return { ...DEFAULT_DELIVERY_SETTINGS };
  }

  return normalizeDeliverySettings(data || DEFAULT_DELIVERY_SETTINGS);
}

export function validateDeliverySettings(input = {}) {
  const freeKm = Number(input.freeKm ?? input.free_km);
  const standardPerMeal = Number(
    input.standardPerMeal ?? input.standard_per_meal,
  );
  const longPlanPerMeal = Number(
    input.longPlanPerMeal ?? input.long_plan_per_meal,
  );
  const longPlanMinDays = Number(
    input.longPlanMinDays ?? input.long_plan_min_days,
  );
  const unknownPolicy = input.unknownPolicy ?? input.unknown_policy ?? "charge";

  if (!Number.isFinite(freeKm) || freeKm < 0 || freeKm > 100) {
    throw new Error("Free delivery radius must be between 0 and 100 km");
  }
  if (
    !Number.isFinite(standardPerMeal) ||
    standardPerMeal < 0 ||
    standardPerMeal > 10000
  ) {
    throw new Error("Standard delivery charge must be between ₹0 and ₹10,000");
  }
  if (
    !Number.isFinite(longPlanPerMeal) ||
    longPlanPerMeal < 0 ||
    longPlanPerMeal > 10000
  ) {
    throw new Error("Long-plan delivery charge must be between ₹0 and ₹10,000");
  }
  if (
    !Number.isInteger(longPlanMinDays) ||
    longPlanMinDays < 1 ||
    longPlanMinDays > 365
  ) {
    throw new Error("Long-plan threshold must be between 1 and 365 days");
  }
  if (!["charge", "free"].includes(unknownPolicy)) {
    throw new Error("Unknown-address policy must be charge or free");
  }

  return {
    freeKm: roundMoney(freeKm),
    standardPerMeal: roundMoney(standardPerMeal),
    longPlanPerMeal: roundMoney(longPlanPerMeal),
    longPlanMinDays,
    unknownPolicy,
  };
}

export async function saveDeliverySettings(input) {
  const settings = validateDeliverySettings(input);
  const { data, error } = await supabase
    .from("delivery_settings")
    .upsert(
      {
        id: true,
        free_km: settings.freeKm,
        standard_per_meal: settings.standardPerMeal,
        long_plan_per_meal: settings.longPlanPerMeal,
        long_plan_min_days: settings.longPlanMinDays,
        unknown_policy: settings.unknownPolicy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save delivery settings: ${error.message}`);
  }

  return normalizeDeliverySettings(data);
}
