# FitFuel Admin Page — Task List

Plan: `tasks/plan.md`

Scope: replace the existing admin page, keep the current `ADMIN_SECRET` login,
add subscription visibility and cancellation. No roles, no cookie/session
rewrite, no POS or payment screens.

## Phase 1 — Replace the Page

- [ ] **Task 1: New admin shell**
  - Replace `public/admin.html` with a tabbed shell.
  - Keep the existing login screen: enter the admin secret, store it in
    `sessionStorage`, send `Authorization: Bearer <secret>`.
  - Add tabs: Weekly Menu, Tomorrow, Kitchen Closed, Subscriptions.
  - **Acceptance:** the current secret still logs in; all tabs load.
  - **Verification:** log in with the current secret, switch tabs, reload.

- [ ] **Task 2: Migrate menu tabs**
  - Move weekly schedule, tomorrow override, and kitchen-closed into the new
    layout.
  - Preserve validation and the 19:45 IST lock.
  - Weekly menu only lists dishes already synced from Petpooja.
  - **Acceptance:** existing menu workflows work as before; no dish create/edit
    controls exist.
  - **Verification:** edit a weekly slot, set a tomorrow override, mark a closed
    day in staging.

## Checkpoint: Page Replaced

- [ ] Old page is replaced.
- [ ] Same login still works.
- [ ] Menu and kitchen-closed workflows still work.
- [ ] No dish create/edit controls exist.

## Phase 2 — Subscription Visibility

- [ ] **Task 3: Subscription summary**
  - Add `GET /api/admin/subscriptions/summary`.
  - Show active subscriptions, active by plan, expiring in 2 days, cancelled
    this month, and today's meal counts by slot.
  - **Acceptance:** counts match direct Supabase queries.
  - **Verification:** compare API output with SQL for each count.

- [ ] **Task 4: Subscription list**
  - Add filters: active/expired/cancelled, plan, expiring soon, search by name or
    phone.
  - Add pagination and CSV export.
  - Show plan, duration, slots, start/end dates, remaining delivery days,
    status, and payment status.
  - **Acceptance:** filters combine correctly; remaining days exclude Sundays
    and kitchen-closed days.
  - **Verification:** test each filter and compare sample subscriptions with
    the existing delivery-day calculation.

- [ ] **Task 5: Subscription detail**
  - Show customer, address, plan, duration, remaining days, slots, payment
    status, Razorpay reference, order history, and cancellation details.
  - **Acceptance:** no cross-customer data leaks; data is read-only unless an
    action exists.
  - **Verification:** compare a known subscription with the database.

## Checkpoint: Visibility

- [ ] Admin can answer who is subscribed, to which plan, and for how many days.
- [ ] Expiring plans are visible.
- [ ] Subscription data can be exported.

## Phase 3 — Cancellation

- [ ] **Task 6: Cancellation backend**
  - No migration. Use the existing `status` column.
  - Set `status = 'cancelled'`; keep `start_date` and `end_date`.
  - Add `POST /api/admin/subscriptions/:id/cancel`.
  - Find the first undelivered meal.
  - Skip meals already sent to Petpooja.
  - If all of today's meals are already sent, start tomorrow.
  - Cancel future `pending` and `confirmed` orders.
  - Use the earliest cancelled order's `delivery_date` as the effective date.
  - Leave delivered orders untouched.
  - **Acceptance:** cancellation stops future order generation; delivered orders
    are untouched.
  - **Verification:** cancel a test subscription and run the order commit job.

- [ ] **Task 7: Cancellation UI**
  - Add a confirmation dialog showing the effective date.
  - Show warning if an order was already sent to Petpooja.
  - Show “refund handled in Razorpay” note.
  - **Acceptance:** cancellation requires confirmation and shows the first
    cancelled date.
  - **Verification:** cancel in staging.

- [ ] **Task 8: Customer notification**
  - Add a WhatsApp cancellation message/template.
  - Send only after cancellation is confirmed.
  - **Acceptance:** customer receives the correct plan and effective date.
  - **Verification:** test with an internal number.

## Checkpoint: Cancellation

- [ ] Cancellation is safe and recorded.
- [ ] Future orders stop from the next undelivered meal.
- [ ] Dispatched orders are flagged for manual Petpooja cancellation.
- [ ] Customer is notified.

## Notes

- Keep the current auth mechanism exactly as-is.
- No cookie/session rewrite.
- No roles.
- No dish management in admin.
- No POS status or payment/refund screens.
