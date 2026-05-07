import { getSession, setSession } from "./session.js";
import { STATES } from "./states.js";
import { handleGreeting } from "./handlers/greeting.js";
import { handleMainMenu } from "./handlers/menu.js";
import { handleOrderAction, handleMealChange, handleConfirmAll, handleSkipAll, handleChangeOrderStart } from "./handlers/orders.js";
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

// Keywords that trigger "go back" navigation regardless of state
const BACK_KEYWORDS = new Set(["back", "menu", "home", "0", "restart"]);

// Maximum age (in seconds) for an interactive message to be acted upon.
// Order-action buttons (CONFIRM/SKIP/CHANGE) expire faster since they have
// hard meal-slot cutoffs; all other interactive buttons use a wider window.
const ORDER_BUTTON_TTL_SECONDS = 15 * 60;   // 15 minutes
const MENU_BUTTON_TTL_SECONDS  = 30 * 60;   // 30 minutes

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

export async function handleIncoming(phone, message) {
  const session = await getSession(phone);

  if (session.state === STATES.SESSION_EXPIRED) {
    return handleSessionExpired(phone, session, setSession);
  }

  const buttonId = message.interactive?.button_reply?.id || "";
  const listId = message.interactive?.list_reply?.id || "";
  const input = buttonId || listId;

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

  // --- Stale-button guard ---------------------------------------------------
  // Order-action buttons (CONFIRM / SKIP / CHANGE) are tied to a specific
  // meal slot window; reject them after ORDER_BUTTON_TTL_SECONDS.
  // All other interactive buttons (menu, onboarding) expire after
  // MENU_BUTTON_TTL_SECONDS to prevent acting on messages from days ago.
  const isOrderButton =
    input.startsWith("CONFIRM_") ||
    input.startsWith("SKIP_") ||
    input.startsWith("CHANGE_") ||
    input.startsWith("MEAL_") ||
    input.startsWith("CONFIRM_ALL_") ||
    input.startsWith("SKIP_ALL_") ||
    input.startsWith("CHANGE_ORDER_");

  const ttl = isOrderButton ? ORDER_BUTTON_TTL_SECONDS : MENU_BUTTON_TTL_SECONDS;

  if (isStale(message, ttl)) {
    await sendText(
      phone,
      `⏰ That button has expired — it's from an older message.\n\nType *hi* to start fresh!`,
    );
    return;
  }
  // -------------------------------------------------------------------------

  // Meal selection from change flow
  if (input.startsWith("MEAL_")) {
    return handleMealChange(phone, session, input, setSession);
  }

  // Batch confirm/skip from consolidated cron message
  if (input.startsWith("CONFIRM_ALL_")) {
    return handleConfirmAll(phone, session, input, setSession);
  }

  if (input.startsWith("SKIP_ALL_")) {
    return handleSkipAll(phone, session, input, setSession);
  }

  // Start change-order flow (show slot picker)
  if (input.startsWith("CHANGE_ORDER_")) {
    return handleChangeOrderStart(phone, session, input, setSession);
  }

  // Order action buttons from cron notifications (per-order confirm/skip/change)
  if (
    input.startsWith("CONFIRM_") ||
    input.startsWith("SKIP_") ||
    input.startsWith("CHANGE_")
  ) {
    return handleOrderAction(phone, session, input, setSession);
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
      // They sent text instead of picking — resend the list
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

        let items = [];
        try {
          const fetched = await getMenuItems();
          if (fetched.length) items = fetched;
        } catch (e) {
          console.error("[DB] Error fetching menu:", e.message);
        }

        if (items.length === 0) {
          await sendText(phone, `Sorry, the menu is unavailable right now. Please try again later.`);
          return;
        }

        const rows = items.map((item) => ({
          id: `MEAL_${orderId}_${item.itemid}`,
          title: item.itemname.substring(0, 24),
          description: `₹${item.price} · ${item.item_type === "1" ? "Veg" : "Non-Veg"}`,
        }));
        await sendList(phone, `🔄 *Change your meal*\n\nPick from today's options:`, "View Menu", [{ title: "Menu", rows }]);
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

