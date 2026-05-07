import { sendText, sendList } from "../../lib/whatsapp.js";
import { createClient } from "@supabase/supabase-js";
import { getMenuItems } from "../../lib/petpooja.js";
import { STATES } from "../states.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Fallback menu used when the DB is unreachable
const FALLBACK_ITEMS = [
  { itemid: "item001", itemname: "Paneer Butter Masala", item_type: "1", price: "180" },
  { itemid: "item002", itemname: "Chicken Biryani",      item_type: "2", price: "220" },
  { itemid: "item003", itemname: "Dal Tadka + Rice",     item_type: "1", price: "150" },
  { itemid: "item004", itemname: "Grilled Fish Thali",   item_type: "2", price: "250" },
];

function isPastMidnightIST() {
  const now = new Date();
  const totalUTCMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return totalUTCMinutes >= 18 * 60 + 30;
}

function midnightDeadlineMessage() {
  return `⏰ The midnight deadline has passed. Changes can no longer be made for today's meals.`;
}

export async function handleOrderAction(phone, session, buttonId, setSession) {
  // buttonId looks like CONFIRM_<uuid>, CHANGE_<uuid>, SKIP_<uuid>
  const [action, orderId] = buttonId.split("_");

  if (!orderId) {
    await sendText(phone, `Sorry, something went wrong. Please try again.`);
    return;
  }

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("phone, status")
    .eq("id", orderId)
    .single();

  if (fetchError || !order) {
    console.error("[DB] Order fetch failed:", fetchError?.message);
    await sendText(phone, `Sorry, we couldn't find that order. Please try again.`);
    return;
  }

  if (order.phone !== phone) {
    console.error("[SECURITY] Order ownership mismatch:", { orderPhone: order.phone, requesterPhone: phone });
    await sendText(phone, `Sorry, something went wrong. Please try again.`);
    return;
  }

  if (order.status !== "pending") {
    const alreadyMsg =
      order.status === "confirmed"
        ? "✅ This order has already been confirmed."
        : order.status === "skipped"
          ? "⏭️ This order has already been skipped."
          : `ℹ️ This order has already been processed.`;
    await sendText(phone, alreadyMsg);
    return;
  }

  switch (action) {
    case "CONFIRM": {
      const { error: confirmError } = await supabase
        .from("orders")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", orderId);

      if (confirmError) {
        console.error("[DB] CONFIRM update failed:", confirmError.message);
        await sendText(phone, `Sorry, something went wrong confirming your order. Please try again.`);
        break;
      }

      await sendText(
        phone,
        `✅ *Confirmed!* Your meal is locked in.\n\n` +
          `We'll notify you once it's on the way 🚀`,
      );
      break;
    }

    case "SKIP": {
      const { error: skipError } = await supabase
        .from("orders")
        .update({ status: "skipped" })
        .eq("id", orderId);

      if (skipError) {
        console.error("[DB] SKIP update failed:", skipError.message);
        await sendText(phone, `Sorry, something went wrong skipping your order. Please try again.`);
        break;
      }

      await sendText(
        phone,
        `⏭️ *Skipped!* No delivery for this slot today.\n\n` +
          `See you next time 👋`,
      );
      break;
    }

    case "CHANGE": {
      if (isPastMidnightIST()) {
        await sendText(phone, midnightDeadlineMessage());
        break;
      }

      await setSession(phone, {
        ...session,
        state: STATES.CHANGING_MEAL,
        data: { orderId },
      });

      // Fetch live menu from PetPooja; fall back to defaults on error
      let items = FALLBACK_ITEMS;
      try {
        const fetched = await getMenuItems();
        if (fetched.length) items = fetched;
      } catch (e) {
        console.error("[PETPOOJA] Error fetching menu:", e.message);
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

  if (!orderId || !itemId) {
    await sendText(phone, `Sorry, something went wrong. Please try again.`);
    return;
  }

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("phone, status")
    .eq("id", orderId)
    .single();

  if (fetchError || !order) {
    console.error("[DB] Order fetch failed:", fetchError?.message);
    await sendText(phone, `Sorry, we couldn't find that order. Please try again.`);
    return;
  }

  if (order.phone !== phone) {
    console.error("[SECURITY] Order ownership mismatch on meal change:", { orderPhone: order.phone, requesterPhone: phone });
    await sendText(phone, `Sorry, something went wrong. Please try again.`);
    return;
  }

  if (order.status !== "pending") {
    await sendText(phone, `ℹ️ This order has already been processed and can't be changed.`);
    return;
  }

  if (isPastMidnightIST()) {
    await sendText(phone, midnightDeadlineMessage());
    return;
  }

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

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      item_id: itemId,
      item_name: itemName,
      is_default: false,
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updateError) {
    console.error("[DB] Meal change update failed:", updateError.message);
    await sendText(phone, `Sorry, something went wrong updating your meal. Please try again.`);
    return;
  }

  await sendText(
    phone,
    `✅ *Meal updated!*\n\n` +
      `Your new meal: *${itemName}*\n\n` +
      `We'll have it ready for your slot 🍽️`,
  );

  // Back to idle state
  await setSession(phone, { state: "GREETING", data: {} });
}

export async function handleConfirmAll(phone, session, buttonId, setSession) {
  if (isPastMidnightIST()) {
    await sendText(phone, midnightDeadlineMessage());
    return;
  }

  const subId = buttonId.replace("CONFIRM_ALL_", "");
  if (!subId) {
    await sendText(phone, `Sorry, something went wrong. Please try again.`);
    return;
  }

  const { data: orders, error: fetchError } = await supabase
    .from("orders")
    .select("id, phone, status")
    .eq("subscription_id", subId)
    .eq("status", "pending");

  if (fetchError) {
    console.error("[DB] CONFIRM_ALL fetch failed:", fetchError.message);
    await sendText(phone, `Sorry, something went wrong. Please try again.`);
    return;
  }

  const pendingOrders = orders?.filter((o) => o.phone === phone) ?? [];

  if (pendingOrders.length === 0) {
    await sendText(phone, `✅ All your meals for tomorrow are already confirmed!`);
    return;
  }

  const orderIds = pendingOrders.map((o) => o.id);
  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .in("id", orderIds);

  if (updateError) {
    console.error("[DB] CONFIRM_ALL update failed:", updateError.message);
    await sendText(phone, `Sorry, something went wrong confirming your meals. Please try again.`);
    return;
  }

  await sendText(
    phone,
    `✅ *All confirmed!* ${pendingOrders.length} meal(s) are locked in for tomorrow.\n\n` +
      `We'll notify you before each delivery 🚀`,
  );
}

export async function handleSkipAll(phone, session, buttonId, setSession) {
  const subId = buttonId.replace("SKIP_ALL_", "");
  if (!subId) {
    await sendText(phone, `Sorry, something went wrong. Please try again.`);
    return;
  }

  const { data: orders, error: fetchError } = await supabase
    .from("orders")
    .select("id, phone, status")
    .eq("subscription_id", subId)
    .eq("status", "pending");

  if (fetchError) {
    console.error("[DB] SKIP_ALL fetch failed:", fetchError.message);
    await sendText(phone, `Sorry, something went wrong. Please try again.`);
    return;
  }

  const pendingOrders = orders?.filter((o) => o.phone === phone) ?? [];

  if (pendingOrders.length === 0) {
    await sendText(phone, `⏭️ No pending meals to skip.`);
    return;
  }

  const orderIds = pendingOrders.map((o) => o.id);
  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "skipped" })
    .in("id", orderIds);

  if (updateError) {
    console.error("[DB] SKIP_ALL update failed:", updateError.message);
    await sendText(phone, `Sorry, something went wrong skipping your meals. Please try again.`);
    return;
  }

  await sendText(
    phone,
    `⏭️ *Skipped!* ${pendingOrders.length} meal(s) — no deliveries tomorrow.\n\n` +
      `See you next time 👋`,
  );
}

export async function handleChangeOrderStart(phone, session, buttonId, setSession) {
  if (isPastMidnightIST()) {
    await sendText(phone, midnightDeadlineMessage());
    return;
  }

  const subId = buttonId.replace("CHANGE_ORDER_", "");
  if (!subId) {
    await sendText(phone, `Sorry, something went wrong. Please try again.`);
    return;
  }

  const { data: orders, error: fetchError } = await supabase
    .from("orders")
    .select("id, slot, item_name, delivery_time")
    .eq("subscription_id", subId)
    .eq("phone", phone)
    .eq("status", "pending");

  if (fetchError) {
    console.error("[DB] CHANGE_ORDER fetch failed:", fetchError.message);
    await sendText(phone, `Sorry, something went wrong. Please try again.`);
    return;
  }

  const pendingOrders = orders ?? [];

  if (pendingOrders.length === 0) {
    await sendText(phone, `No meals to change — all already processed.`);
    return;
  }

  if (pendingOrders.length === 1) {
    await setSession(phone, {
      ...session,
      state: STATES.CHANGING_MEAL,
      data: { orderId: pendingOrders[0].id },
    });

    let items = FALLBACK_ITEMS;
    try {
      const fetched = await getMenuItems();
      if (fetched.length) items = fetched;
    } catch (e) {
      console.error("[DB] Error fetching menu:", e.message);
    }

    const rows = items.map((item) => ({
      id: `MEAL_${pendingOrders[0].id}_${item.itemid}`,
      title: item.itemname.substring(0, 24),
      description: `₹${item.price} · ${item.item_type === "1" ? "Veg" : "Non-Veg"}`,
    }));
    await sendList(phone, `🔄 *Change your meal*\n\nPick from today's options:`, "View Menu", [{ title: "Menu", rows }]);
    return;
  }

  await setSession(phone, {
    ...session,
    state: STATES.SELECTING_MEAL_SLOT,
    data: { subId },
  });

  const rows = pendingOrders.map((o) => ({
    id: `PICK_SLOT_${o.id}`,
    title: o.slot.charAt(0).toUpperCase() + o.slot.slice(1),
    description: `${o.item_name || "Default meal"} · ${o.delivery_time?.slice(0, 5) || "—"}`,
  }));

  await sendList(
    phone,
    `🔄 *Change a meal*\n\nWhich slot would you like to change?`,
    "Choose Slot",
    [{ title: "Your Meals", rows }],
  );
}
