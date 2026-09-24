import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sendText, sendButtons } from "../lib/whatsapp.js";
import { sendNotification } from "../lib/sendNotification.js";
import { formatTimeIST, formatDateIST } from "../lib/time.js";
import { getSession, clearSession } from "../bot/session.js";
import {
  addDeliveryDays,
  countRemainingDeliveryDays,
} from "../lib/deliveryDays.js";
import {
  buildExpiryNotice,
  paymentFailed,
  kitchenClosedDaysDuringPlan,
  lateSubscriberBreakfast,
  paymentConfirmed,
} from "../bot/config/messages.js";
import {
  isPastIST,
  ensureOrder,
  acceptDeadline,
  deliveryDateForSlot,
  SLOT_LABELS,
} from "../lib/cronUtils.js";
import { resolveDeliveryAddress } from "../lib/addresses.js";

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function createMagicToken(phone, referenceId) {
  const token = `magic_${crypto.randomBytes(16).toString("hex")}`;
  const key = `magic:${token}`;
  const data = JSON.stringify({ phone, referenceId, createdAt: Date.now() });
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
    body: data,
  });
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/expire/${key}/600`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  });

  // Store referenceId -> token mapping for lookup from payment-success
  const refKey = `magic_ref:${referenceId}`;
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/set/${refKey}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
    body: JSON.stringify({ token }),
  });
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/expire/${refKey}/600`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  });

  return token;
}

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
  if (days === 3) return "3day";
  if (days === 7) return "weekly";
  if (days === 14) return "biweekly";
  return "monthly";
}

/**
 * Normalize an Indian mobile number to international format (91XXXXXXXXXX),
 * matching what the WhatsApp bot stores. Web checkouts may submit a bare
 * 10-digit number; Razorpay/WhatsApp sometimes include "+" or country code.
 */
function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0"))
    return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return null;
}

/**
 * @param {number} days      Number of delivery days for the new plan.
 * @param {string|null} [startFrom]  Optional "YYYY-MM-DD" — the first delivery day
 *                                   of the new plan. Used for renewals so the new
 *                                   subscription starts the day after the current
 *                                   plan ends. Falls back to tomorrow IST.
 */
function calcDates(days, startFrom = null) {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const todayStr = ist.toISOString().split("T")[0];

  let start;
  if (startFrom) {
    start = new Date(startFrom + "T00:00:00Z");
  } else {
    start = new Date(todayStr + "T00:00:00Z");
    start.setUTCDate(start.getUTCDate() + 1); // begin from tomorrow IST
  }

  while (start.getUTCDay() === 0) {
    start.setUTCDate(start.getUTCDate() + 1);
  }
  const startStr = start.toISOString().split("T")[0];
  // end_date = start + (days - 1) additional delivery days.
  // addDeliveryDays skips Sundays so the customer always gets the
  // exact number of delivery days they paid for.
  const endStr = addDeliveryDays(startStr, days - 1);
  return {
    start_date: startStr,
    end_date: endStr,
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

  async function handleFailure(rawPhone, reason) {
    if (!rawPhone) return;
    const phone = normalizePhone(rawPhone) || rawPhone;
    // Sessions are keyed with the phone used when the link was created, which
    // may be 10-digit for legacy web links, so clear that exact key.
    await clearSession(rawPhone);
    await sendNotification(
      phone,
      process.env.WHATSAPP_PAYMENT_FAILED_TEMPLATE || "payment_failed",
      [{ type: "text", text: reason }],
      paymentFailed({ reason }),
      null,
    );
  }

  try {
    if (event === "payment_link.paid") {
      const rawPhone = phoneFromLink();
      const razorpayPaymentLinkId = payload?.payment_link?.entity?.id;
      const razorpayPaymentId = payload?.payment?.entity?.id;

      if (!rawPhone) {
        return res.status(200).json({ status: "ignored" });
      }

      // Idempotency: a given Razorpay payment id may only ever create one
      // subscription. If this webhook has already been processed (e.g. a
      // Razorpay retry), acknowledge the duplicate without any side effects.
      if (razorpayPaymentId) {
        const { data: existing } = await supabase
          .from("meal_plan_subscriptions")
          .select("id")
          .eq("razorpay_payment_id", razorpayPaymentId)
          .maybeSingle();

        if (existing) {
          console.log(
            "[WEBHOOK] Duplicate payment_link.paid for payment:",
            razorpayPaymentId,
            "already processed as subscription:",
            existing.id,
          );
          return res.status(200).json({
            status: "duplicate",
            subscription_id: existing.id,
          });
        }
      }

      // Look the pending session up with the raw phone used when the link was
      // created (legacy web links used a bare 10-digit prefix), but persist
      // everything with the normalized international format so subscriptions
      // from WhatsApp and the website share one identity per customer.
      const session = await getSession(rawPhone);
      const phone = normalizePhone(rawPhone) || rawPhone;
      const {
        planId,
        planTitle,
        days,
        mealLabel,
        dayLabel,
        amount,
        mealsPerDay,
        renewAfterEnd,
      } = session?.data || {};

      if (!planId || !days) {
        console.error("[WEBHOOK] No pending session found for phone:", phone);
        return res.status(200).json({ status: "ignored" });
      }

      // Validate pay amount (before any DB writes): reject when the amount on
      // the payment record differs from what the pending session charged.
      // Razorpay reports amounts in paise.
      const paidPaise = payload?.payment?.entity?.amount;
      if (
        amount != null &&
        paidPaise != null &&
        Math.round(amount) * 100 !== paidPaise
      ) {
        console.error(
          "[WEBHOOK] Amount mismatch: expected ₹" + amount,
          "(" + Math.round(amount) * 100 + " paise) but payment was",
          paidPaise,
          "paise",
        );
        return res.status(400).json({
          error: "Payment amount does not match subscription",
          expected_paise: Math.round(amount) * 100,
          paid_paise: paidPaise,
        });
      }

      // Validate plan_type
      const planType = toPlanType(days);
      if (!["3day", "weekly", "biweekly", "monthly"].includes(planType)) {
        console.error("[WEBHOOK] Invalid plan_type:", days, "->", planType);
        return res.status(500).json({ error: "Invalid plan type" });
      }

      // For renewals, start the new plan the next delivery day after the current plan ends
      const startFrom = renewAfterEnd
        ? addDeliveryDays(renewAfterEnd, 1)
        : null;

      // Validate dates
      const { start_date, end_date } = calcDates(days, startFrom);
      if (!start_date || !end_date) {
        console.error("[WEBHOOK] Invalid dates:", { start_date, end_date });
        return res.status(500).json({ error: "Invalid subscription dates" });
      }

      // Upsert customer, carrying any details collected on the web checkout
      // (name/email) that were stashed in the pending session. Addresses now
      // live in the customer_addresses address book (see below).
      const details = session?.data || {};
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .upsert(
          {
            phone,
            ...(details.name ? { name: details.name } : {}),
            ...(details.email ? { email: details.email } : {}),
          },
          { onConflict: "phone" },
        )
        .select("id")
        .single();

      if (customerError) {
        console.error(
          "[WEBHOOK] Customer upsert failed:",
          JSON.stringify(customerError),
        );
        return res.status(500).json({ error: "Customer upsert failed" });
      }

      // Resolve the delivery address into the address book. Supports both a
      // previously saved address (addressId from the web checkout / bot saved
      // address) and a brand-new one (address + location). The resolved row
      // becomes the customer's default address for future orders.
      const deliveryAddress = await resolveDeliveryAddress(
        customer.id,
        details,
      );

      // Insert subscription
      const { data: subscription, error: insertError } = await supabase
        .from("meal_plan_subscriptions")
        .insert({
          customer_id: customer.id,
          meal_plan_id: planId,
          phone,
          address_id: deliveryAddress?.id ?? null,
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
        if (insertError.code === "23505") {
          // Race: a concurrent delivery of the same webhook inserted first.
          console.log(
            "[WEBHOOK] Unique violation on subscription insert (duplicate webhook) for payment:",
            razorpayPaymentId,
          );
          return res.status(200).json({
            status: "duplicate",
          });
        }
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

      // Check for pre-existing kitchen closed days within the subscription's range
      const { data: closedDays } = await supabase
        .from("kitchen_closed_days")
        .select("date, reason")
        .gte("date", start_date)
        .lte("date", end_date);

      if (closedDays?.length) {
        const nonSundayClosed = closedDays.filter((cd) => {
          const day = new Date(cd.date + "T00:00:00Z").getUTCDay();
          return day !== 0;
        });

        if (nonSundayClosed.length) {
          let newEnd = end_date;
          for (const cd of nonSundayClosed) {
            newEnd = addDeliveryDays(newEnd, 1);
          }

          const { error: updateError } = await supabase
            .from("meal_plan_subscriptions")
            .update({ end_date: newEnd })
            .eq("id", subscription.id);

          if (!updateError) {
            console.log(
              `[WEBHOOK] Extended sub ${subscription.id} end_date from ${end_date} to ${newEnd} due to ${nonSundayClosed.length} kitchen closed day(s)`,
            );

            const datesList = nonSundayClosed.map((cd) => cd.date).join(", ");
            const reasonLine = nonSundayClosed[0].reason
              ? `\nReason: _${nonSundayClosed[0].reason}_\n`
              : "\n";

            const templateParams = [
              { type: "text", text: datesList },
              {
                type: "text",
                text: reasonLine.replace(/\n/g, " ").replace(/_/g, ""),
              },
              {
                type: "text",
                text: formatDateIST(newEnd, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
              },
            ];

            await sendNotification(
              phone,
              process.env.WHATSAPP_KITCHEN_CLOSED_TEMPLATE || "kitchen_closed",
              templateParams,
              kitchenClosedDaysDuringPlan({
                datesList,
                reasonLine,
                newEndDate: formatDateIST(newEnd, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
              }),
              null,
            );
          }

          end_date = newEnd; // update for downstream code
        }
      }

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

      // Insert subscription_slots (default dishes are looked up via next_day_meals → weekly_meal_schedule)
      const slotRows = slotNames.map((slot) => ({
        subscription_id: subscription.id,
        slot,
        delivery_time: SLOT_DELIVERY_TIMES[slot],
      }));

      const { error: slotsError } = await supabase
        .from("subscription_slots")
        .insert(slotRows);

      if (slotsError) {
        console.error(
          "[WEBHOOK] Slots insert failed:",
          JSON.stringify(slotsError),
        );
      } else {
        console.log(
          "[WEBHOOK] Inserted",
          slotRows.length,
          "slots for subscription:",
          subscription.id,
        );
      }

      // ── Late-subscriber: past 7:45pm IST → create orders now ──────────────
      if (isPastIST(19, 45)) {
        const fetchSlots = await supabase
          .from("subscription_slots")
          .select("id, slot, delivery_time")
          .eq("subscription_id", subscription.id);

        const insertedSlots = fetchSlots.data ?? [];
        console.log(
          `[WEBHOOK] Late subscriber — creating ${insertedSlots.length} order(s) on the fly`,
        );

        for (const sr of insertedSlots) {
          const delDate = deliveryDateForSlot(sr.slot);
          const acceptUntil = acceptDeadline(1);

          try {
            const order = await ensureOrder(
              subscription.id,
              sr.id,
              phone,
              planId,
              delDate,
              sr.slot,
              sr.delivery_time,
              acceptUntil,
            );

            console.log(
              `[WEBHOOK] Late-subscriber order ${order.id} for ${sr.slot}`,
            );

            // Send immediate notification for breakfast
            if (sr.slot === "breakfast") {
              const daysLeft = await countRemainingDeliveryDays(
                start_date,
                end_date,
              );
              const expiryNotice = buildExpiryNotice(daysLeft, true);
              const slotLabel = SLOT_LABELS.breakfast;
              const itemLine = order.item_name
                ? `🌅 *${slotLabel}*: ${order.item_name}`
                : `🌅 *${slotLabel}*`;

              await supabase
                .from("orders")
                .update({ notified_at: new Date().toISOString() })
                .eq("id", order.id);

              await sendButtons(
                phone,
                lateSubscriberBreakfast({
                  delDate,
                  itemLine,
                  timeStr: sr.delivery_time?.slice(0, 5) || "",
                  acceptUntilTime: formatTimeIST(acceptUntil),
                  expiryNotice,
                }),
                [
                  { id: `CONFIRM_${order.id}`, title: "✅ Confirm" },
                  { id: `CHANGE_${order.id}`, title: "🔄 Change" },
                  { id: `SKIP_${order.id}`, title: "⏭️ Skip" },
                ],
              );

              console.log(
                `[WEBHOOK] Notified late subscriber ${phone} for breakfast`,
              );
            }
          } catch (err) {
            console.error(
              `[WEBHOOK] Failed to create late-subscriber order for ${sr.slot}:`,
              err.message,
            );
          }
        }
      }

      // Clear session
      await clearSession(rawPhone);

      // Notify customer on WhatsApp
      const fmt = (s) => formatDateIST(s);
      const todayIST = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const startLabel =
        start_date === todayIST ? "today" : `from ${fmt(start_date)}`;
      const body = paymentConfirmed({
        planTitle,
        dayLabel,
        mealLabel,
        amount,
        startLabel,
      });
      const templateParams = [
        { type: "text", text: planTitle },
        { type: "text", text: dayLabel },
        { type: "text", text: mealLabel },
        { type: "text", text: `₹${amount}` },
        { type: "text", text: startLabel },
      ];
      await sendNotification(
        phone,
        process.env.WHATSAPP_PAYMENT_CONFIRMED_TEMPLATE || "payment_confirmed",
        templateParams,
        body,
        null,
      );

      // Create magic login token for auto-login on payment-success page
      const referenceId = payload?.payment_link?.entity?.reference_id;
      if (referenceId) {
        const magicToken = await createMagicToken(phone, referenceId);
        console.log(
          `[WEBHOOK] Created magic token for ${phone}: ${magicToken}`,
        );
      }
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
