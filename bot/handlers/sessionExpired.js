import { sendText } from "../../lib/whatsapp.js";
import { STATES } from "../states.js";

export async function handleSessionExpired(phone, setSession) {
  // Session already deleted in getSession — just reset to GREETING
  await setSession(phone, { state: STATES.GREETING, data: {} });

  await sendText(
    phone,
    `⏰ *Your session expired due to inactivity.*\n\n` +
      `No worries — type *hi* to start again!`,
  );
}
