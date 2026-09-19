import { createClient } from "@supabase/supabase-js";
import { createPaymentLink } from "../lib/razorpay.js";
import { getPlanCategories, getPlanById } from "../lib/mealPlans.js";
import { addDeliveryDays } from "../lib/deliveryDays.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function toPlanType(days) {
  if (days === 3) return "3day";
  if (days === 7) return "weekly";
  if (days === 14) return "biweekly";
  return "monthly";
}

function calcDates(days) {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const todayStr = ist.toISOString().split("T")[0];

  let start = new Date(todayStr + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() + 1);

  while (start.getUTCDay() === 0) {
    start.setUTCDate(start.getUTCDate() + 1);
  }
  const startStr = start.toISOString().split("T")[0];

  const endStr = addDeliveryDays(startStr, days - 1);
  return { start_date: startStr, end_date: endStr };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      planId,
      days,
      mealsPerDay,
      phone,
      name,
      email,
      address,
      location,
    } = req.body;

    if (!planId || !days || !mealsPerDay || !phone) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const plans = await getPlanCategories();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const pricePerMealPerDay = plan.pricing[days];
    if (!pricePerMealPerDay) {
      return res.status(400).json({ error: "Invalid duration for this plan" });
    }

    const totalAmount = Math.round(pricePerMealPerDay * mealsPerDay * days);

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .upsert(
        { phone, name, email, address, location },
        { onConflict: "phone" }
      )
      .select("id")
      .single();

    if (customerError) {
      console.error("[WEB-ORDER] Customer upsert failed:", customerError);
      return res.status(500).json({ error: "Failed to save customer" });
    }

    const { start_date, end_date } = calcDates(days);

    const referenceId = `w_${phone.slice(-6)}_${Math.random().toString(36).slice(2, 8)}`;

    const mealLabel =
      mealsPerDay === 1 ? "Breakfast" : mealsPerDay === 2 ? "Lunch + Dinner" : "All 3 Meals";
    const dayLabel = `${days} Days`;

    const paymentLink = await createPaymentLink({
      amount: totalAmount,
      description: `${plan.title} — ${dayLabel} — ${mealLabel}`,
      phone,
      referenceId,
    });

    const { error: sessionError } = await supabase.from("web_order_sessions").insert({
      phone,
      name,
      email,
      address,
      location,
      plan_id: planId,
      days,
      meals_per_day: mealsPerDay,
      total_amount: totalAmount,
      razorpay_payment_link_id: paymentLink.id,
      reference_id: referenceId,
      customer_id: customer.id,
      start_date,
      end_date,
      status: "pending",
    });

    if (sessionError) {
      console.error("[WEB-ORDER] Session insert failed:", sessionError);
      return res.status(500).json({ error: "Failed to create order session" });
    }

    return res.status(200).json({
      paymentUrl: paymentLink.short_url,
      amount: totalAmount,
      orderId: referenceId,
    });
  } catch (err) {
    console.error("[WEB-ORDER] Error:", err.message, err.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
}