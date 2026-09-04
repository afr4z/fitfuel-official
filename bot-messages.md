# FitFuel Bot Messages — Client Review

> Edit any message below, mark your changes, and send this file back.
> Text in `*asterisks*` is bold on WhatsApp. Text in `_underscores_` is italic.
> `${variable}` placeholders will be filled automatically — don't change those.

---

## 1. Welcome / Greeting

### Returning user — active plan (near expiry)

```
👋 Welcome back to FitFuel!

🟢 You have an *active ${planLabel} plan*.
⚠️ Your plan expires soon — only *${remaining}* delivery day(s) left!

How can we help you?
```

### Returning user — active plan

```
👋 Welcome back to FitFuel!

🟢 You have an *active ${planLabel} plan*.
📅 *${remaining}* delivery day(s) remaining

How can we help you?
```

### New user

```
👋 Welcome to FitFuel!

How can we help you today?
```

**Buttons shown:** 📋 My Plan · 📞 Contact Us · 🥗 View Plans · 🛒 Order Now

---

## 2. Main Menu

### View Plans

```
🥗 *Our Nutrition Plans*

[plan list with prices]

📅 *Durations:* 3, 7, 14, or 30 days
🍴 *Meals:* Breakfast only, Lunch + Dinner, or All 3

Tap below to customise your plan!
```

**Button:** 🛒 Build My Plan

### My Plan — no active subscription

```
ℹ️ You don't have an active plan right now.

Type anything to go back to the menu.
```

### My Plan — active subscription

```
📋 *Your Active Plan*

📦 Plan: *${planLabel}*
📅 Started: ${startDate}
⏳ *${remaining}* delivery day(s) remaining.
⏭️ *${skippedCount} skipped meal(s)* after your plan ends:
[skipped meal list]

You'll receive a notification before each meal to confirm, skip, or change it.

Type anything to go back to the menu.
```

**Buttons:** 🔄 Renew Plan · 📞 Contact Us

### Ready to renew

```
🔄 Ready to renew your plan?
```

### Contact Us

```
📞 *Get in Touch*

📧 Email: hello@fitfuelnutrition.com
📱 WhatsApp: This chat!
🌐 Website: www.fitfuelnutrition.com
🕐 Support hours: Mon–Sat, 9am–7pm
```

---

## 3. Subscription Onboarding

### Already has active plan

```
⚠️ *You already have an active plan!*

Your current plan has *${remaining} delivery day(s)* remaining.

You can renew once your plan has ${threshold} or fewer delivery days left.
```

### Renewal flow start

```
🔄 *Renew your plan!*

Your current plan ends shortly. Your new plan will start right after it completes.

Let's set up your new plan!
```

### Step 1 — Choose meal plan

```
🥗 *Choose your meal plan:*

Pick the plan that best matches your goal:
```

### Step 2 — Duration selected

```
✅ *${planTitle}* selected!

How many days would you like to subscribe for?

_Note: Sundays are a kitchen holiday — no deliveries on Sundays. Your plan will be extended by a day for every Sunday it falls on, so you always get the full number of delivery days you pay for._
```

### Step 2 — Re-prompt (invalid input)

```
How many days would you like? (${planTitle})

_Note: Sundays are a kitchen holiday — no deliveries on Sundays. Your plan will be extended by a day for every Sunday it falls on, so you always get the full number of delivery days you pay for._
```

### Step 3 — Meals per day

```
📅 *${dayLabel}* selected!

How many meals per day?

🌅 Breakfast only — ₹${price}
🍽️ Lunch + Dinner — ₹${price}
🌟 All 3 Meals — ₹${price}
```

### Step 4 — Location request (with button)

```
🍴 *${mealLabel}* selected!

📍 *Where should we deliver?*

Tap the button below to share your location, or just type your area / neighbourhood name.
```

### Step 4 — Location request (text fallback)

```
🍴 *${mealLabel}* selected!

📍 *Where should we deliver?*

Tap the 📎 icon → *Location* → *Send Your Current Location*,
or type your area / neighbourhood name.
```

### Step 5 — Address prompt

```
📍 *Got your location!*

🏠 Please type your *full delivery address*:
(flat/house number, street name, landmark)
```

### Step 6 — Payment link error

```
Sorry, we couldn't generate your payment link right now. Please contact support.
```

### Step 6 — Order summary with payment link

```
✅ *Order Summary*

📦 Plan: ${planTitle}
📅 Duration: ${dayLabel}
🍴 Meals: ${mealLabel}
🏠 Address: ${addressText}
💰 Total: ₹${totalPrice}

💳 *Complete your payment here:*
${paymentUrl}

_Your subscription activates once payment is confirmed!_
```

---

## 4. Order Actions (Confirm / Skip / Change)

### Errors

```
Sorry, something went wrong. Please try again.
```

```
Sorry, we couldn't find that order. Please try again.
```

### Deadline passed

```
⏰ The 9:30am deadline has passed. Changes can no longer be made for lunch.
```

```
⏰ The 5pm deadline has passed. Changes can no longer be made for dinner.
```

```
⏰ The deadline has passed. Changes can no longer be made for this meal.
```

### Already processed

```
✅ This order has already been confirmed.
```

```
⏭️ This order has already been skipped.
```

```
ℹ️ This order has already been processed.
```

### Confirm success

```
✅ *Confirmed!* Your meal is locked in.

We'll notify you once it's on the way 🚀
```

### Confirm error

```
Sorry, something went wrong confirming your order. Please try again.
```

### Skip — meal pushed to end of plan

```
⏭️ *Skipped!* This meal has been moved to *${dateStr}* (added to the end of your plan).
```

### Skip — no remaining subscription

```
⏭️ *Skipped!* No delivery for this slot today.

See you next time 👋
```

### Skip error

```
Sorry, something went wrong skipping your order. Please try again.
```

### Change — menu unavailable

```
😔 Sorry, we're having trouble loading today's menu. Please try again later or contact support.
```

### Change — pick new meal

```
🔄 *Change your meal*

Pick from today's available options:
```

### Unrecognised action

```
Sorry, I didn't understand that. Please use the buttons.
```

### Change — order already processed

```
ℹ️ This order has already been processed and can't be changed.
```

### Change — meal updated

```
✅ *Meal updated!*

Your new meal: *${itemName}*

We'll have it ready for your slot 🍽️
```

### Change error

```
Sorry, something went wrong updating your meal. Please try again.
```

---

## 5. Meal Notifications (Daily)

### Breakfast notification header

```
🌅 *Tomorrow's Breakfast (${deliveryDate})*
```

### Lunch / Dinner notification header

```
🍽️ *Today's ${slotLabel} (${deliveryDate})*
```

### Meal item line

```
🌅 *Breakfast*: ${itemName}
```

### Deadline reminders

```
You can confirm, skip, or change until *10pm tonight*.
```

```
⏰ Respond by *9:30am* — changes close after that.
```

```
⏰ Respond by *5pm* — changes close after that.
```

### Rescheduled meal notification

```
⏭️ *Rescheduled ${slotLabel}*

You skipped this meal earlier — it's being delivered today.

🍽️ *${slotLabel}*: ${itemName}
```

**Buttons on all meal notifications:** ✅ Confirm · 🔄 Change · ⏭️ Skip

---

## 6. Payment

### Payment failed / cancelled / expired

```
❌ *Payment ${reason}*

Unfortunately your FitFuel order could not be completed.

Please send us a message to start a new order whenever you're ready. We're here to help! 🙏
```

### Payment confirmed

```
🎉 *Payment Confirmed!*

Your FitFuel *${planTitle}* plan is now *active*!

📅 Duration: ${dayLabel}
🍴 Meals: ${mealLabel}
💰 Amount paid: ₹${amount}

📦 Deliveries start ${startLabel}.
You'll get a daily notification before each meal to confirm, skip, or change it.

Thank you for choosing FitFuel! 💪
```

### Kitchen closed days during plan

```
🔒 *Kitchen Closed Days during your plan*

Our kitchen will be closed on: *${datesList}*.
Reason: _${reason}_
No meals will be delivered on those days.

✅ Your plan has been extended to *${newEndDate}* to make up for it.

We'll be back the next working day! 🙏
```

---

## 7. Expiry Reminder

```
⏳ *Your FitFuel plan is almost over!*

Your *${planLabel} plan* has only *${threshold} delivery day(s)* remaining.

Don't miss your healthy streak — renew now to keep your meals coming! 🥗
```

**Buttons:** 🔄 Renew Plan · 📞 Contact Us

---

## 8. Plan Expiry Notices

### Last delivery day

```
🚨 *This is your last delivery day!* Press the *Renew Plan* button on the menu to continue.
```

### Near expiry

```
⚠️ Your plan expires in *${daysLeft}* delivery day(s)! Press the *Renew Plan* button on the menu to continue.
```

### Sunday / holiday disclaimer

```
_Note: Sundays are a kitchen holiday — no deliveries on Sundays. Your plan will be extended by a day for every Sunday it falls on, so you always get the full number of delivery days you pay for._
```

---

## 9. Kitchen Closed (Admin)

```
🔒 *Kitchen Closed — ${date}*
${reasonLine}
We're sorry, our kitchen won't be operating on ${date}. No meals will be delivered that day.

✅ Your plan has been extended by 1 day to make up for it.
📅 You now have *${remaining} delivery day(s)* remaining.

We'll be back the next working day! 🙏
```

---

## 10. Session & Button Expiry

### Session expired

```
⏰ *Your session expired due to inactivity.*

Type *hi* to start again!
```

### Button expired

```
⏰ That button has expired — it's from an older message.

Type *hi* to start fresh!
```

### Payment pending

```
⏳ *Payment Pending*

Please complete your payment using the link we sent you.

Type *back*, *menu*, or *home* to cancel and start over.
```

---

## 11. Navigation

```
↩️ Going back…
```

### Back to location (with button)

```
📍 *Where should we deliver?*

Tap the button below to share your location, or type your area / neighbourhood name.
```

### Back to location (text fallback)

```
📍 *Where should we deliver?*

Type your area / neighbourhood name.
```

---

## 12. Menu Unavailable

```
Sorry, the menu is unavailable right now. Please try again later.
```

---

## How to edit

1. Make your changes directly in this document
2. Mark changed lines with `<!-- CHANGED -->` so we can spot them quickly
3. Send this file back

**Example:**
```
<!-- CHANGED --> Hello! Welcome to FitFuel! 🎉
```
