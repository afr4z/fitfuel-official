import { sendText, sendList } from "../../lib/whatsapp.js";
import { createClient } from "@supabase/supabase-js";
import { getMenuItems } from "../../lib/petpooja.js";
import { STATES } from "../states.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

// Fallback menu used when PetPooja is unreachable
const FALLBACK_ITEMS = [
  { itemid: "item001", itemname: "Paneer Butter Masala", item_type: "1", price: "180" },
  { itemid: "item002", itemname: "Chicken Biryani",      item_type: "2", price: "220" },
  { itemid: "item003", itemname: "Dal Tadka + Rice",     item_type: "1", price: "150" },
  { itemid: "item004", itemname: "Grilled Fish Thali",   item_type: "2", price: "250" },
];

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
      await setSession(phone, {
        ...session,
        state: STATES.CHANGING_MEAL,
        data: { orderId },
      });

      // Fetch live menu from PetPooja; fall back to defaults on error
      let items;
      try {
        items = await getMenuItems();
        if (!items.length) items = FALLBACK_ITEMS;
      } catch (e) {
        console.error("[PETPOOJA] Error fetching menu:", e.message);
        items = FALLBACK_ITEMS;
      }

      const rows = items.map((item) => ({
        id: `MEAL_${orderId}_${item.itemid}`,
        title: item.itemname.substring(0, 24),
        description: `₹${item.price} · ${item.item_type === "1" ? "Veg" : "Non-Veg"}`,
      }));

      await sendList(
        phone,
        `🔄 *Change your meal*\n\nPick from today's available options:`,
        "View Menu",
        [{ title: "Today's Menu", rows }],
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

  // Resolve item name from PetPooja; fall back gracefully
  let itemName = "Selected meal";
  try {
    const items = await getMenuItems();
    const item = items.find((i) => i.itemid === itemId);
    if (item) itemName = item.itemname;
  } catch (e) {
    console.error("[PETPOOJA] Error resolving item name:", e.message);
    // Use fallback list
    const fallback = FALLBACK_ITEMS.find((i) => i.itemid === itemId);
    if (fallback) itemName = fallback.itemname;
  }

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
