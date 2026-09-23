# WhatsApp Template Catalog

All templates must be created in **Meta Business Manager → WhatsApp Manager → Message Templates**.

## Template Naming Convention

All template names are configurable via environment variables with sensible defaults.

| Purpose                | Env Var                               | Default Name             | Category       | Language |
| ---------------------- | ------------------------------------- | ------------------------ | -------------- | -------- |
| Breakfast notification | `WHATSAPP_BREAKFAST_TEMPLATE`         | `breakfast_notification` | UTILITY        | en       |
| Lunch notification     | `WHATSAPP_LUNCH_TEMPLATE`             | `lunch_notification`     | UTILITY        | en       |
| Dinner notification    | `WHATSAPP_DINNER_TEMPLATE`            | `dinner_notification`    | UTILITY        | en       |
| Rescheduled meal       | `WHATSAPP_RESCHEDULED_TEMPLATE`       | `rescheduled_meal`       | UTILITY        | en       |
| Expiry reminder        | `WHATSAPP_EXPIRY_TEMPLATE`            | `expiry_reminder`        | MARKETING      | en       |
| Session expired        | `WHATSAPP_SESSION_EXPIRED_TEMPLATE`   | `session_expired`        | UTILITY        | en       |
| OTP code               | `WHATSAPP_OTP_TEMPLATE`               | `otp_code`               | AUTHENTICATION | en       |
| Payment failed         | `WHATSAPP_PAYMENT_FAILED_TEMPLATE`    | `payment_failed`         | UTILITY        | en       |
| Payment confirmed      | `WHATSAPP_PAYMENT_CONFIRMED_TEMPLATE` | `payment_confirmed`      | UTILITY        | en       |
| Kitchen closed         | `WHATSAPP_KITCHEN_CLOSED_TEMPLATE`    | `kitchen_closed`         | UTILITY        | en       |

---

## 1. Breakfast Notification (`breakfast_notification`)

**Category:** UTILITY  
**Use:** Daily breakfast notification sent via cron at ~2:45 PM IST (for next day breakfast)

### Variables (Body - 5 parameters)

| Index | Name            | Type   | Example                                                  | Description                        |
| ----- | --------------- | ------ | -------------------------------------------------------- | ---------------------------------- |
| {{1}} | `delivery_date` | String | "15 Jan 2025"                                            | Delivery date for breakfast        |
| {{2}} | `item_line`     | String | "🌅 _Breakfast_: Idli Sambar"                            | Meal emoji + label + item name     |
| {{3}} | `time_str`      | String | "08:00"                                                  | Delivery time (HH:MM)              |
| {{4}} | `deadline_msg`  | String | "You can confirm, skip, or change until _10pm tonight_." | Action deadline                    |
| {{5}} | `expiry_notice` | String | "⚠️ Your plan expires in _2_ delivery day(s)!"           | Plan expiry warning (can be empty) |

### Buttons (Quick Reply - 3 buttons)

| Button Text | Payload (returned in webhook) |
| ----------- | ----------------------------- |
| ✅ Confirm  | `CONFIRM_<order_id>`          |
| 🔄 Change   | `CHANGE_<order_id>`           |
| ⏭️ Skip     | `SKIP_<order_id>`             |

### Sample Body Text

```
🌅 *Tomorrow's Breakfast (15 Jan 2025)*

🌅 *Breakfast*: Idli Sambar (08:00)

You can confirm, skip, or change until *10pm tonight*.⚠️ Your plan expires in *2* delivery day(s)!
```

---

## 2. Lunch Notification (`lunch_notification`)

**Category:** UTILITY  
**Use:** Daily lunch notification sent via cron at ~8:30 AM IST (for today's lunch)

### Variables (Body - 5 parameters)

| Index | Name            | Type   | Example                                              | Description                        |
| ----- | --------------- | ------ | ---------------------------------------------------- | ---------------------------------- |
| {{1}} | `delivery_date` | String | "15 Jan 2025"                                        | Delivery date for lunch            |
| {{2}} | `item_line`     | String | "☀️ _Lunch_: Chicken Biryani"                        | Meal emoji + label + item name     |
| {{3}} | `time_str`      | String | "12:30"                                              | Delivery time (HH:MM)              |
| {{4}} | `deadline_msg`  | String | "⏰ Respond by _9:30am_ — changes close after that." | Action deadline                    |
| {{5}} | `expiry_notice` | String | "⚠️ Your plan expires in _2_ delivery day(s)!"       | Plan expiry warning (can be empty) |

### Buttons (Quick Reply - 3 buttons)

| Button Text | Payload (returned in webhook) |
| ----------- | ----------------------------- |
| ✅ Confirm  | `CONFIRM_<order_id>`          |
| 🔄 Change   | `CHANGE_<order_id>`           |
| ⏭️ Skip     | `SKIP_<order_id>`             |

### Sample Body Text

```
🍽️ *Today's Lunch (15 Jan 2025)*

☀️ *Lunch*: Chicken Biryani (12:30)

⏰ Respond by *9:30am* — changes close after that.⚠️ Your plan expires in *2* delivery day(s)!
```

---

## 3. Dinner Notification (`dinner_notification`)

**Category:** UTILITY  
**Use:** Daily dinner notification sent via cron at ~10:30 AM IST

### Variables (Body - 5 parameters)

| Index | Name            | Type   | Example                                           |
| ----- | --------------- | ------ | ------------------------------------------------- |
| {{1}} | `delivery_date` | String | "15 Jan 2025"                                     |
| {{2}} | `item_line`     | String | "🌙 _Dinner_: Dal Makhani + Roti"                 |
| {{3}} | `time_str`      | String | "19:30"                                           |
| {{4}} | `deadline_msg`  | String | "⏰ Respond by _5pm_ — changes close after that." |
| {{5}} | `expiry_notice` | String | "⚠️ Your plan expires in _2_ delivery day(s)!"    |

### Buttons (Quick Reply - 3 buttons)

| Button Text | Payload              |
| ----------- | -------------------- |
| ✅ Confirm  | `CONFIRM_<order_id>` |
| 🔄 Change   | `CHANGE_<order_id>`  |
| ⏭️ Skip     | `SKIP_<order_id>`    |

---

## 4. Rescheduled Meal (`rescheduled_meal`)

**Category:** UTILITY  
**Use:** Sent when a skipped meal is pushed to end of plan and now being delivered

### Variables (Body - 3 parameters)

| Index | Name         | Type   | Example           |
| ----- | ------------ | ------ | ----------------- |
| {{1}} | `slot_label` | String | "Lunch"           |
| {{2}} | `slot_emoji` | String | "☀️"              |
| {{3}} | `item_name`  | String | "Chicken Biryani" |

### Buttons (Quick Reply - 3 buttons)

| Button Text | Payload              |
| ----------- | -------------------- |
| ✅ Confirm  | `CONFIRM_<order_id>` |
| 🔄 Change   | `CHANGE_<order_id>`  |
| ⏭️ Skip     | `SKIP_<order_id>`    |

### Sample Body Text

```
⏭️ *Rescheduled Lunch*

You skipped this meal earlier — it's being delivered today.

☀️ *Lunch*: Chicken Biryani
```

---

## 5. Expiry Reminder (`expiry_reminder`)

**Category:** MARKETING  
**Use:** Daily cron at 8 AM IST for subscribers with exactly 2 delivery days remaining

### Variables (Body - 2 parameters)

| Index | Name         | Type   | Example                   |
| ----- | ------------ | ------ | ------------------------- |
| {{1}} | `plan_label` | String | "🥗 Healthy Diet Non-Veg" |
| {{2}} | `threshold`  | String | "2"                       |

### Buttons (Quick Reply - 2 buttons)

| Button Text   | Payload      |
| ------------- | ------------ |
| 🔄 Renew Plan | `ORDER_NOW`  |
| 📞 Contact Us | `CONTACT_US` |

### Sample Body Text

```
⏳ *Your FitFuel plan is almost over!*

Your *🥗 Healthy Diet Non-Veg plan* has only *2 delivery day(s)* remaining.

Don't miss your healthy streak — renew now to keep your meals coming! 🥗
```

---

## 6. Session Expired (`session_expired`)

**Category:** UTILITY  
**Use:** Cron runs every 5 min, notifies users whose session expired (5 min idle)

### Variables (Body - 0 parameters)

No body parameters - static text.

### Buttons (Quick Reply - 0 buttons)

None - this is a simple text notification.

### Sample Body Text

```
⏰ *Your session expired due to inactivity.*

Type *hi* to start again!
```

---

## 7. OTP Code (`otp_code`)

**Category:** AUTHENTICATION  
**Use:** Web dashboard login via WhatsApp OTP

### Variables (Body - 2 parameters)

| Index | Name       | Type   | Example     |
| ----- | ---------- | ------ | ----------- |
| {{1}} | `otp_code` | String | "482917"    |
| {{2}} | `validity` | String | "5 minutes" |

### Buttons

None - authentication template (OTP auto-fill on Android)

### Sample Body Text

```
Your FitFuel login code is: 482917. Valid for 5 minutes.
```

**Note:** For Authentication category, Meta requires:

- Add "OTP" button type (not quick reply)
- Set "OTP length" to 6
- Package name for Android auto-fill

---

## 8. Payment Failed (`payment_failed`)

**Category:** UTILITY  
**Use:** Razorpay webhook when payment link cancelled/expired/failed

### Variables (Body - 1 parameter)

| Index | Name     | Type   | Example                                 |
| ----- | -------- | ------ | --------------------------------------- |
| {{1}} | `reason` | String | "Cancelled" / "Link Expired" / "Failed" |

### Buttons (Quick Reply - 0 buttons)

None - informational only.

### Sample Body Text

```
❌ *Payment Cancelled*

Unfortunately your FitFuel order could not be completed.

Please send us a message to start a new order whenever you're ready. We're here to help! 🙏
```

---

## 9. Payment Confirmed (`payment_confirmed`)

**Category:** UTILITY  
**Use:** Razorpay webhook when payment_link.paid event received

### Variables (Body - 5 parameters)

| Index | Name          | Type   | Example                      |
| ----- | ------------- | ------ | ---------------------------- |
| {{1}} | `plan_title`  | String | "🥗 Healthy Diet Non-Veg"    |
| {{2}} | `day_label`   | String | "7 Days"                     |
| {{3}} | `meal_label`  | String | "Lunch + Dinner"             |
| {{4}} | `amount`      | String | "₹1,540"                     |
| {{5}} | `start_label` | String | "from 16 Jan 2025" / "today" |

### Buttons

None - confirmation message.

### Sample Body Text

```
🎉 *Payment Confirmed!*

Your FitFuel *🥗 Healthy Diet Non-Veg* plan is now *active*!

📅 Duration: 7 Days
🍴 Meals: Lunch + Dinner
💰 Amount paid: ₹1,540

📦 Deliveries start from 16 Jan 2025.
You'll get a daily notification before each meal to confirm, skip, or change it.

Thank you for choosing FitFuel! 💪
```

---

## 10. Kitchen Closed (`kitchen_closed`)

**Category:** UTILITY  
**Use:** Admin marks kitchen closed (holiday) → extends all active subscriptions by 1 day

### Variables (Body - 3 parameters)

| Index | Name             | Type   | Example                |
| ----- | ---------------- | ------ | ---------------------- |
| {{1}} | `date`           | String | "26 Jan 2025"          |
| {{2}} | `reason_line`    | String | "Republic Day holiday" |
| {{3}} | `remaining_days` | String | "5"                    |

### Buttons

None - informational.

### Sample Body Text

```
🔒 *Kitchen Closed — 26 Jan 2025*
Republic Day holiday

We're sorry, our kitchen won't be operating on 26 Jan 2025. No meals will be delivered that day.

✅ Your plan has been extended by 1 day to make up for it.
📅 You now have *5 delivery day(s)* remaining.

We'll be back the next working day! 🙏
```

---

## Implementation Notes

### Environment Variables (Vercel Project Settings)

Add all these to Vercel → Settings → Environment Variables:

```bash
WHATSAPP_BREAKFAST_TEMPLATE=breakfast_notification
WHATSAPP_LUNCH_TEMPLATE=lunch_notification
WHATSAPP_DINNER_TEMPLATE=dinner_notification
WHATSAPP_RESCHEDULED_TEMPLATE=rescheduled_meal
WHATSAPP_EXPIRY_TEMPLATE=expiry_reminder
WHATSAPP_SESSION_EXPIRED_TEMPLATE=session_expired
WHATSAPP_OTP_TEMPLATE=otp_code
WHATSAPP_PAYMENT_FAILED_TEMPLATE=payment_failed
WHATSAPP_PAYMENT_CONFIRMED_TEMPLATE=payment_confirmed
WHATSAPP_KITCHEN_CLOSED_TEMPLATE=kitchen_closed
```

### Meta Business Manager Checklist

For each template:

1. Go to WhatsApp Manager → Message Templates → Create Template
2. Select Category (Utility / Marketing / Authentication)
3. Name: Use exact name from table above
4. Language: English (en)
5. Add Body with `{{1}}`, `{{2}}`, etc. placeholders
6. Add Buttons (Quick Reply) as specified
7. Submit for review
8. Once **APPROVED**, set env var in Vercel (optional - defaults match)

### Testing

Use Meta's test phone numbers in WhatsApp Manager to test each template before going live.

### Fallback Behavior

Code automatically detects 24-hour WhatsApp session window:

- **User messaged < 24h ago** → Uses interactive messages (buttons/lists) - no template needed
- **User silent > 24h** → Uses approved template from above list

This ensures delivery even when user hasn't messaged recently.
