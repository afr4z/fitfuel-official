# WhatsApp Template Body Text (Copy-Paste Ready for Meta Business Manager)

---

## 1. Breakfast Notification (`breakfast_notification`)

**Category:** UTILITY | **Language:** en | **Buttons:** Quick Reply (3)

### Body Text (copy exactly):

```
🌅 *Tomorrow's Breakfast ({{1})*

{{2}} ({{3}})

{{4}}{{5}}
```

### Variables (in order):
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
| delivery_date | item_line | time_str | deadline_msg | expiry_notice |

### Sample Values:
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
| 15 Jan 2025 | 🌅 *Breakfast*: Idli Sambar | 08:00 | You can confirm, skip, or change until *10pm tonight*. | ⚠️ Your plan expires in *2* delivery day(s)! |

### Rendered Sample:
```
🌅 *Tomorrow's Breakfast (15 Jan 2025)*

🌅 *Breakfast*: Idli Sambar (08:00)

You can confirm, skip, or change until *10pm tonight*.⚠️ Your plan expires in *2* delivery day(s)!
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
☀️ *Today's Lunch ({{1})*

{{2}} ({{3}})

{{4}}{{5}}
```

### Variables:
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
| delivery_date | item_line | time_str | deadline_msg | expiry_notice |

### Sample Values:
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
| 15 Jan 2025 | ☀️ *Lunch*: Chicken Biryani | 12:30 | ⏰ Respond by *9:30am* — changes close after that. | ⚠️ Your plan expires in *2* delivery day(s)! |

### Rendered Sample:
```
☀️ *Today's Lunch (15 Jan 2025)*

☀️ *Lunch*: Chicken Biryani (12:30)

⏰ Respond by *9:30am* — changes close after that.⚠️ Your plan expires in *2* delivery day(s)!
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
🌙 *Today's Dinner ({{1})*

{{2}} ({{3}})

{{4}}{{5}}
```

### Variables:
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
| delivery_date | item_line | time_str | deadline_msg | expiry_notice |

### Sample Values:
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
| 15 Jan 2025 | 🌙 *Dinner*: Dal Makhani + Roti | 19:30 | ⏰ Respond by *5pm* — changes close after that. | ⚠️ Your plan expires in *2* delivery day(s)! |

### Rendered Sample:
```
🌙 *Today's Dinner (15 Jan 2025)*

🌙 *Dinner*: Dal Makhani + Roti (19:30)

⏰ Respond by *5pm* — changes close after that.⚠️ Your plan expires in *2* delivery day(s)!
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
⏭️ *Rescheduled {{1})*

You skipped this meal earlier — it's being delivered today.

{{2}} *{{1}}*: {{3}}
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
⏭️ *Rescheduled Lunch*

You skipped this meal earlier — it's being delivered today.

☀️ *Lunch*: Chicken Biryani
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
⏳ *Your FitFuel plan is almost over!*

Your *{{1}} plan* has only *{{2}} delivery day(s)* remaining.

Don't miss your healthy streak — renew now to keep your meals coming! 🥗
```

### Variables:
| {{1}} | {{2}} |
|-------|-------|
| plan_label | threshold |

### Sample Values:
| {{1}} | {{2}} |
|-------|-------|
| 🥗 Healthy Diet Non-Veg | 2 |

### Rendered Sample:
```
⏳ *Your FitFuel plan is almost over!*

Your *🥗 Healthy Diet Non-Veg plan* has only *2 delivery day(s)* remaining.

Don't miss your healthy streak — renew now to keep your meals coming! 🥗
```

### Buttons (Quick Reply):
1. 🔄 Renew Plan
2. 📞 Contact Us

---

## 6. Session Expired (`session_expired`)

**Category:** UTILITY | **Language:** en | **Buttons:** None

### Body Text:

```
⏰ *Your session expired due to inactivity.*

Type *hi* to start again!
```

### Variables: None

### Rendered Sample:
```
⏰ *Your session expired due to inactivity.*

Type *hi* to start again!
```

---

## 7. OTP Code (`otp_code`)

**Category:** AUTHENTICATION | **Language:** en | **Buttons:** OTP (not Quick Reply)

### Body Text:

```
Your FitFuel login code is: {{1}}. Valid for {{2}}.
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
Your FitFuel login code is: 482917. Valid for 5 minutes.
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
❌ *Payment {{1})*

Unfortunately your FitFuel order could not be completed.

Please send us a message to start a new order whenever you're ready. We're here to help! 🙏
```

### Variables:
| {{1}} |
|-------|
| reason |

### Sample Values:
| {{1}} |
|-------|
| Cancelled |

### Rendered Sample:
```
❌ *Payment Cancelled*

Unfortunately your FitFuel order could not be completed.

Please send us a message to start a new order whenever you're ready. We're here to help! 🙏
```

---

## 9. Payment Confirmed (`payment_confirmed`)

**Category:** UTILITY | **Language:** en | **Buttons:** None

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
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
| plan_title | day_label | meal_label | amount | start_label |

### Sample Values:
| {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|-------|-------|-------|-------|-------|
| 🥗 Healthy Diet Non-Veg | 7 Days | Lunch + Dinner | ₹1,540 | from 16 Jan 2025 |

### Rendered Sample:
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

**Category:** UTILITY | **Language:** en | **Buttons:** None

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
| {{1}} | {{2}} | {{3}} |
|-------|-------|-------|
| date | reason_line | remaining_days |

### Sample Values:
| {{1}} | {{2}} | {{3}} |
|-------|-------|-------|
| 26 Jan 2025 | Republic Day holiday | 5 |

### Rendered Sample:
```
🔒 *Kitchen Closed — 26 Jan 2025*
Republic Day holiday

We're sorry, our kitchen won't be operating on 26 Jan 2025. No meals will be delivered that day.

✅ Your plan has been extended by 1 day to make up for it.
📅 You now have *5 delivery day(s)* remaining.

We'll be back the next working day! 🙏
```

---

## Quick Reference Table

| Template | Variables Count | Buttons | Category |
|----------|-----------------|---------|----------|
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

## Meta Business Manager - Paste Instructions

For each template:
1. **Name:** Use exact name (e.g., `breakfast_notification`)
2. **Category:** As listed above
3. **Language:** English (en)
4. **Body:** Paste the "Body Text" section exactly as shown
5. **Variables:** Meta will auto-detect {{1}}, {{2}}, etc. - verify order matches table
6. **Buttons:** Add Quick Reply buttons as listed (or OTP for otp_code)
7. **Submit** for review