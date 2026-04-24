import { sendText } from "../../lib/whatsapp.js";
import { handleGreeting } from "./greeting.js";

export async function handleMainMenu(phone, session, buttonId, setSession) {
  switch (buttonId) {
    case "VIEW_PLANS":
      await sendText(
        phone,
        `🥗 *Our Nutrition Plans*\n\n` +
          `1️⃣ *Weekly Plan* — ₹999\n   7 days, choose breakfast/lunch/dinner\n\n` +
          `2️⃣ *Monthly Plan* — ₹3,499\n   30 days, choose breakfast/lunch/dinner\n\n` +
          `Reply *ORDER* to get started 💪`,
      );
      break;

    case "ORDER_NOW":
      await sendText(
        phone,
        `🛒 *Place an Order*\n\n` +
          `To get started, please share:\n` +
          `1. Your preferred plan (Weekly / Monthly)\n` +
          `2. Which slots (Breakfast / Lunch / Dinner)\n` +
          `3. Any dietary restrictions\n\n` +
          `Our team will get back to you within 2 hours! ⚡`,
      );
      break;

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
