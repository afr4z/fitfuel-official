import { sendButtons, sendText, sendWithTemplateFallback } from "./whatsapp.js";

function buildInteractiveBody(to, body, buttons) {
  if (buttons && buttons.length > 0) {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body },
        action: {
          buttons: buttons.map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    };
  }
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body },
  };
}

export async function sendNotification(phone, templateName, templateParams, fallbackBody, fallbackButtons) {
  const interactiveBody = buildInteractiveBody(phone, fallbackBody, fallbackButtons);
  const templateComponents = [{ type: "body", parameters: templateParams }];
  return sendWithTemplateFallback(phone, interactiveBody, templateName, templateComponents, "en");
}

export async function sendSimpleNotification(phone, templateName, templateParams, fallbackBody) {
  return sendNotification(phone, templateName, templateParams, fallbackBody, null);
}