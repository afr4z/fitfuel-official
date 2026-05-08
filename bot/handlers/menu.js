import { sendText, sendButtons } from "../../lib/whatsapp.js";
import { createClient } from "@supabase/supabase-js";
import { handleGreeting } from "./greeting.js";
import { startSubscription } from "./subscription.js";
import { countRemainingDeliveryDays } from "../../lib/deliveryDays.js";
import { getPlanLabel, buildExpiryNotice } from "../config/plans.js";
import { getPlanCategories } from "../../lib/mealPlans.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function handleMainMenu(phone, session, buttonId, setSession) {
  switch (buttonId) {
    case "VIEW_PLANS": {
      const plans = await getPlanCategories();
      const planLines = plans
        .map((p) => {
          const prices = [3, 7, 14, 30]
            .filter((d) => p.pricing[d])
            .map((d) => `₹${p.pricing[d]}/${d}d`)
            .join(" · ");
          return `${p.title}\n   ${p.description}\n   Starts at ${prices}`;
        })
        .join("\n\n");

      await sendButtons(
        phone,
        `🥗 *Our Nutrition Plans*\n\n${planLines}\n\n` +
          `📅 *Durations:* 3, 7, 14, or 30 days\n` +
          `🍴 *Meals:* Breakfast only, Lunch + Dinner, or All 3\n\n` +
          `Tap below to customise your plan!`,
        [{ id: "ORDER_NOW", title: "🛒 Build My Plan" }],
      );
      break;
    }

    case "ORDER_NOW":
      return startSubscription(phone, session, setSession);

    case "MY_PLAN": {
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

      let pushedLines = "";
      const { data: pushedOrders } = await supabase
        .from("orders")
        .select("slot, delivery_date")
        .eq("subscription_id", activeSub.id)
        .eq("status", "pending")
        .gt("delivery_date", activeSub.end_date)
        .order("delivery_date");

      if (pushedOrders?.length) {
        const lines = pushedOrders.map((o) => {
          const emoji = o.slot === "breakfast" ? "🌅" : o.slot === "lunch" ? "☀️" : "🌙";
          const date = new Date(o.delivery_date + "T00:00:00Z").toLocaleDateString("en-IN", {
            weekday: "short", day: "numeric", month: "short",
          });
          return `  ${emoji} ${o.slot} → ${date}`;
        });
        pushedLines = `\n⏭️ *${pushedOrders.length} skipped meal(s)* after your plan ends:\n${lines.join("\n")}\n`;
      }

      await sendText(
        phone,
        `📋 *Your Active Plan*\n\n` +
          `📦 Plan: *${planLabel}*\n` +
          `📅 Started: ${activeSub.start_date}\n` +
          `${expiryLine}${pushedLines}\n\n` +
          `You'll receive a notification before each meal to confirm, skip, or change it.\n\n` +
          `Type anything to go back to the menu.`,
      );

      const threshold = parseInt(process.env.RENEWAL_THRESHOLD_DAYS, 10) || 2;
      if (remaining <= threshold) {
        await sendButtons(
          phone,
          `🔄 Ready to renew your plan?`,
          [
            { id: "ORDER_NOW", title: "🔄 Renew Plan" },
            { id: "CONTACT_US", title: "📞 Contact Us" },
          ],
        );
      }
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
