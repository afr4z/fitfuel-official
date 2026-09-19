import { createClient } from "@supabase/supabase-js";
import { createPaymentLink } from "../lib/razorpay.js";
import { getPlanCategories } from "../lib/mealPlans.js";
import { countRemainingDeliveryDays } from "../lib/deliveryDays.js";
import { setSession } from "../bot/session.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

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

    // ─── Double-subscription guard (mirrors the bot flow) ───────────────────
    // If an active plan still has more than RENEWAL_THRESHOLD_DAYS of
    // deliveries remaining, refuse the purchase. Within the threshold, allow
    // a renewal: the new plan starts the day after the current one ends.
    const today = new Date().toISOString().split("T")[0];
    const { data: activeSub } = await supabase
      .from("meal_plan_subscriptions")
      .select("id, start_date, end_date")
      .eq("phone", phone)
      .eq("status", "active")
      .gte("end_date", today)
      .limit(1)
      .maybeSingle();

    let renewAfterEnd;
    if (activeSub) {
      const remaining = await countRemainingDeliveryDays(
        activeSub.start_date,
        activeSub.end_date,
      );
      const threshold = parseInt(process.env.RENEWAL_THRESHOLD_DAYS, 10) || 2;

      if (remaining > threshold) {
        return res.status(409).json({
          error: `You already have an active meal plan with ${remaining} delivery day(s) remaining. Renew it within the last ${threshold} days instead.`,
        });
      }
      renewAfterEnd = activeSub.end_date;
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

    const { error: customerError } = await supabase
      .from("customers")
      .upsert(
        { phone, name, email, address, location },
        { onConflict: "phone" }
      );

    if (customerError) {
      console.error("[WEB-ORDER] Customer upsert failed:", customerError);
      return res.status(500).json({ error: "Failed to save customer" });
    }

    const referenceId = `${phone}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const mealLabel =
      mealsPerDay === 1 ? "Breakfast" : mealsPerDay === 2 ? "Lunch + Dinner" : "All 3 Meals";
    const dayLabel = `${days} Days`;

    const paymentLink = await createPaymentLink({
      amount: totalAmount,
      description: `${plan.title} — ${dayLabel} — ${mealLabel}`,
      phone,
      referenceId,
    });

    // Store the pending order in the same Redis session the Razorpay webhook
    // already reads (bot/session.js). On payment_link.paid the webhook takes
    // the phone from reference_id, reads session.data, and completes the
    // subscription — identical path to WhatsApp orders, no extra table.
    // state: "GREETING" is idle-exempt, so getSession() won't drop the
    // session if the customer takes a few minutes to pay at Razorpay
    // (it still expires after the session TTL).
    await setSession(phone, {
      state: "GREETING",
      data: {
        planId,
        planTitle: plan.title,
        days,
        mealLabel,
        dayLabel,
        amount: totalAmount,
        mealsPerDay,
        renewAfterEnd,
      },
    });

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