# Implementation Plan: FitFuel Admin Page

## Overview

Replace the existing `/admin` page with a cleaner admin for the owner and
restaurant staff.

The admin has two jobs:

1. **Menu operations** — weekly menu, tomorrow's menu, kitchen-closed days.
2. **Subscriptions** — who is subscribed, which plan, how many days remain,
   and cancel a plan.

Keep the current auth mechanism: one shared `ADMIN_SECRET` entered on the login
screen and sent as a bearer token. No roles and no new auth system for now.

Petpooja remains the source of truth for dishes. Admin only selects dishes that
are already synced into the database.

## What Exists Today

### Admin page

`public/admin.html` at `/admin` currently has:

- Weekly menu schedule
- Tomorrow's menu overrides
- Kitchen-closed days

### Admin API

`api/admin.js` currently has:

- `GET/POST /api/admin/plan-defaults`
- `GET/POST /api/admin/kitchen-closed`

### Auth

- One shared `ADMIN_SECRET`
- Stored in `sessionStorage`
- Sent as `Authorization: Bearer <secret>`

**Decision: keep this for now.** Do not rebuild auth, add admin users, or add
roles. Just replace the page and add subscription operations behind the same
login.

### Subscription data

`meal_plan_subscriptions` already has:

- Customer and phone
- Plan
- Duration: `3day`, `weekly`, `biweekly`, `monthly`
- Status: `active`, `expired`, `cancelled`
- Start/end dates
- Payment status and Razorpay references
- Delivery address

`subscription_slots` stores breakfast/lunch/dinner.

`orders` stores generated meals.

### Missing

- No consolidated subscription list
- No subscription detail view
- No cancellation flow
- No admin subscription API
- No customer cancellation notification

## Scope

### In scope

1. Replace `public/admin.html` with the new admin layout
2. Keep the current `ADMIN_SECRET` login
3. Keep weekly menu, tomorrow override, and kitchen-closed workflows
4. Subscription summary, list, filters, search, CSV export
5. Subscription detail with plan, days, slots, address, payment reference,
   order history
6. Cancel a subscription from the next undelivered meal
7. Notify the customer on WhatsApp
8. Menu picker uses only existing Petpooja-synced dishes

### Out of scope

- Roles and multiple permission levels
- New auth/session system
- POS order status or retry/cancel
- Payment/refund processing
- Adding/editing dishes
- Reports and revenue analytics
- Customer CRM
- Coupons, riders, broadcasts, multi-outlet

## Access

- One shared admin login using the existing `ADMIN_SECRET`.
- Everyone with that secret has full access.
- Keep the existing bearer-token check in `api/admin.js`.
- Do not introduce `admin_users`, admin sessions, or role checks.

## Admin Page

Replace the current page with a simple tabbed layout:

- **Weekly Menu** — plan × Mon–Sat × breakfast/lunch/dinner
- **Tomorrow** — date-specific overrides, locked after 19:45 IST
- **Kitchen Closed** — mark closed and extend subscriptions
- **Subscriptions** — summary, filters, list, detail, cancel

The page can stay in `public/admin.html` for now, but split the JavaScript into
smaller functions if it becomes hard to maintain. Do not add a build step.

## Menu

### Weekly menu

Keep the existing behavior:

- Select plan, day, slot
- Choose an existing dish
- Save to `weekly_meal_schedule`

### Dish source of truth

- Petpooja sync owns `dishes`.
- Admin never creates, edits, prices, or deletes dishes.
- Only synced/available dishes are selectable.
- If a dish is missing, fix it in Petpooja and rerun the sync.
- Show a clear empty state if no synced dishes are available.

### Tomorrow

Keep the existing override behavior and 19:45 IST lock.

### Kitchen closed

Keep the existing workflow:

- Mark date closed
- Extend active subscriptions
- Notify customers

## Subscriptions

### Summary

Show:

- Active subscriptions
- Active by plan
- Expiring in the next 2 days
- Cancelled this month
- Today's meal counts by slot

### List

Columns:

- Customer name and phone
- Plan
- Duration
- Meals per day / slots
- Start date
- End date
- Remaining delivery days
- Status
- Payment status
- Actions

Filters:

- Active / expired / cancelled
- Plan
- Expiring soon
- Search by name or phone

Remaining days use the existing delivery-day calculation, excluding Sundays
and kitchen-closed days.

### Detail

Show:

- Customer and delivery address
- Plan and duration
- Start/end dates
- Remaining delivery days
- Slots and delivery times
- Payment status and Razorpay reference
- Order history
- Cancellation details

### Cancellation

Cancellation starts from the **first undelivered meal**.

Rule:

1. Find the first order that has not been delivered.
2. If that order was already sent to Petpooja, skip it and use the next one.
3. If all of today's meals were already sent, start tomorrow.
4. Set subscription status to `cancelled`.
5. Keep the original `start_date` and `end_date` for history.
6. Cancel future local orders that are still `pending` or `confirmed`.
7. Use the earliest cancelled order's `delivery_date` as the effective date.
8. Leave delivered orders alone.
9. If an order is `sent_to_kitchen`, `accepted`, or `ready`, warn the admin to
   cancel it in Petpooja too.
10. Do not refund automatically. Refunds stay in Razorpay.
11. Send the customer a WhatsApp cancellation message.

## Data Changes

**None for the first version.**

The existing `meal_plan_subscriptions.status` column already supports:

- `active`
- `expired`
- `cancelled`

That is enough to distinguish a cancelled plan from an expired one.

Cancellation will use existing fields:

- Set `status = 'cancelled'`
- Keep the original `start_date` and `end_date` for history
- Cancel future rows in `orders` with `status = 'cancelled'`
- Use the earliest cancelled order's `delivery_date` as the effective date

No migration is required.

If you later want to store *why* a plan was cancelled, we can add one optional
`cancel_reason` column. It is not needed for the first version.

No new auth tables, roles tables, or payments tables.

## API Additions

Keep the existing auth check in `api/admin.js`.

### Subscriptions

- `GET /api/admin/subscriptions?status=&plan=&q=&expiring=&page=`
- `GET /api/admin/subscriptions/:id`
- `POST /api/admin/subscriptions/:id/cancel`
- `GET /api/admin/subscriptions/summary`
- `GET /api/admin/subscriptions/export`

### Existing menu endpoints

- `GET/POST /api/admin/plan-defaults`
- `GET/POST /api/admin/kitchen-closed`

## UI Behavior

- Use the existing login screen and `sessionStorage` token.
- On 401, clear the token and show the login screen.
- Keep the same `Authorization: Bearer` header on every admin request.
- Add a Subscriptions tab.
- Make the layout usable on a phone for restaurant staff.
- Use the existing design tokens from `public/css/main.css`.

## Task List

### Phase 1 — Replace the page

- [ ] **Task 1: New admin shell**
  - Replace the current `public/admin.html` layout with a tabbed shell.
  - Keep the existing `ADMIN_SECRET` login and bearer auth.
  - Add tabs: Weekly Menu, Tomorrow, Kitchen Closed, Subscriptions.
  - **Acceptance:** login still works; existing menu tabs load.
  - **Verification:** login with the current secret, switch tabs, reload.

- [ ] **Task 2: Migrate menu tabs**
  - Move weekly, tomorrow, and kitchen-closed into the new layout.
  - Preserve validation and the 19:45 lock.
  - Menu picker only shows synced dishes.
  - **Acceptance:** existing menu workflows work as before.
  - **Verification:** edit a weekly slot, set a tomorrow override, mark a closed
    day in staging.

### Checkpoint: Page replaced

- [ ] The old page is replaced.
- [ ] The same login still works.
- [ ] Menu and kitchen-closed workflows still work.
- [ ] No dish create/edit controls exist.

### Phase 2 — Subscription visibility

- [ ] **Task 3: Subscription summary**
  - Add `GET /api/admin/subscriptions/summary`.
  - Show active by plan, expiring soon, cancelled this month.
  - **Acceptance:** counts match Supabase.
  - **Verification:** compare API output with SQL.

- [ ] **Task 4: Subscription list**
  - Add filters, search, pagination, remaining days, CSV export.
  - **Acceptance:** filters combine correctly; remaining days exclude Sundays
    and kitchen-closed days.
  - **Verification:** test each filter and compare sample subscriptions.

- [ ] **Task 5: Subscription detail**
  - Show customer, plan, duration, slots, address, payment reference, order
    history, cancellation details.
  - **Acceptance:** no cross-customer data leaks.
  - **Verification:** compare a known subscription with the database.

### Checkpoint: Visibility

- [ ] Admin can answer who is subscribed, to which plan, and for how many days.
- [ ] Expiring plans are visible.
- [ ] Subscription data can be exported.

### Phase 3 — Cancellation

- [ ] **Task 6: Cancellation backend**
  - Add cancellation columns.
  - Add `POST /api/admin/subscriptions/:id/cancel`.
  - Find the next undelivered meal.
  - Cancel future undelivered local orders.
  - Warn for already-dispatched Petpooja orders.
  - **Acceptance:** cancellation stops future order generation; delivered orders
    are untouched.
  - **Verification:** cancel a test subscription and run the order commit job.

- [ ] **Task 7: Cancellation UI**
  - Add confirmation dialog with effective date and reason.
  - Show warning for already-dispatched orders.
  - Show “refund handled in Razorpay” note.
  - **Acceptance:** cancel flow is clear and requires confirmation.
  - **Verification:** cancel in staging.

- [ ] **Task 8: Customer notification**
  - Add a WhatsApp cancellation template.
  - Send only after confirmation.
  - **Acceptance:** customer receives the correct plan/date message.
  - **Verification:** test with an internal number.

### Checkpoint: Cancellation

- [ ] Cancellation is safe and auditable.
- [ ] Future orders stop from the next undelivered meal.
- [ ] Dispatched orders are flagged for manual Petpooja cancellation.
- [ ] Customer is notified.

## Notes

- Keep the existing auth exactly as it is for now.
- Do not add roles.
- Do not add dish management.
- Do not add POS or payment screens.
- The admin is internal; speed matters more than a new framework.
