import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sendText } from "../lib/whatsapp.js";
import { getSession, clearSession } from "../bot/session.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
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

/** Map subscription duration in days to the plan_type enum expected by the DB. */
function toPlanType(days) {
  return days === 7 ? "weekly" : "monthly";
}

/** Return ISO date strings for start (tomorrow) and end (start + days - 1). */
function calcDates(days) {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);
  return {
    start_date: start.toISOString().split("T")[0],
    end_date: end.toISOString().split("T")[0],
  };
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
      const phone = payload?.payment_link?.entity?.reference_id;
      const razorpayPaymentLinkId = payload?.payment_link?.entity?.id;
      const razorpayPaymentId = payload?.payment?.entity?.id;

      if (!phone) {
        return res.status(200).json({ status: "ignored" });
      }

      // Retrieve the pending subscription details stored in the user's session
      const session = await getSession(phone);
      const { planId, planTitle, days, mealLabel, dayLabel, amount } =
        session?.data || {};

      if (!planId || !days) {
        console.error("[WEBHOOK] No pending session found for phone:", phone);
        return res.status(200).json({ status: "ignored" });
      }

      // Upsert customer (create if new, reuse if existing)
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .upsert({ phone }, { onConflict: "phone" })
        .select("id")
        .single();

      if (customerError) {
        console.error("[WEBHOOK] Customer upsert failed:", customerError.message);
        return res.status(500).json({ error: "Customer upsert failed" });
      }

      // Create the subscription record
      const { start_date, end_date } = calcDates(days);
      const { error: insertError } = await supabase
        .from("meal_plan_subscriptions")
        .insert({
          customer_id: customer.id,
          phone,
          plan_type: toPlanType(days),
          status: "active",
          start_date,
          end_date,
          payment_status: "paid",
          razorpay_order_id: razorpayPaymentLinkId || null,
          razorpay_payment_id: razorpayPaymentId || null,
        });

      if (insertError) {
        console.error("[WEBHOOK] Subscription insert failed:", insertError.message);
        return res.status(500).json({ error: "Subscription insert failed" });
      }

      // Clear the session — user's flow is complete
      await clearSession(phone);

      // Notify the customer on WhatsApp
      await sendText(
        phone,
        `🎉 *Payment Confirmed!*\n\n` +
          `Your FitFuel *${planTitle}* plan is now *active*!\n\n` +
          `📅 Duration: ${dayLabel}\n` +
          `🍴 Meals: ${mealLabel}\n` +
          `💰 Amount paid: ₹${amount}\n\n` +
          `📦 Deliveries start from tomorrow (${start_date}).\n` +
          `You'll get a daily notification before each meal to confirm, skip, or change it.\n\n` +
          `Thank you for choosing FitFuel! 💪`,
      );
    }
  } catch (err) {
    console.error("[WEBHOOK] Unhandled error:", err.message, err.stack);
    return res.status(500).json({ error: "Internal error" });
  }

  return res.status(200).json({ status: "ok" });
}
