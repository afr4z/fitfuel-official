# WhatsApp Template Catalog

Create every template in **Meta Business Manager → WhatsApp Manager → Message
Templates**, then set the matching environment variable in Vercel.

The copy-paste body text lives in [`templates-body.md`](./templates-body.md).
Keep the variable order in that file unchanged: the application sends positional
parameters, not names.

## Template overview

| Purpose                | Env var                               | Default name             | Category       | Params | Buttons       | Sent / trigger                            |
| ---------------------- | ------------------------------------- | ------------------------ | -------------- | ------ | ------------- | ----------------------------------------- |
| Breakfast notification | `WHATSAPP_BREAKFAST_TEMPLATE`         | `breakfast_notification` | UTILITY        | 5      | 3 quick reply | Daily ~8:00 PM IST, next day's breakfast  |
| Lunch notification     | `WHATSAPP_LUNCH_TEMPLATE`             | `lunch_notification`     | UTILITY        | 5      | 3 quick reply | Daily ~8:30 AM IST, same day's lunch      |
| Dinner notification    | `WHATSAPP_DINNER_TEMPLATE`            | `dinner_notification`    | UTILITY        | 5      | 3 quick reply | Daily ~4:00 PM IST, same day's dinner     |
| Rescheduled meal       | `WHATSAPP_RESCHEDULED_TEMPLATE`       | `rescheduled_meal`       | UTILITY        | 4      | 3 quick reply | When a skipped meal is pushed to the end  |
| Expiry reminder        | `WHATSAPP_EXPIRY_TEMPLATE`            | `expiry_reminder`        | MARKETING      | 2      | 2 quick reply | Daily ~1:30 PM IST                        |
| Session expired        | `WHATSAPP_SESSION_EXPIRED_TEMPLATE`   | `session_expired`        | UTILITY        | 0      | none          | VPS cron, every minute                    |
| OTP code               | `WHATSAPP_OTP_TEMPLATE`               | `otp_code`               | AUTHENTICATION | 2      | OTP button    | Website login request                     |
| Payment failed         | `WHATSAPP_PAYMENT_FAILED_TEMPLATE`    | `payment_failed`         | UTILITY        | 1      | none          | Razorpay failure/cancel/expiry webhook    |
| Payment confirmed      | `WHATSAPP_PAYMENT_CONFIRMED_TEMPLATE` | `payment_confirmed`      | UTILITY        | 5      | none          | Razorpay `payment_link.paid` webhook      |
| GST invoice            | `WHATSAPP_INVOICE_TEMPLATE`           | `invoice_ready`          | UTILITY        | 1      | none          | Payment webhook, document-header fallback |
| Kitchen closed         | `WHATSAPP_KITCHEN_CLOSED_TEMPLATE`    | `kitchen_closed`         | UTILITY        | 3      | none          | Admin marks a kitchen-closed day          |
| Subscription cancelled | `WHATSAPP_CANCELLED_TEMPLATE`         | `subscription_cancelled` | UTILITY        | 2      | none          | Admin cancels a subscription              |

> `subscription_cancelled` may not exist in Meta yet. Create it, or point
> `WHATSAPP_CANCELLED_TEMPLATE` at an approved equivalent template with the same
> two body parameters.

---

## Variable order

### Meal notifications

Breakfast, lunch, and dinner all use the same five positional parameters:

| Index   | Name            | Example                                                 |
| ------- | --------------- | ------------------------------------------------------- |
| `{{1}}` | `delivery_date` | `15 Jan 2025`                                           |
| `{{2}}` | `item_name`     | `Idli Sambar`                                           |
| `{{3}}` | `time_str`      | `08:00`                                                 |
| `{{4}}` | `deadline_msg`  | `You can confirm, skip, or change until 10pm tonight.`  |
| `{{5}}` | `expiry_notice` | `⚠️ Your plan expires in 2 delivery day(s)!` (or empty) |

Buttons:

| Button     | Payload returned by WhatsApp |
| ---------- | ---------------------------- |
| ✅ Confirm | `CONFIRM_<order_id>`         |
| 🔄 Change  | `CHANGE_<order_id>`          |
| ⏭️ Skip    | `SKIP_<order_id>`            |

### Rescheduled meal

| Index   | Name            | Example           |
| ------- | --------------- | ----------------- |
| `{{1}}` | `slot_label`    | `Lunch`           |
| `{{2}}` | `slot_emoji`    | `☀️`              |
| `{{3}}` | `item_name`     | `Chicken Biryani` |
| `{{4}}` | `delivery_date` | `15 Jan 2025`     |

Buttons: Confirm / Change / Skip, with the same payloads as the meal
notifications.

### Expiry reminder

| Index   | Name         | Example                   |
| ------- | ------------ | ------------------------- |
| `{{1}}` | `plan_label` | `🥗 Healthy Diet Non-Veg` |
| `{{2}}` | `threshold`  | `2`                       |

Buttons:

| Button        | Payload      |
| ------------- | ------------ |
| 🔄 Renew Plan | `ORDER_NOW`  |
| 📞 Contact Us | `CONTACT_US` |

The reminder is sent when exactly `RENEWAL_THRESHOLD_DAYS` delivery days remain
(default `2`).

### Session expired

No body parameters. Sent when the bot session has been idle longer than
`SESSION_TIMEOUT_MINUTES` (default `5`).

### OTP code

| Index   | Name       | Example     |
| ------- | ---------- | ----------- |
| `{{1}}` | `otp_code` | `482917`    |
| `{{2}}` | `validity` | `5 minutes` |

Use Meta's **Authentication** category and OTP button. Do not use quick-reply
buttons for this template.

### Payment failed

| Index   | Name     | Example                               |
| ------- | -------- | ------------------------------------- |
| `{{1}}` | `reason` | `Cancelled`, `Link Expired`, `Failed` |

### Payment confirmed

| Index   | Name          | Example                   |
| ------- | ------------- | ------------------------- |
| `{{1}}` | `plan_title`  | `🥗 Healthy Diet Non-Veg` |
| `{{2}}` | `day_label`   | `7 Days`                  |
| `{{3}}` | `meal_label`  | `Lunch + Dinner`          |
| `{{4}}` | `amount`      | `₹1,540`                  |
| `{{5}}` | `start_label` | `16 January 2025`         |

### GST invoice

This template has a **document header** and one body parameter. The PDF media
id is supplied in the header; the body receives the caption text.

| Index   | Name      | Example                                                  |
| ------- | --------- | -------------------------------------------------------- |
| `{{1}}` | `caption` | `FitFuel tax invoice FF/2026-27/0001 — ₹17,220.00 paid.` |

### Kitchen closed

| Index   | Name             | Example                |
| ------- | ---------------- | ---------------------- |
| `{{1}}` | `date`           | `26 Jan 2025`          |
| `{{2}}` | `reason_line`    | `Republic Day holiday` |
| `{{3}}` | `remaining_days` | `5`                    |

### Subscription cancelled

| Index   | Name             | Example                            |
| ------- | ---------------- | ---------------------------------- |
| `{{1}}` | `plan_label`     | `🥗 Healthy Diet Non-Veg (7 Days)` |
| `{{2}}` | `effective_date` | `28 Oct 2026`                      |

This template has no buttons. The message tells the customer that no meals will
be delivered from the effective date and asks them to reply if they want to
discuss a refund.

---

## Environment variables

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
WHATSAPP_INVOICE_TEMPLATE=invoice_ready
WHATSAPP_KITCHEN_CLOSED_TEMPLATE=kitchen_closed
WHATSAPP_CANCELLED_TEMPLATE=subscription_cancelled
```

These are optional because the defaults above are already used in code. Set them
only when the Meta template name differs.

## Meta Business Manager checklist

For each template:

1. Go to **WhatsApp Manager → Message Templates → Create Template**.
2. Select the category shown in the overview.
3. Use the exact template name shown in the overview (or update the env var).
4. Select **English (en)**.
5. Paste the body from `templates-body.md` without changing the `{{n}}` order.
6. Add the quick-reply or OTP buttons listed above.
7. Submit for review.
8. Once **APPROVED**, confirm the env var in Vercel.

## Fallback behavior

`lib/sendNotification.js` first tries an interactive message with buttons or a
list. If Meta rejects it with error `131047` (the customer is outside the
24-hour window), it retries as the approved template. The interactive body is
also available as a fallback if the template send fails.

Template names and parameter order therefore need to stay in sync with
`lib/notifySlot.js`, `lib/sendNotification.js`, and the callers in `api/`.
