const BASE_URL = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

export class WhatsAppError extends Error {
  constructor(message, code, status, raw) {
    super(message);
    this.name = "WhatsAppError";
    this.code = code;
    this.status = status;
    this.raw = raw;
  }
}

function extractErrorCode(err) {
  if (!err?.error) return null;
  return err.error.code ?? err.error.error_code ?? null;
}

async function post(body) {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const raw = await res.text();
    let err;
    try {
      err = JSON.parse(raw);
    } catch {
      err = raw;
    }
    console.error("[WA] Error:", JSON.stringify(err));
    const code = extractErrorCode(err);
    throw new WhatsAppError(
      `Graph API request failed (${res.status}): ${JSON.stringify(err)}`,
      code,
      res.status,
      err,
    );
  }
  return res.json();
}

export async function sendWithTemplateFallback(phone, interactiveBody, templateName, templateParams, languageCode = "en") {
  try {
    return await post(interactiveBody);
  } catch (err) {
    if (err instanceof WhatsAppError && err.code === 131047) {
      console.log(`[WA] Re-engagement required for ${phone}, falling back to template: ${templateName}`);
      return sendTemplate(phone, templateName, languageCode, templateParams);
    }
    throw err;
  }
}

export async function sendText(to, text) {
  return post({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: text },
  });
}

export async function sendButtons(to, body, buttons) {
  return post({
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
  });
}

export async function sendList(to, body, buttonLabel, sections) {
  return post({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: buttonLabel,
        sections,
      },
    },
  });
}

export async function markAsRead(messageId) {
  return post({
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });
}

export async function sendLocationRequest(to, bodyText) {
  return post({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "location_request_message",
      body: { text: bodyText },
      action: { name: "send_location" },
    },
  });
}

export async function sendTemplate(to, templateName, languageCode, components) {
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode || "en" },
      components: components || [],
    },
  };
  console.log("[WA] sendTemplate request:", JSON.stringify(body));
  const result = await post(body);
  console.log("[WA] sendTemplate response:", JSON.stringify(result));
  return result;
}
