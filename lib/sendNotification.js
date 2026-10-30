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

/**
 * Turns reply buttons into template `button` components so the template can
 * carry per-order payloads (`CONFIRM_<uuid>`). Quick-reply buttons are declared
 * statically in the template, but Meta honours a `quick_reply` payload supplied
 * at send time — without this, a tap arrives as the bare button title ("Confirm")
 * and cannot be matched to an order.
 */
function buildTemplateButtons(buttons) {
  return buttons.map((b, index) => ({
    type: "button",
    sub_type: "quick_reply",
    index: String(index),
    parameters: [{ type: "payload", payload: b.id }],
  }));
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
  if (fallbackButtons && fallbackButtons.length > 0) {
    templateComponents.push(...buildTemplateButtons(fallbackButtons));
  }
  return sendWithTemplateFallback(
    phone,
    interactiveBody,
    templateName,
    templateComponents,
    languageCode,
  );
}
