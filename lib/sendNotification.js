import { sendWithTemplateFallback } from "./whatsapp.js";

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

export async function sendNotification(
  phone,
  templateName,
  templateParams,
  fallbackBody,
  fallbackButtons,
  languageCode = "en",
  headerParams = [],
) {
  const interactiveBody = buildInteractiveBody(
    phone,
    fallbackBody,
    fallbackButtons,
  );
  const templateComponents = [];
  if (headerParams.length > 0) {
    templateComponents.push({ type: "header", parameters: headerParams });
  }
  templateComponents.push({ type: "body", parameters: templateParams });
  return sendWithTemplateFallback(
    phone,
    interactiveBody,
    templateName,
    templateComponents,
    languageCode,
  );
}
