import { sendText, sendButtons } from "../../lib/whatsapp.js";
import { createClient } from "@supabase/supabase-js";
import { handleGreeting } from "./greeting.js";
import { startSubscription } from "./subscription.js";
import { countRemainingDeliveryDays } from "../../lib/deliveryDays.js";
import { getPlanLabel, buildExpiryNotice } from "../config/plans.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function handleMainMenu(phone, session, buttonId, setSession) {
  switch (buttonId) {
    case "VIEW_PLANS":
      await sendButtons(
        phone,
        `🥗 *Our Nutrition Plans*\n\n` +
          `We offer fully customisable meal plans across 6 diet goals:\n\n` +
          `🔥 Weight Loss · 💪 Muscle Gain · 🥑 Keto\n` +
          `🩺 Diabetic-Friendly · 🌱 Vegan · ⚖️ Balanced\n\n` +
          `📅 *Durations:* 3, 7, 14, or 30 days\n` +
          `🍴 *Meals:* Breakfast only, Lunch + Dinner, or All 3\n\n` +
          `Pricing starts from ₹120/meal/day. Tap below to build your plan!`,
        [{ id: "ORDER_NOW", title: "🛒 Build My Plan" }],
      );
      break;

    case "ORDER_NOW":
      return startSubscription(phone, session, setSession);

    case "MY_PLAN": {
      const today = new Date().toISOString().split("T")[0];
      const { data: activeSub } = await supabase
        .from("meal_plan_subscriptions")
        .select("plan_type, start_date, end_date")
        .eq("phone", phone)
        .eq("status", "active")
        .gte("end_date", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeSub) {
        await sendText(
          phone,
          `ℹ️ You don't have an active plan right now.\n\nType anything to go back to the menu.`,
        );
        break;
      }

      const remaining = countRemainingDeliveryDays(activeSub.start_date,activeSub.end_date);
      const planLabel = getPlanLabel(activeSub.plan_type);
      const expiryLine = buildExpiryNotice(remaining) ||
        `⏳ *${remaining}* delivery day(s) remaining.`;

      await sendText(
        phone,
        `📋 *Your Active Plan*\n\n` +
          `📦 Plan: *${planLabel}*\n` +
          `📅 Started: ${activeSub.start_date}\n` +
          `${expiryLine}\n\n` +
          `You'll receive a notification before each meal to confirm, skip, or change it.\n\n` +
          `Type anything to go back to the menu.`,
      );
      break;
    }

    case "CONTACT_US":
      await sendText(
        phone,
        `📞 *Get in Touch*\n\n` +
          `📧 Email: hello@fitfuelnutrition.com\n` +
          `📱 WhatsApp: This chat!\n` +
          `🌐 Website: www.fitfuelnutrition.com\n` +
          `🕐 Support hours: Mon–Sat, 9am–7pm`,
      );
      break;

    default:
      await handleGreeting(phone, session, setSession);
  }
}
