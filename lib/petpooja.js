import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function getMenuItems({ limit = 10, mealPlanId, slot } = {}) {
  let query = supabase
    .from("dishes")
    .select("id, name, is_veg, price")
    .eq("is_available", true);

  if (mealPlanId) {
    query = query.eq("meal_plan_id", mealPlanId);
  }

  if (slot) {
    query = query.eq("slot", slot);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("[DB] Failed to fetch dishes:", error.message);
    return [];
  }

  console.log(
    `[PETPOOJA] getMenuItems: fetched ${data?.length ?? 0} dishes (limit=${limit}, mealPlanId=${mealPlanId})`,
  );
  return data.map((d) => ({
    itemid: d.id,
    itemname: d.name,
    item_type: d.is_veg ? "1" : "2",
    price: d.price.toString(),
  }));
}

// Kept for the external Petpooja VPS scripts; verify before removing.
export async function getCategories() {
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, name, tag")
    .eq("is_active", true);

  if (error) {
    console.error("[DB] Failed to fetch meal plans:", error.message);
    return [];
  }

  return data.map((p) => ({
    categoryid: p.id,
    categoryname: p.name,
    tag: p.tag,
  }));
}
