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
} from "./handlers/subscription.js";
import { sendText } from "../lib/whatsapp.js";

export async function handleIncoming(phone, message) {
  const session = await getSession(phone);

  const buttonId = message.interactive?.button_reply?.id || "";
  const listId = message.interactive?.list_reply?.id || "";
  const input = buttonId || listId;

  console.log(`[HANDLER] phone=${phone} state=${session.state} input=${input}`);

  // WhatsApp location share
  if (message.type === "location") {
    if (session.state === STATES.AWAITING_LOCATION) {
      return handleLocation(phone, session, message, setSession);
    }
    return; // ignore location in other states
  }

  // Text input during onboarding steps that expect free text
  if (message.type === "text") {
    if (session.state === STATES.AWAITING_LOCATION) {
      return handleLocation(phone, session, message, setSession);
    }
    if (session.state === STATES.AWAITING_ADDRESS) {
      return handleAddress(phone, session, message.text.body, setSession);
    }
  }

  // Any unrecognised input or plain text → show main menu
  if (!input) {
    const fresh = { state: STATES.GREETING, data: {} };
    await setSession(phone, fresh);
    return handleGreeting(phone, fresh, setSession);
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
  if (input.startsWith("PLAN_") && session.state === STATES.SELECTING_PLAN_CATEGORY) {
    return handlePlanCategory(phone, session, input, setSession);
  }
  if (input.startsWith("DAYS_") && session.state === STATES.SELECTING_DAYS) {
    return handleDaySelection(phone, session, input, setSession);
  }
  if (input.startsWith("MEALS_") && session.state === STATES.SELECTING_MEALS_PER_DAY) {
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
        `⏳ *Payment Pending*\n\nPlease complete your payment using the link we sent you.\n\nType anything to restart from the beginning.`,
      );
      return;

    default:
      return handleGreeting(phone, session, setSession);
  }
}
