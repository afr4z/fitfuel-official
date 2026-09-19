import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method === "GET" && path === "/api/plans") {
    return handleGetPlans(req, res);
  }

  return res.status(404).json({ error: "Not found" });
}

async function handleGetPlans(req, res) {
  try {
    const { data, error } = await supabase
      .from("meal_plans")
      .select(`
        *,
        pricing:plan_pricing (days, price_per_meal_per_day)
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[PLANS] Failed to fetch meal plans:", error.message);
      return res.status(500).json({ error: "Failed to load plans" });
    }

    const plans = data.map((p) => ({
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

    return res.status(200).json({ plans });
  } catch (err) {
    console.error("[PLANS] Error:", err.message, err.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
}