export async function handleIncoming(phone, message) {
  const session = await getSession(phone);

  const buttonId = message.interactive?.button_reply?.id || "";
  const listId = message.interactive?.list_reply?.id || "";
  const input = buttonId || listId;

  console.log(`[HANDLER] phone=${phone} state=${session.state} input=${input}`);

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

  // Meal selection
  if (input.startsWith("MEAL_")) {
    return handleMealChange(phone, session, input, setSession);
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

    default:
      return handleGreeting(phone, session, setSession);
  }
}
