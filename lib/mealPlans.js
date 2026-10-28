import { createClient } from "@supabase/supabase-js";

export const PLAN_DURATIONS = [3, 7, 14, 21, 28];

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function getPlanCategories() {
  const { data, error } = await supabase
    .from("meal_plans")
    .select(
      `
      *,
      pricing:plan_pricing (days, price_per_meal_per_day)
    `,
    )
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[DB] Failed to fetch meal plans:", error.message);
    return [];
  }

  return data.map((p) => ({
    id: p.id,
    title: `${p.emoji || "🥗"} ${p.name}`,
    shortTitle: `${p.emoji || "🥗"} ${p.name.replace(/ (Meal|Diet) Plan/, "")}`,
    description: p.description || "",
    tag: p.tag,
    basePricePerMealPerDay: p.base_price,
    pricing: Object.fromEntries(
      (p.pricing || []).map((t) => [t.days, t.price_per_meal_per_day]),
    ),
  }));
}

export async function getPlanById(id) {
  const plans = await getPlanCategories();
  return plans.find((pl) => pl.id === id) || null;
}

// Kept for the external Petpooja VPS scripts; verify before removing.
export async function getPlanByTag(tag) {
  const plans = await getPlanCategories();
  return plans.find((pl) => pl.tag === tag) || null;
}
