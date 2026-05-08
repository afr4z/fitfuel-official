import { sendButtons } from "../../lib/whatsapp.js";
import { STATES } from "../states.js";
import { createClient } from "@supabase/supabase-js";
import { countRemainingDeliveryDays } from "../../lib/deliveryDays.js";
import { getPlanLabel, buildExpiryNotice } from "../config/plans.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function handleGreeting(phone, session, setSession) {
  await setSession(phone, { ...session, state: STATES.MAIN_MENU });

  // Check whether this customer has an active subscription
  const today = new Date().toISOString().split("T")[0];
  const { data: activeSub } = await supabase
    .from("meal_plan_subscriptions")
    .select("id, plan_type, start_date, end_date")
    .eq("phone", phone)
    .eq("status", "active")
    .gte("end_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeSub) {
    const remaining = await countRemainingDeliveryDays(activeSub.start_date,activeSub.end_date);
    const planLabel = getPlanLabel(activeSub.plan_type);
    const threshold = parseInt(process.env.RENEWAL_THRESHOLD_DAYS, 10) || 2;
    const expiryLine = remaining <= threshold
      ? `\n⚠️ Your plan expires soon — only *${remaining}* delivery day(s) left!`
      : `\n📅 *${remaining}* delivery day(s) remaining`;

    const buttons = [
      { id: "MY_PLAN", title: "📋 My Plan" },
      { id: "CONTACT_US", title: "📞 Contact Us" },
    ];

    if (remaining <= threshold) {
      buttons.unshift({ id: "ORDER_NOW", title: "🔄 Renew Plan" });
    }

    await sendButtons(
      phone,
      `👋 Welcome back to FitFuel Nutrition!\n\n` +
      `🟢 You have an *active ${planLabel} plan*.${expiryLine}` +
      `\n\nHow can we help you?`,

      buttons,
    );
  } else {
    await sendButtons(
      phone,
      "👋 Welcome to FitFuel Nutrition!\n\nHow can we help you today?",
      [
        { id: "VIEW_PLANS", title: "🥗 View Plans" },
        { id: "ORDER_NOW", title: "🛒 Order Now" },
        { id: "CONTACT_US", title: "📞 Contact Us" },
      ],
    );
  }
}
