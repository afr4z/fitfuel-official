import { sendText, sendButtons } from "../../lib/whatsapp.js";
import { createClient } from "@supabase/supabase-js";
import { handleGreeting } from "./greeting.js";
import { startSubscription } from "./subscription.js";
import { countRemainingDeliveryDays } from "../../lib/deliveryDays.js";
import { getPlanLabel } from "../config/plans.js";
import { buildExpiryNotice, viewPlans, MY_PLAN_NO_ACTIVE, myPlanActive, MY_PLAN_RENEW_PROMPT, CONTACT_US } from "../config/messages.js";
import { getPlanCategories } from "../../lib/mealPlans.js";
import { formatDateIST } from "../../lib/time.js";

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
        viewPlans({ planLines }),
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
        await sendText(phone, MY_PLAN_NO_ACTIVE);
        break;
      }

      const remaining = await countRemainingDeliveryDays(activeSub.start_date,activeSub.end_date);
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
          const date = formatDateIST(o.delivery_date, {
            weekday: "short", day: "numeric", month: "short",
          });
          return `  ${emoji} ${o.slot} → ${date}`;
        });
        pushedLines = `\n⏭️ *${pushedOrders.length} skipped meal(s)* after your plan ends:\n${lines.join("\n")}\n`;
      }

      await sendText(
        phone,
        myPlanActive({ planLabel, startDate: activeSub.start_date, expiryLine, pushedLines }),
      );

      const threshold = parseInt(process.env.RENEWAL_THRESHOLD_DAYS, 10) || 2;
      if (remaining <= threshold) {
        await sendButtons(
          phone,
          MY_PLAN_RENEW_PROMPT,
          [
            { id: "ORDER_NOW", title: "🔄 Renew Plan" },
            { id: "CONTACT_US", title: "📞 Contact Us" },
          ],
        );
      }
      break;
    }

    case "CONTACT_US":
      await sendText(phone, CONTACT_US);
      break;

    default:
      await handleGreeting(phone, session, setSession);
  }
}
