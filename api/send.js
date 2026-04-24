const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

async function sendText(to, text) {
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }

  return res.json();
}

export default async function handler(req, res) {
  const to = req.query.to;
  const msg = req.query.msg;

  if (!to || !msg) {
    return res.status(400).json({ error: "Missing 'to' or 'msg' query param" });
  }

  try {
    const result = await sendText(to, msg);
    return res.status(200).json({ success: true, to, msg, result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
