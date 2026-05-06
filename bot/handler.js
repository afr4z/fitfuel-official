import { getSession, setSession } from "./session.js";
import { STATES } from "./states.js";
import { handleGreeting } from "./handlers/greeting.js";
import { handleMainMenu } from "./handlers/menu.js";
import { handleOrderAction, handleMealChange } from "./handlers/orders.js";
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

  // Order action buttons from cron notifications
  if (
    input.startsWith("CONFIRM_") ||
    input.startsWith("SKIP_") ||
    input.startsWith("CHANGE_")
  ) {
    return handleOrderAction(phone, session, input, setSession);
  }

  // Meal selection from change flow
  if (input.startsWith("MEAL_")) {
    return handleMealChange(phone, session, input, setSession);
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
