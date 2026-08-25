import { sendText } from "../../lib/whatsapp.js";
import { STATES } from "../states.js";
import { SESSION_EXPIRED } from "../config/messages.js";

export async function handleSessionExpired(phone, session, setSession) {
  await setSession(phone, { state: STATES.GREETING, data: {} });

  await sendText(phone, SESSION_EXPIRED);
}
