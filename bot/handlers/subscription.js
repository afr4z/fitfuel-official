import {
  sendText,
  sendButtons,
  sendList,
  sendLocationRequest,
} from "../../lib/whatsapp.js";
import { createClient } from "@supabase/supabase-js";
import { createPaymentLink } from "../../lib/razorpay.js";
import { STATES } from "../states.js";
import { getPlanCategories, getPlanById } from "../../lib/mealPlans.js";
import { DAY_OPTIONS, MEAL_OPTIONS, SUNDAY_HOLIDAY_NOTE } from "../config/plans.js";
import { countRemainingDeliveryDays } from "../../lib/deliveryDays.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcPrice(plan, dayOption, mealOption) {
  const rate = plan.pricing?.[dayOption.days] ?? plan.basePricePerMealPerDay;
  return rate * dayOption.days * mealOption.mealsPerDay;
}

/**
 * Sends a list or button message depending on the number of options.
 * WhatsApp buttons support at most 3 items; more → use a list.
 */
async function sendOptions(
  phone,
  bodyText,
  sectionTitle,
  listButtonLabel,
  options,
) {
  if (options.length <= 3) {
    await sendButtons(
      phone,
      bodyText,
      options.map((o) => ({ id: o.id, title: o.label.substring(0, 20) })),
    );
  } else {
    await sendList(phone, bodyText, listButtonLabel, [
      {
        title: sectionTitle,
        rows: options.map((o) => ({
          id: o.id,
          title: o.label.substring(0, 24),
          description: o.description || "",
        })),
      },
    ]);
  }
}

// ─── Step 1 – Plan category ───────────────────────────────────────────────────

export async function startSubscription(phone, session, setSession) {
  // Block double-subscription: check for an existing active plan
  const today = new Date().toISOString().split("T")[0];
  const { data: activeSub } = await supabase
    .from("meal_plan_subscriptions")
    .select("id, start_date, end_date")
    .eq("phone", phone)
    .eq("status", "active")
    .gte("end_date", today)
    .limit(1)
    .maybeSingle();

  if (activeSub) {
    const remaining = countRemainingDeliveryDays(activeSub.start_date, activeSub.end_date);
    await sendText(
      phone,
      `⚠️ *You already have an active plan!*\n\n` +
        `Your current plan has *${remaining} delivery day(s)* remaining.\n\n` +
        `You can subscribe to a new plan once your current one completes.`,
    );
    return;
  }

  await setSession(phone, {
    ...session,
    state: STATES.SELECTING_PLAN_CATEGORY,
    data: {},
  });

  const plans = await getPlanCategories();

  await sendList(
    phone,
    "🥗 *Choose your meal plan:*\n\nPick the plan that best matches your goal:",
    "View Plans",
    [
      {
        title: "Available Plans",
        rows: plans.map((p) => ({
          id: "PLAN_" + p.id,
          title: p.title.substring(0, 24),
          description: p.description.substring(0, 72),
        })),
      },
    ],
  );
}

// ─── Step 2 – Duration ────────────────────────────────────────────────────────

export async function handlePlanCategory(phone, session, input, setSession) {
  const plan = await getPlanById(input.replace(/^PLAN_/, ""));

  if (!plan) {
    await startSubscription(phone, session, setSession);
    return;
  }

  await setSession(phone, {
    ...session,
    state: STATES.SELECTING_DAYS,
    data: { ...session.data, planId: plan.id, planTitle: plan.title },
  });

  await sendOptions(
    phone,
    `✅ *${plan.title}* selected!\n\nHow many days would you like to subscribe for?\n\n` +
      SUNDAY_HOLIDAY_NOTE,
    "Duration",
    "Choose Duration",
    DAY_OPTIONS,
  );
}

// ─── Step 3 – Meals per day ───────────────────────────────────────────────────

export async function handleDaySelection(phone, session, input, setSession) {
  const dayOption = DAY_OPTIONS.find((d) => d.id === input);

  const plans = await getPlanCategories();

  if (!dayOption) {
    // Resend duration selection
    const plan = plans.find((p) => p.id === session.data.planId);
    const planLine = plan ? ` (${plan.title})` : "";
    await sendOptions(
      phone,
      `How many days would you like?${planLine}\n\n` + SUNDAY_HOLIDAY_NOTE,
      "Duration",
      "Choose Duration",
      DAY_OPTIONS,
    );
    return;
  }

  const plan = plans.find((p) => p.id === session.data.planId);

  await setSession(phone, {
    ...session,
    state: STATES.SELECTING_MEALS_PER_DAY,
    data: { ...session.data, days: dayOption.days, dayLabel: dayOption.label },
  });

  // Build price preview for each meal option
  const optionsWithPrices = MEAL_OPTIONS.map((m) => {
    const price = plan ? calcPrice(plan, dayOption, m) : "—";
    return {
      ...m,
      label: m.label,
      description: price !== "—" ? `₹${price} total` : "",
    };
  });

  const priceLines = plan
    ? MEAL_OPTIONS.map(
        (m) => `${m.label} — ₹${calcPrice(plan, dayOption, m)}`,
      ).join("\n")
    : "";

  const bodyText =
    `📅 *${dayOption.label}* selected!\n\nHow many meals per day?\n\n${priceLines}`.trim();

  await sendOptions(
    phone,
    bodyText,
    "Meals per Day",
    "Choose Meals",
    optionsWithPrices,
  );
}

// ─── Step 4 – Location ────────────────────────────────────────────────────────

export async function handleMealSlotSelection(
  phone,
  session,
  input,
  setSession,
) {
  const mealOption = MEAL_OPTIONS.find((m) => m.id === input);

  if (!mealOption) {
    // Resend meal selection
    const dayOption = DAY_OPTIONS.find((d) => d.days === session.data.days);
    if (dayOption) {
      await handleDaySelection(phone, session, dayOption.id, setSession);
    }
    return;
  }

  await setSession(phone, {
    ...session,
    state: STATES.AWAITING_LOCATION,
    data: {
      ...session.data,
      mealsPerDay: mealOption.mealsPerDay,
      mealLabel: mealOption.label,
    },
  });
  try {
    await sendLocationRequest(
      phone,
      `🍴 *${mealOption.label}* selected!\n\n` +
        `📍 *Where should we deliver?*\n\n` +
        `Tap the button below to share your location, or just type your area / neighbourhood name.`,
    );
  } catch (err) {
    console.error(
      "[LOCATION_REQUEST] Failed to send location_request_message:",
      err.message,
    );
    // Fall back to plain text
    await sendText(
      phone,
      `🍴 *${mealOption.label}* selected!\n\n` +
        `📍 *Where should we deliver?*\n\n` +
        `Tap the 📎 icon → *Location* → *Send Your Current Location*,\n` +
        `or type your area / neighbourhood name.`,
    );
  }
}

// ─── Step 5 – Address ─────────────────────────────────────────────────────────

export async function handleLocation(phone, session, message, setSession) {
  let locationData = {};

  if (message.type === "location") {
    locationData = {
      latitude: message.location.latitude,
      longitude: message.location.longitude,
      locationName: message.location.name || null,
    };
  } else {
    locationData = { areaName: message.text.body };
  }

  await setSession(phone, {
    ...session,
    state: STATES.AWAITING_ADDRESS,
    data: { ...session.data, location: locationData },
  });

  await sendText(
    phone,
    `📍 *Got your location!*\n\n` +
      `🏠 Please type your *full delivery address*:\n` +
      `(flat/house number, street name, landmark)`,
  );
}

// ─── Step 6 – Payment ─────────────────────────────────────────────────────────

export async function handleAddress(phone, session, addressText, setSession) {
  const {
    planId,
    planTitle,
    dayLabel,
    days,
    mealsPerDay,
    mealLabel,
    location,
  } = session.data;

  const plans = await getPlanCategories();
  const plan = plans.find((p) => p.id === planId);
  const dayOption = DAY_OPTIONS.find((d) => d.days === days);
  const mealOption = MEAL_OPTIONS.find((m) => m.mealsPerDay === mealsPerDay);
  const totalPrice =
    plan && dayOption && mealOption
      ? calcPrice(plan, dayOption, mealOption)
      : 0;

  // Store address in session — NOT in Supabase yet
  await setSession(phone, {
    ...session,
    state: STATES.AWAITING_PAYMENT,
    data: { ...session.data, address: addressText, amount: totalPrice },
  });

  // Create Razorpay link with enough metadata to reconstruct the order on webhook
  let paymentUrl;
  try {
    const link = await createPaymentLink({
      amount: totalPrice,
      description: `FitFuel ${planTitle} – ${dayLabel}, ${mealLabel}`,
      phone,
      referenceId: `${phone}_${Date.now()}`, // unique per order; phone is the prefix before '_'
    });
    paymentUrl = link.short_url;
  } catch (e) {
    console.error("[RAZORPAY] Error:", e.message);
    await sendText(
      phone,
      `Sorry, we couldn't generate your payment link right now. Please contact support.`,
    );
    await setSession(phone, {
      ...session,
      state: STATES.GREETING,
      data: {},
    });
    return;
  }

  await sendText(
    phone,
    `✅ *Order Summary*\n\n` +
      `📦 Plan: ${planTitle}\n` +
      `📅 Duration: ${dayLabel}\n` +
      `🍴 Meals: ${mealLabel}\n` +
      `🏠 Address: ${addressText}\n` +
      `💰 Total: ₹${totalPrice}\n\n` +
      `💳 *Complete your payment here:*\n${paymentUrl}\n\n` +
      `_Your subscription activates once payment is confirmed!_`,
  );
}
