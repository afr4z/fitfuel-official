const BASE_URL = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const MEDIA_URL = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`;

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

const ALTERNATE_LANGUAGE = { en: "en_US", en_US: "en" };

/**
 * Sends a template, retrying once in the other English variant when Meta
 * reports 132001 ("template name does not exist in the translation"). Some
 * templates in this account are approved as `en` and others as `en_US`, and
 * the language is not discoverable without the WABA ID, so guessing wrong
 * would silently drop the message.
 */
async function sendTemplateAnyLanguage(
  phone,
  templateName,
  components,
  languageCode,
) {
  try {
    return await sendTemplate(phone, templateName, languageCode, components);
  } catch (err) {
    const alternate = ALTERNATE_LANGUAGE[languageCode];
    if (err instanceof WhatsAppError && err.code === 132001 && alternate) {
      console.log(
        `[WA] ${templateName} missing in ${languageCode}, retrying as ${alternate}`,
      );
      return sendTemplate(phone, templateName, alternate, components);
    }
    throw err;
  }
}

export async function sendWithTemplateFallback(
  phone,
  interactiveBody,
  templateName,
  templateParams,
  languageCode = "en",
) {
  try {
    return await post(interactiveBody);
  } catch (err) {
    if (err instanceof WhatsAppError && err.code === 131047) {
      console.log(
        `[WA] Re-engagement required for ${phone}, falling back to template: ${templateName}`,
      );
      return sendTemplateAnyLanguage(
        phone,
        templateName,
        templateParams,
        languageCode,
      );
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

/**
 * Uploads media to the WhatsApp Cloud API and returns its media id.
 * The id can be reused in `sendDocument` / `sendImage`.
 */
export async function uploadMedia(buffer, mimeType, filename) {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch(MEDIA_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    },
    body: form,
  });

  if (!res.ok) {
    const raw = await res.text();
    let err;
    try {
      err = JSON.parse(raw);
    } catch {
      err = raw;
    }
    console.error("[WA] Media upload error:", JSON.stringify(err));
    throw new WhatsAppError(
      `Graph API media upload failed (${res.status}): ${JSON.stringify(err)}`,
      extractErrorCode(err),
      res.status,
      err,
    );
  }

  return res.json();
}

/**
 * Sends a document via media id or a public link.
 * `document: { id }` or `document: { link }` is required.
 */
export async function sendDocument(to, { id, link, filename, caption }) {
  if (!id && !link) {
    throw new Error("sendDocument: either id or link is required");
  }
  return post({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "document",
    document: {
      ...(id ? { id } : { link }),
      ...(filename ? { filename } : {}),
      ...(caption ? { caption } : {}),
    },
  });
}

/**
 * Sends a document as a free-form message, falling back to an approved
 * WhatsApp template with a document header when the 24-hour customer service
 * window is closed.
 */
export async function sendDocumentWithTemplateFallback(
  to,
  { id, filename, caption },
  templateName,
  languageCode = "en",
) {
  try {
    return await sendDocument(to, { id, filename, caption });
  } catch (err) {
    if (err instanceof WhatsAppError && err.code === 131047 && templateName) {
      console.log(
        `[WA] Re-engagement required for ${to}, falling back to document template: ${templateName}`,
      );
      return sendTemplate(to, templateName, languageCode, [
        {
          type: "header",
          parameters: [
            {
              type: "document",
              document: { id, ...(filename ? { filename } : {}) },
            },
          ],
        },
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: String(caption || filename || "Invoice")
                .replace(/\s+/g, " ")
                .slice(0, 900),
            },
          ],
        },
      ]);
    }
    throw err;
  }
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

/**
 * Sends an interactive message with a single call-to-action URL button.
 * WhatsApp allows exactly one `cta_url` button per message, and it cannot be
 * combined with reply buttons.
 */
export async function sendCtaUrl(to, body, displayText, url) {
  return post({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text: body },
      action: {
        name: "cta_url",
        parameters: { display_text: displayText, url },
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
