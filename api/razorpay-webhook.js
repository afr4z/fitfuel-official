import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sendText } from "../lib/whatsapp.js";
import { getSession, clearSession } from "../bot/session.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Default delivery times per slot
const SLOT_DELIVERY_TIMES = {
  breakfast: "08:00:00",
  lunch: "12:30:00",
  dinner: "19:30:00",
};

// Map mealOption id → slot names
const MEAL_OPTION_SLOTS = {
  MEALS_1: ["breakfast"],
  MEALS_2: ["lunch", "dinner"],
  MEALS_3: ["breakfast", "lunch", "dinner"],
};

function verifySignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return true;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const digestBuf = Buffer.from(digest, "hex");
  const sigBuf = Buffer.from(signature, "hex");
  if (digestBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(digestBuf, sigBuf);
}

function toPlanType(days) {
  return days === 7 ? "weekly" : "monthly";
}

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

  function phoneFromLink() {
    return payload?.payment_link?.entity?.reference_id?.split("_")[0] || null;
  }

  function phoneFromPayment() {
    const contact = payload?.payment?.entity?.contact || "";
    return contact.replace(/^\+/, "") || null;
  }

  async function handleFailure(phone, reason) {
    if (!phone) return;
    await clearSession(phone);
    await sendText(
      phone,
      `❌ *Payment ${reason}*\n\n` +
        `Unfortunately your FitFuel order could not be completed.\n\n` +
        `Please send us a message to start a new order whenever you're ready. We're here to help! 🙏`,
    );
  }

  try {
    if (event === "payment_link.paid") {
      const phone = phoneFromLink();
      const razorpayPaymentLinkId = payload?.payment_link?.entity?.id;
      const razorpayPaymentId = payload?.payment?.entity?.id;

      if (!phone) {
        return res.status(200).json({ status: "ignored" });
      }

      const session = await getSession(phone);
      const {
        planId,
        planTitle,
        days,
        mealLabel,
        dayLabel,
        amount,
        mealsPerDay,
      } = session?.data || {};

      if (!planId || !days) {
        console.error("[WEBHOOK] No pending session found for phone:", phone);
        return res.status(200).json({ status: "ignored" });
      }

      // Validate plan_type
      const planType = toPlanType(days);
      if (!["weekly", "monthly"].includes(planType)) {
        console.error("[WEBHOOK] Invalid plan_type:", days, "->", planType);
        return res.status(500).json({ error: "Invalid plan type" });
      }

      // Validate dates
      const { start_date, end_date } = calcDates(days);
      if (!start_date || !end_date) {
        console.error("[WEBHOOK] Invalid dates:", { start_date, end_date });
        return res.status(500).json({ error: "Invalid subscription dates" });
      }

      // Upsert customer
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .upsert({ phone }, { onConflict: "phone" })
        .select("id")
        .single();

      if (customerError) {
        console.error(
          "[WEBHOOK] Customer upsert failed:",
          JSON.stringify(customerError),
        );
        return res.status(500).json({ error: "Customer upsert failed" });
      }

      // Insert subscription
      const { data: subscription, error: insertError } = await supabase
        .from("meal_plan_subscriptions")
        .insert({
          customer_id: customer.id,
          phone,
          plan_type: planType,
          status: "active",
          start_date,
          end_date,
          payment_status: "paid",
          razorpay_order_id: razorpayPaymentLinkId ?? null,
          razorpay_payment_id: razorpayPaymentId ?? null,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(
          "[WEBHOOK] Subscription insert failed:",
          JSON.stringify(insertError),
        );
        return res.status(500).json({ error: "Subscription insert failed" });
      }

      console.log(
        "[WEBHOOK] Subscription created:",
        subscription.id,
        "for phone:",
        phone,
      );

      // Determine which slots to create from the session's planId
      // Session stores the MEALS_X option id — find which one was chosen
      // mealsPerDay is stored in session; map it back to slot names
      const mealOptionId =
        mealsPerDay === 1
          ? "MEALS_1"
          : mealsPerDay === 2
            ? "MEALS_2"
            : "MEALS_3";
      const slotNames = MEAL_OPTION_SLOTS[mealOptionId] ?? ["breakfast"];

      // Insert subscription_slots
      const slotRows = slotNames.map((slot) => ({
        subscription_id: subscription.id,
        slot,
        delivery_time: SLOT_DELIVERY_TIMES[slot],
        default_item_id: null,
        default_item_name: null,
      }));

      const { error: slotsError } = await supabase
        .from("subscription_slots")
        .insert(slotRows);

      if (slotsError) {
        console.error(
          "[WEBHOOK] Slots insert failed:",
          JSON.stringify(slotsError),
        );
        // Non-fatal: subscription exists, slots can be fixed manually
        // But log clearly so you know
      } else {
        console.log(
          "[WEBHOOK] Inserted",
          slotRows.length,
          "slots for subscription:",
          subscription.id,
        );
      }

      // Clear session
      await clearSession(phone);

      // Notify customer on WhatsApp
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
    } else if (event === "payment_link.cancelled") {
      const phone = phoneFromLink();
      console.log("[WEBHOOK] Payment link cancelled for phone:", phone);
      await handleFailure(phone, "Cancelled");
    } else if (event === "payment_link.expired") {
      const phone = phoneFromLink();
      console.log("[WEBHOOK] Payment link expired for phone:", phone);
      await handleFailure(phone, "Link Expired");
    } else if (event === "payment.failed") {
      const phone = phoneFromPayment();
      console.log("[WEBHOOK] Payment failed for phone:", phone);
      await handleFailure(phone, "Failed");
    }
  } catch (err) {
    console.error("[WEBHOOK] Unhandled error:", err.message, err.stack);
    return res.status(500).json({ error: "Internal error" });
  }

  return res.status(200).json({ status: "ok" });
}
