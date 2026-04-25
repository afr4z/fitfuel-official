import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sendText } from "../lib/whatsapp.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

function verifySignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  // Skip verification when secret is not configured (local dev)
  if (!secret) return true;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const digestBuf = Buffer.from(digest, "hex");
  const sigBuf = Buffer.from(signature, "hex");
  // timingSafeEqual throws if buffers differ in length
  if (digestBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(digestBuf, sigBuf);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const signature = req.headers["x-razorpay-signature"] || "";
  const rawBody = JSON.stringify(req.body);

  if (!verifySignature(rawBody, signature)) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  const { event, payload } = req.body || {};

  try {
    if (event === "payment_link.paid") {
      const subscriptionId = payload?.payment_link?.entity?.reference_id;
      const paymentId = payload?.payment?.entity?.id;

      if (!subscriptionId) {
        return res.status(200).json({ status: "ignored" });
      }

      // Mark subscription as active
      const { error: updateError } = await supabase
        .from("subscriptions")
        .update({
          status: "active",
          razorpay_payment_id: paymentId,
          paid_at: new Date().toISOString(),
        })
        .eq("id", subscriptionId);

      if (updateError) {
        console.error("[WEBHOOK] Failed to activate subscription:", updateError.message);
        return res.status(500).json({ error: "DB update failed" });
      }

      // Fetch subscription to get phone number
      const { data: subscription, error: fetchError } = await supabase
        .from("subscriptions")
        .select()
        .eq("id", subscriptionId)
        .single();

      if (fetchError) {
        console.error("[WEBHOOK] Failed to fetch subscription:", fetchError.message);
        return res.status(500).json({ error: "DB fetch failed" });
      }

      if (subscription?.phone) {
        await sendText(
          subscription.phone,
          `🎉 *Payment Confirmed!*\n\n` +
            `Your FitFuel *${subscription.plan_title}* subscription is now *active*!\n\n` +
            `📦 Deliveries start from tomorrow.\n` +
            `You'll get a daily notification before each meal to confirm, skip, or change it.\n\n` +
            `Thank you for choosing FitFuel! 💪`,
        );
      }
    }
  } catch (err) {
    console.error("[WEBHOOK] Unhandled error:", err.message, err.stack);
    return res.status(500).json({ error: "Internal error" });
  }

  return res.status(200).json({ status: "ok" });
}
