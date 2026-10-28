import { createClient } from "@supabase/supabase-js";
import { getPlanById, PLAN_DURATIONS } from "../lib/mealPlans.js";
import {
  getDeliveryQuote,
  getPublicDeliveryConfig,
} from "../lib/deliveryPricing.js";

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

  if (req.method === "POST" && path === "/api/delivery-quote") {
    return handleDeliveryQuote(req, res);
  }

  return res.status(404).json({ error: "Not found" });
}

/**
 * Returns the server-calculated plan + delivery breakdown for the checkout
 * summary. The same getDeliveryQuote helper is used when creating the payment
 * link, so the displayed amount and charged amount cannot drift apart.
 */
async function handleDeliveryQuote(req, res) {
  try {
    const { planId, days, mealsPerDay, address, location, area } =
      req.body || {};
    const planDays = Number(days);
    const meals = Number(mealsPerDay);

    if (
      !planId ||
      !Number.isInteger(planDays) ||
      !PLAN_DURATIONS.includes(planDays)
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!Number.isInteger(meals) || meals < 1 || meals > 3) {
      return res.status(400).json({ error: "Invalid meals per day" });
    }

    const plan = await getPlanById(planId);
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const ratePerMealPerDay =
      plan.pricing?.[planDays] ?? plan.basePricePerMealPerDay;
    if (!ratePerMealPerDay) {
      return res.status(400).json({ error: "Invalid duration for this plan" });
    }

    const quote = await getDeliveryQuote({
      ratePerMealPerDay,
      days: planDays,
      mealsPerDay: meals,
      address,
      location,
      area,
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ...quote,
      deliveryConfig: getPublicDeliveryConfig(),
    });
  } catch (err) {
    console.error("[DELIVERY-QUOTE] Error:", err.message, err.stack);
    return res.status(500).json({ error: "Could not calculate delivery" });
  }
}

async function handleGetPlans(req, res) {
  try {
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

    // Pricing is editable in the admin panel, so don't serve a stale plan list
    // after a rate change.
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      plans,
      delivery: getPublicDeliveryConfig(),
    });
  } catch (err) {
    console.error("[PLANS] Error:", err.message, err.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
}
