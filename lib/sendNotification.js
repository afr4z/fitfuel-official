import { getSession } from "../bot/session.js";
import { sendButtons, sendText, sendTemplate } from "./whatsapp.js";

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

async function inWhatsAppWindow(phone) {
  const session = await getSession(phone);
  return session?.lastUserMessageAt && Date.now() - session.lastUserMessageAt < WHATSAPP_WINDOW_MS;
}

export async function sendNotification(phone, templateName, templateParams, fallbackBody, fallbackButtons) {
  const useTemplate = !(await inWhatsAppWindow(phone));
  if (useTemplate) {
    return sendTemplate(phone, templateName, "en", [{ type: "body", parameters: templateParams }]);
  }
  if (fallbackButtons) {
    return sendButtons(phone, fallbackBody, fallbackButtons);
  }
  return sendText(phone, fallbackBody);
}

export async function sendSimpleNotification(phone, templateName, templateParams, fallbackBody) {
  return sendNotification(phone, templateName, templateParams, fallbackBody, null);
}