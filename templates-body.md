# WhatsApp Template Body Text (Copy-Paste Ready for Meta Business Manager)

---

## 1. Breakfast Notification (`breakfast_notification`)

**Category:** UTILITY | **Language:** en | **Buttons:** Quick Reply (3)

### Body Text (copy exactly):

```
🌅 Good morning! Your breakfast for {{1}} is scheduled.

🍽️ Meal: {{2}} at {{3}}

{{4}} {{5}}

Tap a button below to confirm, change, or skip this meal.
```

### Variables (in order):
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
| delivery_date | item_name | time_str | deadline_msg | expiry_notice |

### Sample Values:
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
| 15 January 2025 | Idli Sambar | 08:00 | You can confirm, skip, or change until 10pm tonight. | Your plan expires in 2 delivery days. |

### Rendered Sample:
```
🌅 Good morning! Your breakfast for 15 January 2025 is scheduled.

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

### Body Text:

```
☀️ Hello! Your lunch for {{1}} is on the way.

🍽️ Meal: {{2}} at {{3}}

{{4}} {{5}}

Please use the buttons below to manage your order.
```

### Variables:
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
| delivery_date | item_name | time_str | deadline_msg | expiry_notice |

### Sample Values:
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
| 15 January 2025 | Chicken Biryani | 12:30 | Please respond by 9:30am — changes close after that. | Your plan expires in 2 delivery days. |

### Rendered Sample:
```
☀️ Hello! Your lunch for 15 January 2025 is on the way.

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

### Body Text:

```
🌙 Good evening! Your dinner for {{1}} is scheduled.

🍽️ Meal: {{2}} at {{3}}

{{4}} {{5}}

Use the buttons below to confirm, change, or skip.
```

### Variables:
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
| delivery_date | item_name | time_str | deadline_msg | expiry_notice |

### Sample Values:
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
| 15 January 2025 | Dal Makhani with Roti | 19:30 | Please respond by 5pm — changes close after that. | Your plan expires in 2 delivery days. |

### Rendered Sample:
```
🌙 Good evening! Your dinner for 15 January 2025 is scheduled.

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

### Body Text:

```
⏭️ Hi there! The {{1}} you skipped earlier is now rescheduled for today.

🍽️ {{2}} {{1}}: {{3}}

Please let us know if you'd like to confirm, change, or skip this meal.
```

### Variables:
| {{1}} | {{2}} | {{3}} |
|-------|-------|-------|
| slot_label | slot_emoji | item_name |

### Sample Values:
| {{1}} | {{2}} | {{3}} |
|-------|-------|-------|
| Lunch | ☀️ | Chicken Biryani |

### Rendered Sample:
```
⏭️ Hi there! The Lunch you skipped earlier is now rescheduled for today.

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

### Body Text:

```
⏳ Hi! Your FitFuel {{1}} plan is ending soon.

You have only {{2}} delivery day(s) remaining. Don't let your healthy streak end — renew today to keep your meals coming! 🥗
```

### Variables:
| {{1}} | {{2}} |
|-------|-------|
| plan_label | threshold |

### Sample Values:
| {{1}} | {{2}} |
|-------|-------|
| Healthy Diet Non-Veg | 2 |

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

### Body Text:

```
Your FitFuel verification code is {{1}}. This code is valid for {{2}}.
```

### Variables:
| {{1}} | {{2}} |
|-------|-------|
| otp_code | validity |

### Sample Values:
| {{1}} | {{2}} |
|-------|-------|
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

### Body Text:

```
❌ We're sorry — your payment was {{1}}.

Unfortunately your FitFuel order could not be completed. Please reply to this message or contact us to start a new order whenever you're ready. We're here to help! 🙏
```

### Variables:
| {{1}} |
|-------|
| reason |

### Sample Values:
| {{1}} |
|-------|
| cancelled |

### Rendered Sample:
```
❌ We're sorry — your payment was cancelled.

Unfortunately your FitFuel order could not be completed. Please reply to this message or contact us to start a new order whenever you're ready. We're here to help! 🙏
```

---

## 9. Payment Confirmed (`payment_confirmed`)

**Category:** UTILITY | **Language:** en | **Buttons:** None

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
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
| plan_title | day_label | meal_label | amount | start_label |

### Sample Values:
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
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

### Body Text:

```
🔒 Kitchen Closed Notice — {{1}}

{{2}}

Our kitchen will be closed on {{1}}, so no meals will be delivered that day.

Good news: your plan has been extended by 1 day. You now have {{3}} delivery day(s) remaining.

We'll be back the next working day! 🙏
```

### Variables:
| {{1}} | {{2}} | {{3}} |
|-------|-------|-------|
| date | reason_line | remaining_days |

### Sample Values:
| {{1}} | {{2}} | {{3}} |
|-------|-------|-------|
| 26 January 2025 | Republic Day holiday | 5 |

### Rendered Sample:
```
🔒 Kitchen Closed Notice — 26 January 2025

Republic Day holiday

Our kitchen will be closed on 26 January 2025, so no meals will be delivered that day.

Good news: your plan has been extended by 1 day. You now have 5 delivery day(s) remaining.

We'll be back the next working day! 🙏
```

---

## Quick Reference Table

| Template | Variables | Buttons | Category |
|----------|-----------|---------|----------|
| breakfast_notification | 5 | 3 Quick Reply | UTILITY |
| lunch_notification | 5 | 3 Quick Reply | UTILITY |
| dinner_notification | 5 | 3 Quick Reply | UTILITY |
| rescheduled_meal | 3 | 3 Quick Reply | UTILITY |
| expiry_reminder | 2 | 2 Quick Reply | MARKETING |
| session_expired | 0 | None | UTILITY |
| otp_code | 2 | OTP (special) | AUTHENTICATION |
| payment_failed | 1 | None | UTILITY |
| payment_confirmed | 5 | None | UTILITY |
| kitchen_closed | 3 | None | UTILITY |

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