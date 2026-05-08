console.log("[BOOT] webhook function starting");
import { handleIncoming } from "../bot/handler.js";

function extractMessage(body) {
  try {
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    if (!value?.messages?.length) return null;
    const msg = value.messages[0];
    if (msg?.origin?.type === "business") return null;
    return { from: msg.from, message: msg };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const {
      "hub.mode": mode,
      "hub.verify_token": token,
      "hub.challenge": challenge,
    } = req.query;
    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: "Verification failed" });
  }

  if (req.method === "POST") {
    const extracted = extractMessage(req.body);
    if (extracted) {
      const { from, message } = extracted;
      try {
        await handleIncoming(from, message);
      } catch (e) {
        console.error("[BOT] Error:", e.message, e.stack);
      }
    }

    return res.status(200).json({ status: "ok" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
