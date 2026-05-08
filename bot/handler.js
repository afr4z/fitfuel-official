import { createClient } from "@supabase/supabase-js";
import { getSession, setSession } from "./session.js";
import { STATES } from "./states.js";
import { handleGreeting } from "./handlers/greeting.js";
import { handleMainMenu } from "./handlers/menu.js";
import { handleOrderAction, handleMealChange } from "./handlers/orders.js";
import { getMenuItems } from "../lib/petpooja.js";
import {
  handlePlanCategory,
  handleDaySelection,
  handleMealSlotSelection,
  handleLocation,
  handleAddress,
  startSubscription,
} from "./handlers/subscription.js";
import { handleSessionExpired } from "./handlers/sessionExpired.js";
import { sendText, sendLocationRequest } from "../lib/whatsapp.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Keywords that trigger "go back" navigation regardless of state
const BACK_KEYWORDS = new Set(["back", "menu", "home", "0", "restart"]);

// Maximum age (in seconds) for an interactive message to be acted upon.
// Order-action buttons (CONFIRM/SKIP/CHANGE) expire faster since they have
// hard meal-slot cutoffs; all other interactive buttons use a wider window.
const ORDER_BUTTON_TTL_SECONDS = 15 * 60; // 15 minutes
const MENU_BUTTON_TTL_SECONDS = 30 * 60; // 30 minutes

/**
 * Returns true if the WhatsApp message timestamp is older than `ttlSeconds`.
 * `message.timestamp` is a Unix epoch string (seconds).
 */
function isStale(message, ttlSeconds) {
  const ts = parseInt(message.timestamp, 10);
  if (!ts || isNaN(ts)) return false; // no valid timestamp — allow through
  return Math.floor(Date.now() / 1000) - ts > ttlSeconds;
}

/**
 * Navigate the user back to the previous step in the onboarding flow.
 * Sends a short confirmation before re-rendering the parent step.
 */
async function handleBack(phone, session, setSession) {
  await sendText(phone, `↩️ Going back…`);

  switch (session.state) {
    case STATES.SELECTING_DAYS:
      // Back to plan-category list
      return startSubscription(phone, session, setSession);

    case STATES.SELECTING_MEALS_PER_DAY:
      // Back to duration selection — planId is still in session.data
      return handlePlanCategory(
        phone,
        session,
        session.data.planId,
        setSession,
      );

    case STATES.AWAITING_LOCATION: {
      // Back to meals-per-day selection — reconstruct the day option id
      const dayId = `DAYS_${session.data.days}`;
      return handleDaySelection(phone, session, dayId, setSession);
    }

    case STATES.AWAITING_ADDRESS: {
      // Back to location prompt
      await setSession(phone, { ...session, state: STATES.AWAITING_LOCATION });
      try {
        await sendLocationRequest(
          phone,
          `📍 *Where should we deliver?*\n\nTap the button below to share your location, or type your area / neighbourhood name.`,
        );
      } catch {
        await sendText(
          phone,
          `📍 *Where should we deliver?*\n\nType your area / neighbourhood name.`,
        );
      }
      return;
    }

    case STATES.AWAITING_PAYMENT: {
      // Abort pending payment and restart
      return resetToGreeting(phone, session, setSession);
    }

    case STATES.SELECTING_MEAL_SLOT:
      // Back to greeting from slot picker
      return resetToGreeting(phone, session, setSession);

    default: {
      return resetToGreeting(phone, session, setSession);
    }
  }
}

/** Resets the session to GREETING and shows the welcome screen. */
async function resetToGreeting(phone, session, setSession) {
  const fresh = { state: STATES.GREETING, data: {} };
  await setSession(phone, fresh);
  return handleGreeting(phone, fresh, setSession);
}

/**
 * Returns true if `input` is an order-action button (per-order actions tied to
 * a specific meal notification).  These buttons are always routed immediately,
 * bypassing session-expiry checks, so users can confirm/skip/change meals
 * regardless of stale onboarding sessions.
 */
function isOrderAction(input) {
  return (
    input.startsWith("CONFIRM_") ||
    input.startsWith("SKIP_") ||
    input.startsWith("CHANGE_") ||
    input.startsWith("MEAL_")
  );
}

export async function handleIncoming(phone, message) {
  console.log(`[HANDLER] Incoming: phone=${phone} type=${message.type} msgTs=${message.timestamp}`);
  const session = await getSession(phone);
  console.log(`[HANDLER] Session state=${session.state}`);

  const buttonId = message.interactive?.button_reply?.id || "";
  const listId = message.interactive?.list_reply?.id || "";
  const input = buttonId || listId;
  if (input) console.log(`[HANDLER] Input detected: ${input}`);

  // ── Order-action buttons (CONFIRM/SKIP/CHANGE/MEAL) ──────────────────────
  // These are tied to a specific meal notification with a 15-minute TTL and
  // MUST work regardless of session state — the user may have an expired
  // onboarding session but still needs to respond to a meal notification.
  if (isOrderAction(input)) {
    console.log(`[HANDLER] Order action received: phone=${phone} input=${input} msgTs=${message.timestamp}`);
    if (isStale(message, ORDER_BUTTON_TTL_SECONDS)) {
      console.log(`[HANDLER] Stale order button rejected: phone=${phone} input=${input}`);
      await sendText(
        phone,
        `⏰ That button has expired — it's from an older message.\n\nType *hi* to start fresh!`,
      );
      return;
    }

    if (input.startsWith("MEAL_")) {
      console.log(`[HANDLER] Routing to handleMealChange: phone=${phone}`);
      return handleMealChange(phone, session, input, setSession);
    }
    console.log(`[HANDLER] Routing to handleOrderAction: phone=${phone}`);
    return handleOrderAction(phone, session, input, setSession);
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Session expiry check — only applies to non-order interactions
  if (session.state === STATES.SESSION_EXPIRED) {
    return handleSessionExpired(phone, session, setSession);
  }

  // WhatsApp location share
  if (message.type === "location") {
    if (session.state === STATES.AWAITING_LOCATION) {
      return handleLocation(phone, session, message, setSession);
    }
    return; // ignore location in other states
  }

  // Text input
  if (message.type === "text") {
    const text = message.text.body.trim().toLowerCase();

    // "Go back" shortcut — works in any onboarding state
    if (BACK_KEYWORDS.has(text)) {
      return handleBack(phone, session, setSession);
    }

    if (session.state === STATES.AWAITING_LOCATION) {
      return handleLocation(phone, session, message, setSession);
    }
    if (session.state === STATES.AWAITING_ADDRESS) {
      return handleAddress(phone, session, message.text.body, setSession);
    }
  }

  // Any unrecognised input or plain text → show main menu
  if (!input) {
    return resetToGreeting(phone, session, setSession);
  }

  // --- Stale-button guard (menu/onboarding buttons) ------------------------
  if (isStale(message, MENU_BUTTON_TTL_SECONDS)) {
    await sendText(
      phone,
      `⏰ That button has expired — it's from an older message.\n\nType *hi* to start fresh!`,
    );
    return;
  }
  // -------------------------------------------------------------------------

  // Renew / new subscription — handle from any state (expiry reminder, greeting, MY_PLAN)
  if (input === "ORDER_NOW") {
    return startSubscription(phone, session, setSession);
  }

  // Subscription onboarding inputs — only valid in the matching state.
  // If the session expired (state reset) these stale button IDs fall through
  // to the default which shows the greeting.
  if (
    input.startsWith("PLAN_") &&
    session.state === STATES.SELECTING_PLAN_CATEGORY
  ) {
    return handlePlanCategory(phone, session, input, setSession);
  }
  if (input.startsWith("DAYS_") && session.state === STATES.SELECTING_DAYS) {
    return handleDaySelection(phone, session, input, setSession);
  }
  if (
    input.startsWith("MEALS_") &&
    session.state === STATES.SELECTING_MEALS_PER_DAY
  ) {
    return handleMealSlotSelection(phone, session, input, setSession);
  }

  switch (session.state) {
    case STATES.GREETING:
      return handleGreeting(phone, session, setSession);

    case STATES.MAIN_MENU:
      return handleMainMenu(phone, session, input, setSession);

    case STATES.CHANGING_MEAL:
      console.log(`[HANDLER] CHANGING_MEAL state: routing text input to handleOrderAction for phone=${phone}`);
      return handleOrderAction(
        phone,
        session,
        `CHANGE_${session.data.orderId}`,
        setSession,
      );

    case STATES.SELECTING_MEAL_SLOT: {
      if (input.startsWith("PICK_SLOT_")) {
        const orderId = input.replace("PICK_SLOT_", "");
        if (!orderId) return resetToGreeting(phone, session, setSession);

        await setSession(phone, {
          ...session,
          state: STATES.CHANGING_MEAL,
          data: { orderId },
        });

        // Look up the subscription to filter menu items by meal plan
        let mealPlanId;
        try {
          const { data: ord } = await supabase
            .from("orders")
            .select("subscription_id")
            .eq("id", orderId)
            .single();
          if (ord?.subscription_id) {
            const { data: sub } = await supabase
              .from("meal_plan_subscriptions")
              .select("meal_plan_id")
              .eq("id", ord.subscription_id)
              .single();
            mealPlanId = sub?.meal_plan_id;
          }
        } catch (_) {}

        let items = [];
        try {
          const fetched = await getMenuItems({ mealPlanId });
          if (fetched.length) items = fetched;
        } catch (e) {
          console.error("[DB] Error fetching menu:", e.message);
        }

        if (items.length === 0) {
          await sendText(
            phone,
            `Sorry, the menu is unavailable right now. Please try again later.`,
          );
          return;
        }

        const rows = items.map((item) => ({
          id: `MEAL_${orderId}_${item.itemid}`,
          title: item.itemname.substring(0, 24),
          description: `₹${item.price} · ${item.item_type === "1" ? "Veg" : "Non-Veg"}`,
        }));
        await sendList(
          phone,
          `🔄 *Change your meal*\n\nPick from today's options:`,
          "View Menu",
          [{ title: "Menu", rows }],
        );
        return;
      }
      return resetToGreeting(phone, session, setSession);
    }

    case STATES.AWAITING_PAYMENT:
      await sendText(
        phone,
        `⏳ *Payment Pending*\n\nPlease complete your payment using the link we sent you.\n\nType *back*, *menu*, or *home* to cancel and start over.`,
      );
      return;

    default:
      return handleGreeting(phone, session, setSession);
  }
}
