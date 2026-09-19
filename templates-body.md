# WhatsApp Template Body Text (Copy-Paste Ready)

---

## 1. Breakfast Notification (`breakfast_notification`)

**Category:** UTILITY  
**Language:** en  
**Buttons:** Quick Reply (3) - Confirm, Change, Skip

### Body Text (copy this exactly):

```
🌅 *Tomorrow's Breakfast ({{1})*

{{2}} ({{3}})

{{4}}{{5}}
```

### Variables:
- {{1}} = delivery_date (e.g., "15 Jan 2025")
- {{2}} = item_line (e.g., "🌅 *Breakfast*: Idli Sambar")
- {{3}} = time_str (e.g., "08:00")
- {{4}} = deadline_msg (e.g., "You can confirm, skip, or change until *10pm tonight*.")
- {{5}} = expiry_notice (e.g., "⚠️ Your plan expires in *2* delivery day(s)!")

### Buttons (Quick Reply):
1. ✅ Confirm → payload: `CONFIRM_<order_id>`
2. 🔄 Change → payload: `CHANGE_<order_id>`
3. ⏭️ Skip → payload: `SKIP_<order_id>`

---

## 2. Lunch Notification (`lunch_notification`)

**Category:** UTILITY  
**Language:** en  
**Buttons:** Quick Reply (3) - Confirm, Change, Skip

### Body Text:

```
☀️ *Today's Lunch ({{1})*

{{2}} ({{3}})

{{4}}{{5}}
```

### Variables:
- {{1}} = delivery_date (e.g., "15 Jan 2025")
- {{2}} = item_line (e.g., "☀️ *Lunch*: Chicken Biryani")
- {{3}} = time_str (e.g., "12:30")
- {{4}} = deadline_msg (e.g., "⏰ Respond by *9:30am* — changes close after that.")
- {{5}} = expiry_notice (e.g., "⚠️ Your plan expires in *2* delivery day(s)!")

### Buttons (Quick Reply):
1. ✅ Confirm → `CONFIRM_<order_id>`
2. 🔄 Change → `CHANGE_<order_id>`
3. ⏭️ Skip → `SKIP_<order_id>`

---

## 3. Dinner Notification (`dinner_notification`)

**Category:** UTILITY  
**Language:** en  
**Buttons:** Quick Reply (3) - Confirm, Change, Skip

### Body Text:

```
🌙 *Today's Dinner ({{1})*

{{2}} ({{3}})

{{4}}{{5}}
```

### Variables:
- {{1}} = delivery_date (e.g., "15 Jan 2025")
- {{2}} = item_line (e.g., "🌙 *Dinner*: Dal Makhani + Roti")
- {{3}} = time_str (e.g., "19:30")
- {{4}} = deadline_msg (e.g., "⏰ Respond by *5pm* — changes close after that.")
- {{5}} = expiry_notice (e.g., "⚠️ Your plan expires in *2* delivery day(s)!")

### Buttons (Quick Reply):
1. ✅ Confirm → `CONFIRM_<order_id>`
2. 🔄 Change → `CHANGE_<order_id>`
3. ⏭️ Skip → `SKIP_<order_id>`

---

## 4. Rescheduled Meal (`rescheduled_meal`)

**Category:** UTILITY  
**Language:** en  
**Buttons:** Quick Reply (3) - Confirm, Change, Skip

### Body Text:

```
⏭️ *Rescheduled {{1})*

You skipped this meal earlier — it's being delivered today.

{{2}} *{{1}}*: {{3}}
```

### Variables:
- {{1}} = slot_label (e.g., "Lunch")
- {{2}} = slot_emoji (e.g., "☀️")
- {{3}} = item_name (e.g., "Chicken Biryani")

### Buttons (Quick Reply):
1. ✅ Confirm → `CONFIRM_<order_id>`
2. 🔄 Change → `CHANGE_<order_id>`
3. ⏭️ Skip → `SKIP_<order_id>`

---

## 5. Expiry Reminder (`expiry_reminder`)

**Category:** MARKETING  
**Language:** en  
**Buttons:** Quick Reply (2) - Renew Plan, Contact Us

### Body Text:

```
⏳ *Your FitFuel plan is almost over!*

Your *{{1}} plan* has only *{{2}} delivery day(s)* remaining.

Don't miss your healthy streak — renew now to keep your meals coming! 🥗
```

### Variables:
- {{1}} = plan_label (e.g., "🥗 Healthy Diet Non-Veg")
- {{2}} = threshold (e.g., "2")

### Buttons (Quick Reply):
1. 🔄 Renew Plan → `ORDER_NOW`
2. 📞 Contact Us → `CONTACT_US`

---

## 6. Session Expired (`session_expired`)

**Category:** UTILITY  
**Language:** en  
**Buttons:** None (text only)

### Body Text:

```
⏰ *Your session expired due to inactivity.*

Type *hi* to start again!
```

### Variables: None

---

## 7. OTP Code (`otp_code`)

**Category:** AUTHENTICATION  
**Language:** en  
**Buttons:** OTP auto-fill (not Quick Reply)

### Body Text:

```
Your FitFuel login code is: {{1}}. Valid for {{2}}.
```

### Variables:
- {{1}} = otp_code (e.g., "482917")
- {{2}} = validity (e.g., "5 minutes")

### Special Settings:
- **Button Type:** "OTP" (not Quick Reply)
- **OTP Length:** 6
- **Package Name:** `com.fitfuel.nutrition` (for Android auto-fill)

---

## 8. Payment Failed (`payment_failed`)

**Category:** UTILITY  
**Language:** en  
**Buttons:** None

### Body Text:

```
❌ *Payment {{1})*

Unfortunately your FitFuel order could not be completed.

Please send us a message to start a new order whenever you're ready. We're here to help! 🙏
```

### Variables:
- {{1}} = reason (e.g., "Cancelled" / "Link Expired" / "Failed")

---

## 9. Payment Confirmed (`payment_confirmed`)

**Category:** UTILITY  
**Language:** en  
**Buttons:** None

### Body Text:

```
🎉 *Payment Confirmed!*

Your FitFuel *{{1}}* plan is now *active*!

📅 Duration: {{2}}
🍴 Meals: {{3}}
💰 Amount paid: {{4}}

📦 Deliveries start {{5}}.
You'll get a daily notification before each meal to confirm, skip, or change it.

Thank you for choosing FitFuel! 💪
```

### Variables:
- {{1}} = plan_title (e.g., "🥗 Healthy Diet Non-Veg")
- {{2}} = day_label (e.g., "7 Days")
- {{3}} = meal_label (e.g., "Lunch + Dinner")
- {{4}} = amount (e.g., "₹1,540")
- {{5}} = start_label (e.g., "from 16 Jan 2025" or "today")

---

## 10. Kitchen Closed (`kitchen_closed`)

**Category:** UTILITY  
**Language:** en  
**Buttons:** None

### Body Text:

```
🔒 *Kitchen Closed — {{1})*
{{2}}

We're sorry, our kitchen won't be operating on {{1}}. No meals will be delivered that day.

✅ Your plan has been extended by 1 day to make up for it.
📅 You now have *{{3}} delivery day(s)* remaining.

We'll be back the next working day! 🙏
```

### Variables:
- {{1}} = date (e.g., "26 Jan 2025")
- {{2}} = reason_line (e.g., "Republic Day holiday")
- {{3}} = remaining_days (e.g., "5")

---

## Quick Reference: All Variables

| Template | Variables |
|----------|-----------|
| breakfast_notification | {{1}} date, {{2}} item_line, {{3}} time, {{4}} deadline, {{5}} expiry |
| lunch_notification | {{1}} date, {{2}} item_line, {{3}} time, {{4}} deadline, {{5}} expiry |
| dinner_notification | {{1}} date, {{2}} item_line, {{3}} time, {{4}} deadline, {{5}} expiry |
| rescheduled_meal | {{1}} slot_label, {{2}} slot_emoji, {{3}} item_name |
| expiry_reminder | {{1}} plan_label, {{2}} threshold |
| session_expired | (none) |
| otp_code | {{1}} otp_code, {{2}} validity |
| payment_failed | {{1}} reason |
| payment_confirmed | {{1}} plan_title, {{2}} day_label, {{3}} meal_label, {{4}} amount, {{5}} start_label |
| kitchen_closed | {{1}} date, {{2}} reason, {{3}} remaining_days |

---

## Meta Business Manager Setup Checklist

For each template:
1. [ ] Create template with exact name above
2. [ ] Select correct Category (Utility/Marketing/Authentication)
3. [ ] Paste Body Text exactly as shown
4. [ ] Add Variables as numbered parameters {{1}}, {{2}}, etc.
5. [ ] Add Buttons (Quick Reply) as specified
6. [ ] For OTP: Set Button Type = "OTP", OTP Length = 6
7. [ ] Submit for review
8. [ ] Once APPROVED, test with test phone numbers