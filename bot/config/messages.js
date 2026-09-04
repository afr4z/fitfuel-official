/**
 * Central message store for the FitFuel WhatsApp bot.
 *
 * Every user-facing string lives here so messages can be edited in one place.
 * Static messages are exported as constants; dynamic messages are functions
 * that accept a single object of template variables.
 */

// ─── Greeting ────────────────────────────────────────────────────────────────

export function greetingReturning({ planLabel, remaining, nearExpiry }) {
  const expiryLine = nearExpiry
    ? `\n⚠️ Your plan expires soon — only *${remaining}* delivery day(s) left!`
    : `\n📅 *${remaining}* delivery day(s) remaining`;
  return (
    `👋 Welcome back to FitFuel Nutrition!\n\n` +
    `🟢 You have an *active ${planLabel} plan*.${expiryLine}` +
    `\n\nHow can we help you?`
  );
}

export const GREETING_NEW =
  `👋 Welcome to FitFuel Nutrition!\n\nHow can we help you today?`;

// ─── Main Menu ───────────────────────────────────────────────────────────────

export function viewPlans({ planLines }) {
  return (
    `🥗 *Our Nutrition Plans*\n\n${planLines}\n\n` +
    `📅 *Durations:* 3, 7, 14, or 30 days\n` +
    `🍴 *Meals:* Breakfast only, Lunch + Dinner, or All 3\n\n` +
    `Tap below to customise your plan!`
  );
}

export const MY_PLAN_NO_ACTIVE =
  `ℹ️ You don't have an active plan right now.\n\nType anything to go back to the menu.`;

export function myPlanActive({ planLabel, startDate, expiryLine, pushedLines }) {
  return (
    `📋 *Your Active Plan*\n\n` +
    `📦 Plan: *${planLabel}*\n` +
    `📅 Started: ${startDate}\n` +
    `${expiryLine}${pushedLines}\n\n` +
    `You'll receive a notification before each meal to confirm, skip, or change it.\n\n` +
    `Type anything to go back to the menu.`
  );
}

export const MY_PLAN_RENEW_PROMPT =
  `🔄 Ready to renew your plan?`;

export const CONTACT_US =
  `📞 *Get in Touch*\n\n` +
  `📧 Email: hello@fitfuelnutrition.com\n` +
  `📱 WhatsApp: This chat!\n` +
  `🌐 Website: www.fitfuelnutrition.com\n` +
  `🕐 Support hours: Mon–Sat, 9am–7pm`;

// ─── Subscription Onboarding ─────────────────────────────────────────────────

export function alreadyActivePlan({ remaining, threshold }) {
  return (
    `⚠️ *You already have an active plan!*\n\n` +
    `Your current plan has *${remaining} delivery day(s)* remaining.\n\n` +
    `You can renew once your plan has ${threshold} or fewer delivery days left.`
  );
}

export const RENEW_PLAN_START =
  `🔄 *Renew your plan!*\n\n` +
  `Your current plan ends shortly. Your new plan will start right after it completes.\n\n` +
  `Let's set up your new plan!`;

export const CHOOSE_MEAL_PLAN =
  `🥗 *Choose your meal plan:*\n\nPick the plan that best matches your goal:`;

export function planSelected({ planTitle, sundayNote }) {
  return (
    `✅ *${planTitle}* selected!\n\nHow many days would you like to subscribe for?\n\n` +
    sundayNote
  );
}

export function durationReprompt({ planLine, sundayNote }) {
  return `How many days would you like?${planLine}\n\n` + sundayNote;
}

export function mealsPerDay({ dayLabel, priceLines }) {
  return `📅 *${dayLabel}* selected!\n\nHow many meals per day?\n\n${priceLines}`.trim();
}

export function locationPrompt({ mealLabel }) {
  return (
    `🍴 *${mealLabel}* selected!\n\n` +
    `📍 *Where should we deliver?*\n\n` +
    `Tap the button below to share your location, or just type your area / neighbourhood name.`
  );
}

export function locationPromptFallback({ mealLabel }) {
  return (
    `🍴 *${mealLabel}* selected!\n\n` +
    `📍 *Where should we deliver?*\n\n` +
    `Tap the 📎 icon → *Location* → *Send Your Current Location*,\n` +
    `or type your area / neighbourhood name.`
  );
}

export const ADDRESS_PROMPT =
  `📍 *Got your location!*\n\n` +
  `🏠 Please type your *full delivery address*:\n` +
  `(flat/house number, street name, landmark)`;

export const PAYMENT_LINK_ERROR =
  `Sorry, we couldn't generate your payment link right now. Please contact support.`;

export function orderSummary({ planTitle, dayLabel, mealLabel, addressText, totalPrice, paymentUrl }) {
  return (
    `✅ *Order Summary*\n\n` +
    `📦 Plan: ${planTitle}\n` +
    `📅 Duration: ${dayLabel}\n` +
    `🍴 Meals: ${mealLabel}\n` +
    `🏠 Address: ${addressText}\n` +
    `💰 Total: ₹${totalPrice}\n\n` +
    `💳 *Complete your payment here:*\n${paymentUrl}\n\n` +
    `_Your subscription activates once payment is confirmed!_`
  );
}

// ─── Order Actions ───────────────────────────────────────────────────────────

export const ERROR_GENERIC =
  `Sorry, something went wrong. Please try again.`;

export const ERROR_ORDER_NOT_FOUND =
  `Sorry, we couldn't find that order. Please try again.`;

export const DEADLINE_LUNCH =
  `⏰ The 9:30am deadline has passed. Changes can no longer be made for lunch.`;

export const DEADLINE_DINNER =
  `⏰ The 5pm deadline has passed. Changes can no longer be made for dinner.`;

export const DEADLINE_GENERIC =
  `⏰ The deadline has passed. Changes can no longer be made for this meal.`;

export const ALREADY_CONFIRMED =
  `✅ This order has already been confirmed.`;

export const ALREADY_SKIPPED =
  `⏭️ This order has already been skipped.`;

export const ALREADY_PROCESSED =
  `ℹ️ This order has already been processed.`;

export const CONFIRM_ERROR =
  `Sorry, something went wrong confirming your order. Please try again.`;

export const CONFIRM_SUCCESS =
  `✅ *Confirmed!* Your meal is locked in.\n\nWe'll notify you once it's on the way 🚀`;

export const SKIP_ERROR =
  `Sorry, something went wrong skipping your order. Please try again.`;

export function skipPushed({ dateStr }) {
  return `⏭️ *Skipped!* This meal has been moved to *${dateStr}* (added to the end of your plan).`;
}

export const SKIP_NO_PUSH =
  `⏭️ *Skipped!* No delivery for this slot today.\n\nSee you next time 👋`;

export const MENU_LOAD_ERROR =
  `😔 Sorry, we're having trouble loading today's menu. Please try again later or contact support.`;

export const CHANGE_MEAL_LIST =
  `🔄 *Change your meal*\n\nPick from today's available options:`;

export const UNRECOGNISED_ACTION =
  `Sorry, I didn't understand that. Please use the buttons.`;

export const ALREADY_PROCESSED_CANNOT_CHANGE =
  `ℹ️ This order has already been processed and can't be changed.`;

export const MEAL_UPDATE_ERROR =
  `Sorry, something went wrong updating your meal. Please try again.`;

export function mealUpdated({ itemName }) {
  return (
    `✅ *Meal updated!*\n\nYour new meal: *${itemName}*\n\nWe'll have it ready for your slot 🍽️`
  );
}

// ─── Meal Notifications ──────────────────────────────────────────────────────

export function breakfastHeader({ deliveryDate }) {
  return `🌅 *Tomorrow's Breakfast (${deliveryDate})*\n\n`;
}

export function slotHeader({ slotLabel, deliveryDate }) {
  return `🍽️ *Today's ${slotLabel} (${deliveryDate})*\n\n`;
}

export function slotItemLine({ emoji, slotLabel, itemName }) {
  return itemName
    ? `${emoji} *${slotLabel}*: ${itemName}`
    : `${emoji} *${slotLabel}*`;
}

export const DEADLINE_BREAKFAST =
  `You can confirm, skip, or change until *10pm tonight*.`;

export const DEADLINE_LUNCH_NOTIFICATION =
  `⏰ Respond by *9:30am* — changes close after that.`;

export const DEADLINE_DINNER_NOTIFICATION =
  `⏰ Respond by *5pm* — changes close after that.`;

export function rescheduledMeal({ slotLabel, slotEmoji, itemName }) {
  return (
    `⏭️ *Rescheduled ${slotLabel}*\n\n` +
    `You skipped this meal earlier — it's being delivered today.\n\n` +
    `${slotEmoji} *${slotLabel}*: ${itemName || "Your meal"}`
  );
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export function paymentFailed({ reason }) {
  return (
    `❌ *Payment ${reason}*\n\n` +
    `Unfortunately your FitFuel order could not be completed.\n\n` +
    `Please send us a message to start a new order whenever you're ready. We're here to help! 🙏`
  );
}

export function kitchenClosedDaysDuringPlan({ datesList, reasonLine, newEndDate }) {
  return (
    `🔒 *Kitchen Closed Days during your plan*\n\n` +
    `Our kitchen will be closed on: *${datesList}*.${reasonLine}` +
    `No meals will be delivered on those days.\n\n` +
    `✅ Your plan has been extended to *${newEndDate}* to make up for it.\n\n` +
    `We'll be back the next working day! 🙏`
  );
}

export function lateSubscriberBreakfast({ delDate, itemLine, timeStr, acceptUntilTime, expiryNotice }) {
  return (
    `🌅 *Tomorrow's Breakfast (${delDate})*\n\n` +
    `${itemLine} (${timeStr})\n\n` +
    `You can confirm, skip, or change until *${acceptUntilTime}*.${expiryNotice}`
  );
}

export function paymentConfirmed({ planTitle, dayLabel, mealLabel, amount, startLabel }) {
  return (
    `🎉 *Payment Confirmed!*\n\n` +
    `Your FitFuel *${planTitle}* plan is now *active*!\n\n` +
    `📅 Duration: ${dayLabel}\n` +
    `🍴 Meals: ${mealLabel}\n` +
    `💰 Amount paid: ₹${amount}\n\n` +
    `📦 Deliveries start ${startLabel}.\n` +
    `You'll get a daily notification before each meal to confirm, skip, or change it.\n\n` +
    `Thank you for choosing FitFuel! 💪`
  );
}

// ─── Session & Button Expiry ─────────────────────────────────────────────────

export const SESSION_EXPIRED =
  `⏰ *Your session expired due to inactivity.*\n\nType *hi* to start again!`;

export const BUTTON_EXPIRED =
  `⏰ That button has expired — it's from an older message.\n\nType *hi* to start fresh!`;

export const PAYMENT_PENDING =
  `⏳ *Payment Pending*\n\nPlease complete your payment using the link we sent you.\n\nType *back*, *menu*, or *home* to cancel and start over.`;

// ─── Navigation ──────────────────────────────────────────────────────────────

export const GOING_BACK =
  `↩️ Going back…`;

export const LOCATION_BACK =
  `📍 *Where should we deliver?*\n\nTap the button below to share your location, or type your area / neighbourhood name.`;

export const LOCATION_BACK_FALLBACK =
  `📍 *Where should we deliver?*\n\nType your area / neighbourhood name.`;

// ─── Plan Expiry Notices ─────────────────────────────────────────────────────

/**
 * Returns an expiry-warning string when the plan is ending soon, or "" otherwise.
 * Used in meal-slot cron notifications, greeting, and plan-detail messages.
 *
 * @param {number} daysLeft  Remaining delivery days (from countRemainingDeliveryDays).
 * @param {boolean} [inline] When true, prefixes a newline for inline use in longer strings.
 */
export function buildExpiryNotice(daysLeft, inline = false) {
  const prefix = inline ? "\n\n" : "";
  const threshold = parseInt(process.env.RENEWAL_THRESHOLD_DAYS, 10) || 2;
  if (daysLeft === 1) {
    return `${prefix}🚨 *This is your last delivery day!* Press the *Renew Plan* button on the menu to continue.`;
  }
  if (daysLeft <= threshold) {
    return `${prefix}⚠️ Your plan expires in *${daysLeft}* delivery day(s)! Press the *Renew Plan* button on the menu to continue.`;
  }
  return "";
}

/** Disclaimer appended to the duration-selection message. */
export const SUNDAY_HOLIDAY_NOTE =
  `_Note: Sundays are a kitchen holiday — no deliveries on Sundays. ` +
  `Your plan will be extended by a day for every Sunday it falls on, ` +
  `so you always get the full number of delivery days you pay for._`;

// ─── Expiry Reminder ─────────────────────────────────────────────────────────

export function expiryReminder({ planLabel, threshold }) {
  return (
    `⏳ *Your FitFuel plan is almost over!*\n\n` +
    `Your *${planLabel} plan* has only *${threshold} delivery day(s)* remaining.\n\n` +
    `Don't miss your healthy streak — renew now to keep your meals coming! 🥗`
  );
}

// ─── Kitchen Closed ──────────────────────────────────────────────────────────

export function kitchenClosed({ date, reasonLine, remaining }) {
  return (
    `🔒 *Kitchen Closed — ${date}*\n` +
    reasonLine +
    `\nWe're sorry, our kitchen won't be operating on ${date}. No meals will be delivered that day.\n\n` +
    `✅ Your plan has been extended by 1 day to make up for it.\n` +
    `📅 You now have *${remaining} delivery day(s)* remaining.\n\n` +
    `We'll be back the next working day! 🙏`
  );
}

// ─── Menu Unavailable ────────────────────────────────────────────────────────

export const MENU_UNAVAILABLE =
  `Sorry, the menu is unavailable right now. Please try again later.`;

export const CHANGE_MEAL_LIST_ALT =
  `🔄 *Change your meal*\n\nPick from today's options:`;
