# Missing WhatsApp templates — creation spec

Audited against the live WhatsApp Business Account on **30 Oct 2026** by sending
each template from `+91 63001 59766` and reading Meta's error codes.

## Status

| Template                 | Live status                          |
| ------------------------ | ------------------------------------ |
| `breakfast_notification` | ✅ exists (`en`) — verified end to end |
| `otp_code_en`            | ✅ exists (`en`)                      |
| `meal_dispatched`        | ✅ exists (`en_US`)                   |
| `lunch_notification`     | ✅ exists (`en`) — verified 30 Oct     |
| `dinner_notification`    | ❌ missing                            |
| `rescheduled_meal`       | ❌ missing                            |
| `expiry_reminder`        | ❌ missing                            |
| `session_expired`        | ❌ missing                            |
| `payment_failed`         | ❌ missing                            |
| `payment_confirmed`      | ❌ missing (and unused in code)       |
| `kitchen_closed`         | ❌ missing                            |
| `subscription_cancelled` | ❌ missing                            |
| `invoice_ready`          | ❌ unverified (needs a document header) |

`lunch_notification` returned `132001` while it was in review, then sent
successfully in `en` once approved — a pending template is indistinguishable
from a missing one by error code. Anything created as `en` needs no code change;
`lib/whatsapp.js` retries `en_US` automatically on `132001`.

**Why this matters:** the bot sends free-form text first and only falls back to a
template when Meta returns `131047` (customer outside the 24-hour service
window). A missing template turns that fallback into a silent failure — the
customer simply gets nothing.

## How to create one

WhatsApp Manager → **Message templates** → **Create template**, then:

1. **Name** — exact string from the spec below.
2. **Category** — as listed.
3. **Language** — **English** (`en`) for all of these. `breakfast_notification`
   is `en`, `meal_dispatched` is `en_US`. `lib/whatsapp.js` retries the other
   English variant on `132001`, so either works, but `en` matches the code
   default.
4. **Header** — Text with 1 variable where listed; otherwise none.
5. **Body** — paste the block exactly. Variables are positional (`{{1}}`,
   `{{2}}`, …).
6. **Buttons** — Quick Reply, **in the order given**. Order is positional.
7. **Samples** — Meta refuses to review without a sample for every variable.

## Button payloads are sent at send time

Quick-reply buttons are declared statically in the template, but the payload is
supplied when the template is sent:

```json
{ "type": "button", "sub_type": "quick_reply", "index": "0",
  "parameters": [{ "type": "payload", "payload": "CONFIRM_<order-uuid>" }] }
```

`lib/sendNotification.js` now does this automatically for every template that
has reply buttons, so a tap arrives as `CONFIRM_<uuid>` and routes straight to
`handleOrderAction`. Verified on 30 Oct: with no button component the payload
comes back as the button title (`Confirm`); with one it comes back as the
supplied value.

`index` is the button's position, **0-based**. If the template's button order
does not match the code's array order, the wrong action fires.

---

## 1. `dinner_notification`

| Field | Value |
| --- | --- |
| Category | UTILITY |
| Language | `en` |
| Header | Text, 1 variable |
| Buttons | Quick Reply ×3 |
| Sent by | `lib/notifySlot.js` |
| Schedule | 16:00 IST daily (`30 10 * * *`) |

**Header:** `Today's Dinner ({{1}})`

**Body:**

```
🌙 Good afternoon! Your dinner for today ({{1}}) is scheduled.

🍽️ Meal: {{2}} at 19:30

You can confirm, skip, or change until {{3}}.
Tap a button below to confirm, change, or skip this meal.
```

**Variables:** `{{1}}` delivery_date · `{{2}}` item_name · `{{3}}` cutoff

**Samples:** `15 January 2025` · `Dal Makhani with Roti` · `5pm`

**Buttons:** ✅ Confirm · 🔄 Change · ⏭️ Skip

---

## 2. `rescheduled_meal`

| Field | Value |
| --- | --- |
| Category | UTILITY |
| Language | `en` |
| Header | none |
| Buttons | Quick Reply ×3 |
| Sent by | `lib/notifySlot.js` (`getRescheduledParams`) |
| Schedule | with the slot cron, when a skipped meal is pushed into the plan |

**Body:**

```
⏭️ Hi there! The {{1}} you skipped earlier is now being delivered today ({{4}}).

🍽️ {{2}} {{1}}: {{3}}

Please let us know if you'd like to confirm, change, or skip this meal.
```

**Variables:** `{{1}}` slot_label · `{{2}}` slot_emoji · `{{3}}` item_name · `{{4}}` delivery_date

**Samples:** `Lunch` · `☀️` · `Chicken Biryani` · `15 January 2025`

**Buttons:** ✅ Confirm · 🔄 Change · ⏭️ Skip

Payloads: `CONFIRM_<uuid>` · `CHANGE_<uuid>` · `SKIP_<uuid>`

---

## 3. `expiry_reminder`

| Field | Value |
| --- | --- |
| Category | MARKETING |
| Language | `en` |
| Header | none |
| Buttons | Quick Reply ×2 |
| Sent by | `api/cron/expiry-reminder.js` |
| Schedule | 13:30 IST daily (`0 8 * * *`) |

**Body:**

```
⏳ Hi! Your FitFuel {{1}} plan is ending soon.

You have only {{2}} delivery day(s) remaining. Don't let your healthy streak end — renew today to keep your meals coming! 🥗
```

**Variables:** `{{1}}` plan_label · `{{2}}` threshold

**Samples:** `Healthy Diet Non-Veg` · `2`

**Buttons:** 🔄 Renew Plan · 📞 Contact Us

Payloads: `ORDER_NOW` · `CONTACT_US`

> Marketing category = per-message pricing and opt-out rules. If renewal nudges
> should stay free, this must be UTILITY — but Meta may reject renewal copy as
> utility, so keep MARKETING.

---

## 4. `session_expired`

| Field | Value |
| --- | --- |
| Category | UTILITY |
| Language | `en` |
| Header | none |
| Buttons | none |
| Sent by | `api/cron/session-expiry.js` |
| Trigger | VPS crontab, every minute |

**Body:**

```
⏰ Your session has expired due to inactivity.

Please type "hi" to start a new conversation with FitFuel Nutrition.
```

**Variables:** none

**Samples:** none

> Note: "type hi" is allowed — it is a bot keyword, not a human support request.
> Do **not** add "reply to this chat".

---

## 5. `payment_failed`

| Field | Value |
| --- | --- |
| Category | UTILITY |
| Language | `en` |
| Header | none |
| Buttons | none |
| Sent by | `api/razorpay-webhook.js` |

**Body:**

```
❌ We're sorry — your payment was {{1}}.

Unfortunately your FitFuel order could not be completed. Type "hi" to start a new order. If money left your account, email support@fitfuelnutrition.in with the payment reference and we'll sort it out. 🙏
```

**Variables:** `{{1}}` reason

**Samples:** `cancelled`

---

## 6. `kitchen_closed`

| Field | Value |
| --- | --- |
| Category | UTILITY |
| Language | `en` |
| Header | none |
| Buttons | none |
| Sent by | `api/admin.js`, `api/razorpay-webhook.js` |

**Body:**

```
🔒 Kitchen Closed Notice — {{1}}

{{2}}

Our kitchen will be closed on {{1}}, so no meals will be delivered that day.

Good news: your plan has been extended by 1 day. You now have {{3}} delivery day(s) remaining.

We'll be back the next working day! 🙏
```

**Variables:** `{{1}}` date · `{{2}}` reason_line · `{{3}}` remaining_days

**Samples:** `26 January 2025` · `Republic Day holiday` · `5`

---

## 7. `subscription_cancelled`

| Field | Value |
| --- | --- |
| Category | UTILITY |
| Language | `en` |
| Header | none |
| Buttons | none |
| Sent by | `api/admin.js` |

**Body:**

```
❌ Your FitFuel plan has been cancelled.

📦 Plan: {{1}}
📅 No meals will be delivered from {{2}}.

If this was a mistake, or you'd like to discuss a refund, email support@fitfuelnutrition.in and our team will help.

Thank you for choosing FitFuel. 🙏
```

**Variables:** `{{1}}` plan_label · `{{2}}` effective_date

**Samples:** `🥗 Healthy Diet Non-Veg (7 Days)` · `28 Oct 2026`

---

## 8. `invoice_ready`

| Field | Value |
| --- | --- |
| Category | UTILITY |
| Language | `en` |
| Header | **Document** (PDF) |
| Buttons | none |
| Sent by | `lib/invoiceService.js` |

**Body:**

```
Your FitFuel GST invoice is attached.

{{1}}

Thank you for choosing FitFuel.
```

**Variables:** `{{1}}` caption

**Samples:** `FitFuel tax invoice FF/2026-27/0001 — Amount paid: ₹17,220.00`

> A document header requires a real PDF at send time. The code already uploads
> the invoice and passes `header_handle` — verify with a real invoice before
> relying on this one.

---

## 9. `payment_confirmed` — exists in config, unused in code

No file references `WHATSAPP_PAYMENT_CONFIRMED_TEMPLATE`. Either delete the env
var or wire it into `api/razorpay-webhook.js` after a successful payment. Spec
lives in `templates-body.md` §9 if you want it.

---

## Code ↔ template contract

| Template | Header | Body params | Buttons |
| --- | --- | --- | --- |
| `breakfast_notification` | 1 (date) | 3 (date, dish, cutoff) | 3 QR |
| `lunch_notification` | 1 (date) | 3 (date, dish, cutoff) | 3 QR |
| `dinner_notification` | 1 (date) | 3 (date, dish, cutoff) | 3 QR |
| `rescheduled_meal` | none | 4 | 3 QR |
| `expiry_reminder` | none | 2 | 2 QR |
| `session_expired` | none | 0 | none |
| `payment_failed` | none | 1 | none |
| `kitchen_closed` | none | 3 | none |
| `subscription_cancelled` | none | 2 | none |
| `invoice_ready` | document | 1 | none |
| `meal_dispatched` | none | 2 (named: `meal_slot`, `dish_name`) | none |

Meal times are **hardcoded in the templates** (breakfast 8:00, lunch 12:30,
dinner 19:30), matching `lib/cronUtils.js`. If a slot's delivery time is changed
in the database, the template must be edited too — or the time promoted to a
variable in both places.
