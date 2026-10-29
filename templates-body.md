# WhatsApp Template Body Text (Copy-Paste Ready for Meta Business Manager)

---

## 1. Breakfast Notification (`breakfast_notification`)

**Category:** UTILITY | **Language:** en | **Buttons:** Quick Reply (3)  
**Sent:** 8:00 PM IST (for **tomorrow's** breakfast)  
**Cron:** `30 14 * * *` (14:30 UTC = 20:00 IST)

### Body Text (copy exactly):

```
🌅 Good evening! Your breakfast for tomorrow ({{1}}) is scheduled.

🍽️ Meal: {{2}} at {{3}}

{{4}} {{5}}

Tap a button below to confirm, change, or skip this meal.
```

### Variables (in order):

| {{1}}         | {{2}}     | {{3}}    | {{4}}        | {{5}}         |
| ------------- | --------- | -------- | ------------ | ------------- |
| delivery_date | item_name | time_str | deadline_msg | expiry_notice |

### Sample Values:

| {{1}}           | {{2}}       | {{3}} | {{4}}                                                | {{5}}                                 |
| --------------- | ----------- | ----- | ---------------------------------------------------- | ------------------------------------- |
| 16 January 2025 | Idli Sambar | 08:00 | You can confirm, skip, or change until 10pm tonight. | Your plan expires in 2 delivery days. |

### Rendered Sample:

```
🌅 Good evening! Your breakfast for tomorrow (16 January 2025) is scheduled.

🍽️ Meal: Idli Sambar at 08:00

You can confirm, skip, or change until 10pm tonight. Your plan expires in 2 delivery days.

Tap a button below to confirm, change, or skip this meal.
```

### Buttons (Quick Reply):

1. ✅ Confirm
2. 🔄 Change
3. ⏭️ Skip

---

## 2. Lunch Notification (`lunch_notification`)

**Category:** UTILITY | **Language:** en | **Buttons:** Quick Reply (3)  
**Sent:** 8:30 AM IST (for **today's** lunch)  
**Cron:** `0 3 * * *` (03:00 UTC = 08:30 IST)

### Body Text:

```
☀️ Good morning! Your lunch for today ({{1}}) is scheduled.

🍽️ Meal: {{2}} at {{3}}

{{4}} {{5}}

Please use the buttons below to manage your order.
```

### Variables:

| {{1}}         | {{2}}     | {{3}}    | {{4}}        | {{5}}         |
| ------------- | --------- | -------- | ------------ | ------------- |
| delivery_date | item_name | time_str | deadline_msg | expiry_notice |

### Sample Values:

| {{1}}           | {{2}}           | {{3}} | {{4}}                                                | {{5}}                                 |
| --------------- | --------------- | ----- | ---------------------------------------------------- | ------------------------------------- |
| 15 January 2025 | Chicken Biryani | 12:30 | Please respond by 9:30am — changes close after that. | Your plan expires in 2 delivery days. |

### Rendered Sample:

```
☀️ Good morning! Your lunch for today (15 January 2025) is scheduled.

🍽️ Meal: Chicken Biryani at 12:30

Please respond by 9:30am — changes close after that. Your plan expires in 2 delivery days.

Please use the buttons below to manage your order.
```

### Buttons (Quick Reply):

1. ✅ Confirm
2. 🔄 Change
3. ⏭️ Skip

---

## 3. Dinner Notification (`dinner_notification`)

**Category:** UTILITY | **Language:** en | **Buttons:** Quick Reply (3)  
**Sent:** 4:00 PM IST (for **today's** dinner)  
**Cron:** `30 10 * * *` (10:30 UTC = 16:00 IST)

### Body Text:

```
🌙 Good afternoon! Your dinner for today ({{1}}) is scheduled.

🍽️ Meal: {{2}} at {{3}}

{{4}} {{5}}

Use the buttons below to confirm, change, or skip.
```

### Variables:

| {{1}}         | {{2}}     | {{3}}    | {{4}}        | {{5}}         |
| ------------- | --------- | -------- | ------------ | ------------- |
| delivery_date | item_name | time_str | deadline_msg | expiry_notice |

### Sample Values:

| {{1}}           | {{2}}                 | {{3}} | {{4}}                                             | {{5}}                                 |
| --------------- | --------------------- | ----- | ------------------------------------------------- | ------------------------------------- |
| 15 January 2025 | Dal Makhani with Roti | 19:30 | Please respond by 5pm — changes close after that. | Your plan expires in 2 delivery days. |

### Rendered Sample:

```
🌙 Good afternoon! Your dinner for today (15 January 2025) is scheduled.

🍽️ Meal: Dal Makhani with Roti at 19:30

Please respond by 5pm — changes close after that. Your plan expires in 2 delivery days.

Use the buttons below to confirm, change, or skip.
```

### Buttons (Quick Reply):

1. ✅ Confirm
2. 🔄 Change
3. ⏭️ Skip

---

## 4. Rescheduled Meal (`rescheduled_meal`)

**Category:** UTILITY | **Language:** en | **Buttons:** Quick Reply (3)  
**Sent:** Same time as the meal's regular notification (when a skipped meal is re-delivered)

### Body Text:

```
⏭️ Hi there! The {{1}} you skipped earlier is now being delivered today ({{4}}).

🍽️ {{2}} {{1}}: {{3}}

Please let us know if you'd like to confirm, change, or skip this meal.
```

### Variables:

| {{1}}      | {{2}}      | {{3}}     | {{4}}         |
| ---------- | ---------- | --------- | ------------- |
| slot_label | slot_emoji | item_name | delivery_date |

### Sample Values:

| {{1}} | {{2}} | {{3}}           | {{4}}           |
| ----- | ----- | --------------- | --------------- |
| Lunch | ☀️    | Chicken Biryani | 15 January 2025 |

### Rendered Sample:

```
⏭️ Hi there! The Lunch you skipped earlier is now being delivered today (15 January 2025).

🍽️ ☀️ Lunch: Chicken Biryani

Please let us know if you'd like to confirm, change, or skip this meal.
```

### Buttons (Quick Reply):

1. ✅ Confirm
2. 🔄 Change
3. ⏭️ Skip

---

## 5. Expiry Reminder (`expiry_reminder`)

**Category:** MARKETING | **Language:** en | **Buttons:** Quick Reply (2)  
**Sent:** 1:30 PM IST (for plans with exactly 2 delivery days remaining)  
**Cron:** `0 8 * * *` (08:00 UTC = 13:30 IST)

### Body Text:

```
⏳ Hi! Your FitFuel {{1}} plan is ending soon.

You have only {{2}} delivery day(s) remaining. Don't let your healthy streak end — renew today to keep your meals coming! 🥗
```

### Variables:

| {{1}}      | {{2}}     |
| ---------- | --------- |
| plan_label | threshold |

### Sample Values:

| {{1}}                | {{2}} |
| -------------------- | ----- |
| Healthy Diet Non-Veg | 2     |

### Rendered Sample:

```
⏳ Hi! Your FitFuel Healthy Diet Non-Veg plan is ending soon.

You have only 2 delivery day(s) remaining. Don't let your healthy streak end — renew today to keep your meals coming! 🥗
```

### Buttons (Quick Reply):

1. 🔄 Renew Plan
2. 📞 Contact Us

---

## 6. Session Expired (`session_expired`)

**Category:** UTILITY | **Language:** en | **Buttons:** None  
**Sent:** Every 5 minutes via cron (when user's session expires after 5 min idle)

### Body Text:

```
⏰ Your session has expired due to inactivity.

Please type "hi" to start a new conversation with FitFuel Nutrition.
```

### Variables: None

### Rendered Sample:

```
⏰ Your session has expired due to inactivity.

Please type "hi" to start a new conversation with FitFuel Nutrition.
```

---

## 7. OTP Code (`otp_code`)

**Category:** AUTHENTICATION | **Language:** en | **Buttons:** OTP (special)  
**Sent:** On-demand when user requests login on web dashboard

### Body Text:

```
Your FitFuel verification code is {{1}}. This code is valid for {{2}}.
```

### Variables:

| {{1}}    | {{2}}    |
| -------- | -------- |
| otp_code | validity |

### Sample Values:

| {{1}}  | {{2}}     |
| ------ | --------- |
| 482917 | 5 minutes |

### Rendered Sample:

```
Your FitFuel verification code is 482917. This code is valid for 5 minutes.
```

### Special Settings:

- **Button Type:** OTP (not Quick Reply)
- **OTP Length:** 6
- **Package Name:** `com.fitfuel.nutrition` (for Android auto-fill)

---

## 8. Payment Failed (`payment_failed`)

**Category:** UTILITY | **Language:** en | **Buttons:** None  
**Sent:** On Razorpay webhook when payment_link.cancelled / payment_link.expired / payment.failed

### Body Text:

```
❌ We're sorry — your payment was {{1}}.

Unfortunately your FitFuel order could not be completed. Type "hi" to start a new order. If money left your account, email support@fitfuelnutrition.in with the payment reference and we'll sort it out. 🙏
```

### Variables:

| {{1}}  |
| ------ |
| reason |

### Sample Values:

| {{1}}     |
| --------- |
| cancelled |

### Rendered Sample:

```
❌ We're sorry — your payment was cancelled.

Unfortunately your FitFuel order could not be completed. Type "hi" to start a new order. If money left your account, email support@fitfuelnutrition.in with the payment reference and we'll sort it out. 🙏
```

---

## 9. Payment Confirmed (`payment_confirmed`)

**Category:** UTILITY | **Language:** en | **Buttons:** None  
**Sent:** On Razorpay webhook when payment_link.paid (immediately after payment)

### Body Text:

```
🎉 Great news! Your payment is confirmed.

Your FitFuel {{1}} plan is now active for {{2}} with {{3}}.

Amount paid: {{4}}
Deliveries begin: {{5}}

You'll receive daily notifications before each meal to confirm, skip, or change it.

Thank you for choosing FitFuel! 💪
```

### Variables:

| {{1}}      | {{2}}     | {{3}}      | {{4}}  | {{5}}       |
| ---------- | --------- | ---------- | ------ | ----------- |
| plan_title | day_label | meal_label | amount | start_label |

### Sample Values:

| {{1}}                | {{2}}  | {{3}}          | {{4}}  | {{5}}           |
| -------------------- | ------ | -------------- | ------ | --------------- |
| Healthy Diet Non-Veg | 7 Days | Lunch + Dinner | ₹1,540 | 16 January 2025 |

### Rendered Sample:

```
🎉 Great news! Your payment is confirmed.

Your FitFuel Healthy Diet Non-Veg plan is now active for 7 Days with Lunch + Dinner.

Amount paid: ₹1,540
Deliveries begin: 16 January 2025

You'll receive daily notifications before each meal to confirm, skip, or change it.

Thank you for choosing FitFuel! 💪
```

---

## 10. Kitchen Closed (`kitchen_closed`)

**Category:** UTILITY | **Language:** en | **Buttons:** None  
**Sent:** When admin marks kitchen closed (holiday) via admin panel

### Body Text:

```
🔒 Kitchen Closed Notice — {{1}}

{{2}}

Our kitchen will be closed on {{1}}, so no meals will be delivered that day.

Good news: your plan has been extended by 1 day. You now have {{3}} delivery day(s) remaining.

We'll be back the next working day! 🙏
```

### Variables:

| {{1}} | {{2}}       | {{3}}          |
| ----- | ----------- | -------------- |
| date  | reason_line | remaining_days |

### Sample Values:

| {{1}}           | {{2}}                | {{3}} |
| --------------- | -------------------- | ----- |
| 26 January 2025 | Republic Day holiday | 5     |

### Rendered Sample:

```
🔒 Kitchen Closed Notice — 26 January 2025

Republic Day holiday

Our kitchen will be closed on 26 January 2025, so no meals will be delivered that day.

Good news: your plan has been extended by 1 day. You now have 5 delivery day(s) remaining.

We'll be back the next working day! 🙏
```

---

## 11. Subscription Cancelled (`subscription_cancelled`)

**Category:** UTILITY | **Language:** en | **Buttons:** None
**Sent:** When an admin cancels a subscription from the admin panel

### Body Text:

```
❌ Your FitFuel plan has been cancelled.

📦 Plan: {{1}}
📅 No meals will be delivered from {{2}}.

If this was a mistake, or you'd like to discuss a refund, email support@fitfuelnutrition.in and our team will help.

Thank you for choosing FitFuel. 🙏
```

### Variables:

| {{1}}      | {{2}}          |
| ---------- | -------------- |
| plan_label | effective_date |

### Sample Values:

| {{1}}                            | {{2}}       |
| -------------------------------- | ----------- |
| 🥗 Healthy Diet Non-Veg (7 Days) | 28 Oct 2026 |

### Rendered Sample:

```
❌ Your FitFuel plan has been cancelled.

📦 Plan: 🥗 Healthy Diet Non-Veg (7 Days)
📅 No meals will be delivered from 28 Oct 2026.

If this was a mistake, or you'd like to discuss a refund, email support@fitfuelnutrition.in and our team will help.

Thank you for choosing FitFuel. 🙏
```

---

## 12. GST Invoice (`invoice_ready`)

**Category:** UTILITY | **Language:** en | **Buttons:** None | **Header:** Document
**Sent:** Payment webhook when the customer's 24-hour service window is closed

### Body Text:

```
Your FitFuel GST invoice is attached.

{{1}}

Thank you for choosing FitFuel.
```

### Variables:

| {{1}}   | Example                                                       |
| ------- | ------------------------------------------------------------- |
| caption | FitFuel tax invoice FF/2026-27/0001 — Amount paid: ₹17,220.00 |

### Sample Values:

| {{1}}                                                         |
| ------------------------------------------------------------- |
| FitFuel tax invoice FF/2026-27/0001 — Amount paid: ₹17,220.00 |

### Rendered Sample:

```
Your FitFuel GST invoice is attached.

FitFuel tax invoice FF/2026-27/0001 — Amount paid: ₹17,220.00

Thank you for choosing FitFuel.
```

---

## Quick Reference Table

| Template               | Variables | Buttons       | Category       | Sent At                 |
| ---------------------- | --------- | ------------- | -------------- | ----------------------- |
| breakfast_notification | 5         | 3 Quick Reply | UTILITY        | 8 PM (for tomorrow)     |
| lunch_notification     | 5         | 3 Quick Reply | UTILITY        | 8:30 AM (for today)     |
| dinner_notification    | 5         | 3 Quick Reply | UTILITY        | 4 PM (for today)        |
| rescheduled_meal       | 4         | 3 Quick Reply | UTILITY        | Same as meal slot       |
| expiry_reminder        | 2         | 2 Quick Reply | MARKETING      | 1:30 PM                 |
| session_expired        | 0         | None          | UTILITY        | Every minute (VPS cron) |
| otp_code               | 2         | OTP (special) | AUTHENTICATION | On-demand               |
| payment_failed         | 1         | None          | UTILITY        | Webhook                 |
| payment_confirmed      | 5         | None          | UTILITY        | Webhook                 |
| invoice_ready          | 1         | None          | UTILITY        | Webhook fallback        |
| kitchen_closed         | 3         | None          | UTILITY        | Admin action            |
| subscription_cancelled | 2         | None          | UTILITY        | Admin action            |

---

## Meta Business Manager - Setup Checklist

For each template:

1. **Name:** Use exact name (e.g., `breakfast_notification`)
2. **Category:** As listed above
3. **Language:** English (en)
4. **Body:** Paste the "Body Text" section exactly
5. **Variables:** Meta auto-detects {{1}}, {{2}}... verify order matches table
6. **Buttons:** Add Quick Reply buttons as listed (OTP for otp_code)
7. **Submit** for review
8. **Test** with Meta test phone numbers once approved
