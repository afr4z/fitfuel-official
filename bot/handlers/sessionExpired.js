import { sendText } from "../../lib/whatsapp.js";
import { STATES } from "../states.js";

export async function handleSessionExpired(phone, session, setSession) {
  await setSession(phone, { state: STATES.GREETING, data: {} });

  await sendText(
    phone,
    `⏰ *Your session expired due to inactivity.*\n\n` +
      `Type *hi* to start again!`,
  );
}
