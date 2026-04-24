import { sendText, sendList } from "../../lib/whatsapp.js";
import { createClient } from "@supabase/supabase-js";
import { STATES } from "../states.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

export async function handleOrderAction(phone, session, buttonId, setSession) {
  // buttonId looks like CONFIRM_<uuid>, CHANGE_<uuid>, SKIP_<uuid>
  const [action, orderId] = buttonId.split("_");

  if (!orderId) {
    await sendText(phone, `Sorry, something went wrong. Please try again.`);
    return;
  }

  switch (action) {
    case "CONFIRM": {
      await supabase
        .from("orders")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", orderId);

      await sendText(
        phone,
        `✅ *Confirmed!* Your meal is locked in.\n\n` +
          `We'll notify you once it's on the way 🚀`,
      );
      break;
    }

    case "SKIP": {
      await supabase
        .from("orders")
        .update({ status: "skipped" })
        .eq("id", orderId);

      await sendText(
        phone,
        `⏭️ *Skipped!* No delivery for this slot today.\n\n` +
          `See you next time 👋`,
      );
      break;
    }

    case "CHANGE": {
      // Store order ID in session so we know what to update after they pick
      await setSession(phone, {
        ...session,
        state: STATES.CHANGING_MEAL,
        data: { orderId },
      });

      // Fetch PetPooja menu — hardcoded for now, replaced in Module 2
      await sendList(
        phone,
        `🔄 *Change your meal*\n\nPick from today's available options:`,
        "View Menu",
        [
          {
            title: "Today's Menu",
            rows: [
              {
                id: `MEAL_${orderId}_item001`,
                title: "Paneer Butter Masala",
                description: "₹180 · Veg",
              },
              {
                id: `MEAL_${orderId}_item002`,
                title: "Chicken Biryani",
                description: "₹220 · Non-veg",
              },
              {
                id: `MEAL_${orderId}_item003`,
                title: "Dal Tadka + Rice",
                description: "₹150 · Veg",
              },
              {
                id: `MEAL_${orderId}_item004`,
                title: "Grilled Fish Thali",
                description: "₹250 · Non-veg",
              },
            ],
          },
        ],
      );
      break;
    }

    default:
      await sendText(
        phone,
        `Sorry, I didn't understand that. Please use the buttons.`,
      );
  }
}

export async function handleMealChange(phone, session, listId, setSession) {
  // listId looks like MEAL_<orderId>_<itemId>
  const parts = listId.split("_");
  const orderId = parts[1];
  const itemId = parts[2];

  const MEAL_NAMES = {
    item001: "Paneer Butter Masala",
    item002: "Chicken Biryani",
    item003: "Dal Tadka + Rice",
    item004: "Grilled Fish Thali",
  };

  const itemName = MEAL_NAMES[itemId] || "Selected meal";

  await supabase
    .from("orders")
    .update({
      item_id: itemId,
      item_name: itemName,
      is_default: false,
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  await sendText(
    phone,
    `✅ *Meal updated!*\n\n` +
      `Your new meal: *${itemName}*\n\n` +
      `We'll have it ready for your slot 🍽️`,
  );

  // Back to idle state
  await setSession(phone, { state: "GREETING", data: {} });
}
