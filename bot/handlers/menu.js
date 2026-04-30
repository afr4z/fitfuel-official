import { sendText, sendButtons } from "../../lib/whatsapp.js";
import { handleGreeting } from "./greeting.js";
import { startSubscription } from "./subscription.js";

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
