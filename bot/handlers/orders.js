import { sendText, sendList } from "../../lib/whatsapp.js";
import { createClient } from "@supabase/supabase-js";
import { getMenuItems } from "../../lib/petpooja.js";
import { addDeliveryDays } from "../../lib/deliveryDays.js";
import { STATES } from "../states.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function isPastDeadline(order) {
  if (process.env.BYPASS_DEADLINE_CHECK === "true") return false;
  if (!order.accept_until) return false;
  return new Date() > new Date(order.accept_until);
}

function deadlineMessage(order) {
  if (order.slot === "lunch") return "⏰ The 9:30am deadline has passed. Changes can no longer be made for lunch.";
  if (order.slot === "dinner") return "⏰ The 5pm deadline has passed. Changes can no longer be made for dinner.";
  return "⏰ The deadline has passed. Changes can no longer be made for this meal.";
}

export async function handleOrderAction(phone, session, buttonId, setSession) {
  const [action, orderId] = buttonId.split("_");
  console.log(`[ORDERS] handleOrderAction called: phone=${phone} action=${action} orderId=${orderId}`);

  if (!orderId) {
    console.log(`[ORDERS] Missing orderId from buttonId=${buttonId}`);
    await sendText(phone, "Sorry, something went wrong. Please try again.");
    return;
  }

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("phone, status, slot, accept_until, item_id, item_name, slot_id, subscription_id, delivery_time")
    .eq("id", orderId)
    .single();

  if (fetchError || !order) {
    console.error(`[ORDERS] Order fetch failed: orderId=${orderId} error=${fetchError?.message}`);
    await sendText(phone, "Sorry, we couldn't find that order. Please try again.");
    return;
  }
  console.log(`[ORDERS] Order found: id=${orderId} status=${order.status} slot=${order.slot} phoneMatch=${order.phone === phone}`);

  if (order.phone !== phone) {
    console.error(`[ORDERS] Ownership mismatch: orderPhone=${order.phone} requesterPhone=${phone}`);
    await sendText(phone, "Sorry, something went wrong. Please try again.");
    return;
  }

  if (order.status !== "pending") {
    console.log(`[ORDERS] Order not pending: orderId=${orderId} status=${order.status}`);
    const alreadyMsg =
      order.status === "confirmed"
        ? "✅ This order has already been confirmed."
        : order.status === "skipped"
          ? "⏭️ This order has already been skipped."
          : "ℹ️ This order has already been processed.";
    await sendText(phone, alreadyMsg);
    return;
  }

  if (isPastDeadline(order)) {
    console.log(`[ORDERS] Deadline passed: orderId=${orderId} accept_until=${order.accept_until} bypass=${process.env.BYPASS_DEADLINE_CHECK}`);
    await sendText(phone, deadlineMessage(order));
    return;
  }

  console.log(`[ORDERS] Proceeding to action=${action}`);
  switch (action) {
    case "CONFIRM": {
      const { error: confirmError } = await supabase
        .from("orders")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", orderId);

      if (confirmError) {
        console.error("[DB] CONFIRM update failed:", confirmError.message);
        await sendText(phone, "Sorry, something went wrong confirming your order. Please try again.");
        break;
      }

      await sendText(
        phone,
        "✅ *Confirmed!* Your meal is locked in.\n\nWe'll notify you once it's on the way 🚀",
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
        await sendText(phone, "Sorry, something went wrong skipping your order. Please try again.");
        break;
      }

      let pushedDate = null;
      if (order.subscription_id) {
        const { data: sub } = await supabase
          .from("meal_plan_subscriptions")
          .select("end_date")
          .eq("id", order.subscription_id)
          .single();

        if (sub?.end_date) {
          pushedDate = addDeliveryDays(sub.end_date, 1);

          const { data: existing } = await supabase
            .from("orders")
            .select("id")
            .eq("slot_id", order.slot_id)
            .eq("delivery_date", pushedDate)
            .maybeSingle();

          if (!existing) {
            await supabase.from("orders").insert({
              subscription_id: order.subscription_id,
              slot_id: order.slot_id,
              phone,
              delivery_date: pushedDate,
              slot: order.slot,
              delivery_time: order.delivery_time,
              item_id: order.item_id,
              item_name: order.item_name,
              is_default: false,
              status: "pending",
            });
          }

        }
      }

      if (pushedDate) {
        const dateStr = new Date(pushedDate + "T00:00:00Z").toLocaleDateString("en-IN", {
          weekday: "long", day: "numeric", month: "long",
        });
        await sendText(
          phone,
          `⏭️ *Skipped!* This meal has been moved to *${dateStr}* (added to the end of your plan).`,
        );
      } else {
        await sendText(
          phone,
          "⏭️ *Skipped!* No delivery for this slot today.\n\nSee you next time 👋",
        );
      }
      break;
    }

    case "CHANGE": {
      console.log(`[ORDERS] CHANGE case: setting session to CHANGING_MEAL for phone=${phone}`);
      await setSession(phone, {
        ...session,
        state: STATES.CHANGING_MEAL,
        data: { orderId },
      });

      let items;
      try {
        const fetched = await getMenuItems();
        console.log(`[ORDERS] getMenuItems returned ${fetched?.length ?? 0} items`);
        if (!fetched?.length) throw new Error("empty menu");
        items = fetched;
      } catch (e) {
        console.error(`[ORDERS] Menu fetch failed: ${e.message}`);
        await sendText(
          phone,
          "😔 Sorry, we're having trouble loading today's menu. Please try again later or contact support.",
        );
        return;
      }

      const rows = items.map((item) => ({
        id: `MEAL_${orderId}_${item.itemid}`,
        title: item.itemname.substring(0, 24),
        description: `₹${item.price} · ${item.item_type === "1" ? "Veg" : "Non-Veg"}`,
      }));

      console.log(`[ORDERS] Sending menu list with ${rows.length} items to ${phone}`);
      await sendList(
        phone,
        "🔄 *Change your meal*\n\nPick from today's available options:",
        "View Menu",
        [{ title: "Today's Menu", rows }],
      );
      console.log(`[ORDERS] Menu list sent successfully to ${phone}`);
      break;
    }

    default:
      await sendText(phone, "Sorry, I didn't understand that. Please use the buttons.");
  }
}

export async function handleMealChange(phone, session, listId, setSession) {
  const parts = listId.split("_");
  const orderId = parts[1];
  const itemId = parts[2];
  console.log(`[ORDERS] handleMealChange: phone=${phone} orderId=${orderId} itemId=${itemId}`);

  if (!orderId || !itemId) {
    console.log(`[ORDERS] handleMealChange: missing orderId/itemId from listId=${listId}`);
    await sendText(phone, "Sorry, something went wrong. Please try again.");
    return;
  }

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("phone, status, slot, accept_until")
    .eq("id", orderId)
    .single();

  if (fetchError || !order) {
    console.error("[DB] Order fetch failed:", fetchError?.message);
    await sendText(phone, "Sorry, we couldn't find that order. Please try again.");
    return;
  }

  if (order.phone !== phone) {
    console.error("[SECURITY] Order ownership mismatch on meal change:", { orderPhone: order.phone, requesterPhone: phone });
    await sendText(phone, "Sorry, something went wrong. Please try again.");
    return;
  }

  if (order.status !== "pending") {
    await sendText(phone, "ℹ️ This order has already been processed and can't be changed.");
    return;
  }

  if (isPastDeadline(order)) {
    await sendText(phone, deadlineMessage(order));
    return;
  }

  let itemName = "Selected meal";
  try {
    const items = await getMenuItems();
    const item = items.find((i) => i.itemid === itemId);
    if (item) itemName = item.itemname;
  } catch (e) {
    console.error("[PETPOOJA] Error resolving item name:", e.message);
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
    await sendText(phone, "Sorry, something went wrong updating your meal. Please try again.");
    return;
  }

  await sendText(
    phone,
    `✅ *Meal updated!*\n\nYour new meal: *${itemName}*\n\nWe'll have it ready for your slot 🍽️`,
  );

  await setSession(phone, { state: "GREETING", data: {} });
}
