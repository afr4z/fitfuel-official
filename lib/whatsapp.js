const BASE_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

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
    throw new Error(`Graph API request failed (${res.status})`);
  }
  return res.json();
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
