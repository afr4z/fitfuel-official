# Missing WhatsApp templates — creation spec

Audited against the live WhatsApp Business Account on **30 Oct 2026** by sending
each template from `+91 63001 59766` and reading Meta's error codes.

**Result:** only 3 of the 12 templates the code sends actually exist.

| Template                 | Live status                |
| ------------------------ | -------------------------- |
| `breakfast_notification` | ✅ exists (`en`)            |
| `otp_code_en`            | ✅ exists (`en`)            |
| `meal_dispatched`        | ✅ exists (`en_US`)         |
| `lunch_notification`     | ❌ missing                  |
| `dinner_notification`    | ❌ missing                  |
| `rescheduled_meal`       | ❌ missing                  |
| `expiry_reminder`        | ❌ missing                  |
| `session_expired`        | ❌ missing                  |
| `payment_failed`         | ❌ missing                  |
| `payment_confirmed`      | ❌ missing (and unused)     |
| `kitchen_closed`         | ❌ missing                  |
| `subscription_cancelled` | ❌ missing                  |
| `invoice_ready`          | ❌ unverified (document header) |

**Why this matters:** the bot sends free-form text first and only falls back to a
template when Meta returns `131047` (customer outside the 24-hour service
window). A missing template turns that fallback into a silent failure — the
customer simply gets nothing.

## How to create one

WhatsApp Manager → **Message templates** → **Create template**, then:

1. **Name** — exact string from the table below.
2. **Category** — as listed.
3. **Language** — **English** (`en`) for all of these. The existing
   `breakfast_notification` is `en`; `meal_dispatched` is `en_US`. `lib/whatsapp.js`
   now retries the other English variant on `132001`, so either works, but `en`
   matches the code default.
4. **Header** — Text, 1 variable where listed.
5. **Body** — paste the block exactly.
6. **Buttons** — Quick Reply, in the order given.
7. **Samples** — Meta refuses to review without a sample for every variable.

---

## 1. `lunch_notification`

| Field | Value |
| --- | --- |
| Category | UTILITY |
| Language | en |
| Header | Text, 1 variable |
| Buttons | Quick Reply ×3 |
| Sent by | `lib/notifySlot.js` |
| Schedule | 08:30 IST daily (`0 3 * * *`) |

**Header:** `Your lunch for today, {{1}}`

**Body:**

```
☀️ Good morning! Your lunch for today ({{1}}) is scheduled.

🍽️ Meal: {{2}} at 12:30

⏰ Respond by {{3}} — changes close after that.
Please use the buttons below to manage your order.
```

**Variables:** `{{1}}` delivery_date · `{{2}}` item_name · `{{3}}` cutoff

**Samples:** `15 January 2025` · `Chicken Biryani` · `9:30am`

**Buttons:** ✅ Confirm · 🔄 Change · ⏭️ Skip

---

## 2. `dinner_notification`

| Field | Value |
| --- | --- |
| Category | UTILITY |
| Language | en |
| Header | Text, 1 variable |
| Buttons | Quick Reply ×3 |
| Sent by | `lib/notifySlot.js` |
| Schedule | 16:00 IST daily (`30 10 * * *`) |

**Header:** `Your dinner for today, {{1}}`

**Body:**

```
🌙 Good afternoon! Your dinner for today ({{1}}) is scheduled.

🍽️ Meal: {{2}} at 19:30

⏰ Respond by {{3}} — changes close after that.
Use the buttons below to confirm, change, or skip.
```

**Variables:** `{{1}}` delivery_date · `{{2}}` item_name · `{{3}}` cutoff

**Samples:** `15 January 2025` · `Dal Makhani with Roti` · `5pm`

**Buttons:** ✅ Confirm · 🔄 Change · ⏭️ Skip

---

## 3. `rescheduled_meal`

| Field | Value |
| --- | --- |
| Category | UTILITY |
| Language | en |
| Header | none |
| Buttons | Quick Reply ×3 |
| Sent by | `lib/notifySlot.js` (`getRescheduledParams`) |

**Body:**

```
⏭️ Hi there! The {{1}} you skipped earlier is now being delivered today ({{4}}).

🍽️ {{2}} {{1}}: {{3}}

Please let us know if you'd like to confirm, change, or skip this meal.
```

**Variables:** `{{1}}` slot_label · `{{2}}` slot_emoji · `{{3}}` item_name · `{{4}}` delivery_date

**Samples:** `Lunch` · `☀️` · `Chicken Biryani` · `15 January 2025`

**Buttons:** ✅ Confirm · 🔄 Change · ⏭️ Skip

---

## 4. `expiry_reminder`

| Field | Value |
| --- | --- |
| Category | MARKETING |
| Language | en |
| Header | none |
| Buttons | Quick Reply ×2 |
| Sent by | `api/cron/expiry-reminder.js:94` |
| Schedule | 13:30 IST daily (`0 8 * * *`) |

**Body:**

```
⏳ Hi! Your FitFuel {{1}} plan is ending soon.

You have only {{2}} delivery day(s) remaining. Don't let your healthy streak end — renew today to keep your meals coming! 🥗
```

**Variables:** `{{1}}` plan_label · `{{2}}` threshold

**Samples:** `Healthy Diet Non-Veg` · `2`

**Buttons:** 🔄 Renew Plan · 📞 Contact Us

> Marketing category = per-message pricing and opt-out rules. If renewal nudges
> should stay free, this must be UTILITY — but Meta may reject renewal copy as
> utility, so keep MARKETING.

---

## 5. `session_expired`

| Field | Value |
| --- | --- |
| Category | UTILITY |
| Language | en |
| Header | none |
| Buttons | none |
| Sent by | `api/cron/session-expiry.js:24` |
| Trigger | VPS crontab, every minute |

**Body:**

```
⏰ Your session has expired due to inactivity.

Please type "hi" to start a new conversation with FitFuel Nutrition.
```

**Variables:** none

> Note: "type hi" is allowed — it is a bot keyword, not a human support request.
> Do **not** add "reply to this chat".

---

## 6. `payment_failed`

| Field | Value |
| --- | --- |
| Category | UTILITY |
| Language | en |
| Header | none |
| Buttons | none |
| Sent by | `api/razorpay-webhook.js:185` |

**Body:**

```
❌ We're sorry — your payment was {{1}}.

Unfortunately your FitFuel order could not be completed. Type "hi" to start a new order. If money left your account, email support@fitfuelnutrition.in with the payment reference and we'll sort it out. 🙏
```

**Variables:** `{{1}}` reason

**Samples:** `cancelled`

---

## 7. `kitchen_closed`

| Field | Value |
| --- | --- |
| Category | UTILITY |
| Language | en |
| Header | none |
| Buttons | none |
| Sent by | `api/admin.js:744`, `api/razorpay-webhook.js:454` |

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

## 8. `subscription_cancelled`

| Field | Value |
| --- | --- |
| Category | UTILITY |
| Language | en |
| Header | none |
| Buttons | none |
| Sent by | `api/admin.js:477` |

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

## 9. `invoice_ready`

| Field | Value |
| --- | --- |
| Category | UTILITY |
| Language | en |
| Header | **Document** (PDF) |
| Buttons | none |
| Sent by | `lib/invoiceService.js:109` |

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

## 10. `otp_code_en` — exists, already correct

| Field | Value |
| --- | --- |
| Category | AUTHENTICATION |
| Language | en |
| Body | `Your FitFuel verification code is {{1}}.` |
| Button | OTP / copy-code, 6 digits |
| Sent by | `api/auth.js:485` |

Sending needs **two** components — body *and* button:

```json
[
  { "type": "body", "parameters": [{ "type": "text", "text": "482913" }] },
  { "type": "button", "sub_type": "url", "index": 0,
    "parameters": [{ "type": "text", "text": "482913" }] }
]
```

`api/auth.js` already does this. Sending only the body returns
`131008 Required parameter is missing`.

---

## 11. `payment_confirmed` — exists in config, unused in code

No file references `WHATSAPP_PAYMENT_CONFIRMED_TEMPLATE`. Either delete the env
var or wire it into `api/razorpay-webhook.js` after a successful payment. Spec
lives in `templates-body.md` §9 if you want it.

---

## Code ↔ template contract

| Template | Header | Body params |
| --- | --- | --- |
| `breakfast_notification` | 1 (date) | 3 (date, dish, cutoff) |
| `lunch_notification` | 1 (date) | 3 (date, dish, cutoff) |
| `dinner_notification` | 1 (date) | 3 (date, dish, cutoff) |
| `rescheduled_meal` | none | 4 |
| `expiry_reminder` | none | 2 |
| `session_expired` | none | 0 |
| `payment_failed` | none | 1 |
| `kitchen_closed` | none | 3 |
| `subscription_cancelled` | none | 2 |
| `invoice_ready` | document | 1 |
| `meal_dispatched` | none | 2 (named: `meal_slot`, `dish_name`) |

Meal times are **hardcoded in the templates** (breakfast 8:00, lunch 12:30,
dinner 19:30), matching `lib/cronUtils.js`. If a slot's delivery time is changed
in the database, the template must be edited too — or the time promoted to a
variable in both places.
