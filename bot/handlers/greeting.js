import { sendButtons } from "../../lib/whatsapp.js";
import { STATES } from "../states.js";

export async function handleGreeting(phone, session, setSession) {
  await sendButtons(
    phone,
    "👋 Welcome to FitFuel Nutrition!\n\nHow can we help you today?",
    [
      { id: "VIEW_PLANS", title: "🥗 View Plans" },
      { id: "ORDER_NOW", title: "🛒 Order Now" },
      { id: "CONTACT_US", title: "📞 Contact Us" },
    ],
  );
  await setSession(phone, { ...session, state: STATES.MAIN_MENU });
}
