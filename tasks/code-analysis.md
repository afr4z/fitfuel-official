# FitFuel Code Analysis

**Date:** 2026-10-27  
**Codebase HEAD:** `a5f004a` (`random bugfizes and admin stuff`)  
**Scope:** tracked JavaScript, API routes, bot handlers, cron jobs, admin/public UI, SQL/schema files, docs, and build/deploy config.  
**Method:** static import/export analysis, route tracing, date/time review, security review, dead-code scan, HTML/CSS reference checks, `node --check`, inline-script parsing, and Prettier checks. No production data was changed.

> **Status note:** the safe cleanup items in this report were applied on 2026-10-27.
> See §11 for the exact list. The findings and line references above remain the
> evidence for the work that is still open (security, payments, bot data, tests).

---

## Executive summary

The application is functional, but it has three kinds of debt:

1. **Security/reliability gaps around authentication and payment state** — several secrets fail open when an environment variable is missing, the WhatsApp webhook does not verify Meta's signature, and pending checkout state is keyed only by phone.
2. **Data-integrity risks** — payment webhooks can partially create a subscription, meal changes can write an item that was never in the menu, kitchen-closed handling can extend the wrong subscriptions, and several paths use UTC dates during IST early-morning hours.
3. **Dead/stale code and documentation** — unused exports, unused imports, unreachable bot states, a dead duplicated menu handler, stale README/audit/template docs, and a large amount of inline CSS/JS duplicated across pages.

The most important single correction is to **fail closed when secrets are absent** and to **decouple pending checkout state from the generic bot session**.

### Priority order

| Priority | Area                                                                      | Why                                                           |
| -------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| P0       | Fail-closed secrets, WhatsApp webhook signature                           | Prevents unauthenticated admin/cron/payment actions           |
| P0       | Checkout/payment session design                                           | Prevents lost payments or creating the wrong plan             |
| P1       | Meal-change validation, SKIP error handling, transactional payment writes | Prevents wrong/invalid meal data and incomplete subscriptions |
| P1       | IST date consistency, kitchen-closed filtering, order uniqueness          | Prevents wrong active/expired states and duplicate orders     |
| P2       | Dead-code cleanup, docs, admin CSS extraction                             | Reduces maintenance cost and prevents misleading future work  |
| P2       | Tests, lint, CI                                                           | Prevents regressions; currently none exist                    |

---

## 1. Exact menu-confirmation sender

There are two different “menu” messages. The exact file depends on which one is meant.

### A. The meal notification that asks the customer to confirm the dish

**File:** `lib/notifySlot.js`

The flow is:

1. `api/cron/notify.js` calls `notifySlot(slot)` — once per slot; the legacy
   `/api/cron/notify-{breakfast,lunch,dinner}` paths rewrite to it.
2. `lib/notifySlot.js` calls `ensureOrder(...)` to create/load the order (`lib/notifySlot.js:106-119`).
3. It builds the dish line and deadline text (`lib/notifySlot.js:121-156`).
4. It sends the WhatsApp message through `sendNotification(...)` with the fallback buttons:

   - `CONFIRM_<orderId>`
   - `CHANGE_<orderId>`
   - `SKIP_<orderId>`

   See `lib/notifySlot.js:149-177`.

5. The actual WhatsApp template name is selected by `TEMPLATE_NAMES` (`lib/notifySlot.js:31-36`), defaulting to `breakfast_notification`, `lunch_notification`, or `dinner_notification`.

**Schedules:** `vercel.json:126-136`  
**Template fallback logic:** `lib/sendNotification.js` → `lib/whatsapp.js` `sendWithTemplateFallback`

So, if “the menu for item confirmation” means the message that shows the selected dish and asks Confirm/Change/Skip, the answer is **`lib/notifySlot.js`**, triggered by the three `api/cron/notify-*.js` files.

### B. The dish list sent after the customer taps “Change”

**File:** `bot/handlers/orders.js`

The live flow is:

1. `handleOrderAction` handles a `CHANGE_<orderId>` action.
2. It verifies the order belongs to the sender and is still changeable.
3. It loads the plan/slot dishes with `getMenuItems({ mealPlanId, slot })`.
4. It sends a WhatsApp list using `CHANGE_MEAL_LIST` (`bot/handlers/orders.js:170-216`).
5. The customer's `MEAL_<orderId>_<dishId>` selection is applied by `handleMealChange` (`bot/handlers/orders.js:224-309`).

### Dead duplicate path

`bot/handler.js:259-316` contains a second implementation of the same change-menu flow under `STATES.SELECTING_MEAL_SLOT`. No code writes that state; a repository-wide search finds only the handler's `case` statements and the state definition. That branch is **dead code** and should not be mistaken for the live path.

---

## 2. Security findings

| Severity | Finding                                                                     | Evidence                                                                                                                           | Impact                                                                                                                | Recommendation                                                                              |
| -------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **P0**   | Admin API fails open when `ADMIN_SECRET` is unset                           | `api/admin.js:560-566` only checks auth inside `if (adminSecret)`                                                                  | Anyone can read/cancel subscriptions and edit menus if the env var is missing                                         | Return `500`/`503` when the secret is not configured; never expose an unauthenticated admin |
| **P0**   | Cron endpoints fail open when `CRON_SECRET` is unset                        | `api/cron/commit-meals.js:17-19`, `expiry-reminder.js:31-37`, `session-expiry.js` (`api/cron/notify.js` now fails closed)          | Anyone can trigger order creation, expiry jobs, session notices                                                       | Fail closed if `CRON_SECRET` is missing; compare with `safeEqualStrings`                    |
| **P0**   | Razorpay signature verification fails open when the webhook secret is unset | `api/razorpay-webhook.js:88-90` returns `true` if `secret` is falsy                                                                | Forged payment events can create subscriptions                                                                        | Return `false`/`500` when unset; verify the raw request body                                |
| **P0**   | WhatsApp POST webhook is not signature-verified                             | `api/webhook.js:17-45` verifies only the GET `hub.verify_token`; POST bodies are accepted directly                                 | Anyone who can reach the URL can inject fake messages, trigger bot actions, and generate WhatsApp traffic             | Verify `X-Hub-Signature-256` with the Meta app secret over the raw request body             |
| **P1**   | Pending checkout is keyed only by phone                                     | `api/web-order.js` stores the pending purchase in `session:${phone}`; `api/razorpay-webhook.js:232-248` resolves it by phone alone | A new payment link/bot flow overwrites the old one; paying an older link can create the wrong plan or be ignored      | Store pending purchases under a unique reference/payment-link ID, not the phone session     |
| **P1**   | Payment failure clears the pending session                                  | `api/razorpay-webhook.js` `handleFailure` calls `clearSession(rawPhone)` for failed/cancelled/expired links                        | A customer who retries the same link after a failure may pay with no pending plan; payment is taken but not fulfilled | Keep pending data until expiry; clear only after explicit abandonment                       |
| **P1**   | OTP is written to logs in plaintext                                         | `api/auth.js:461` logs `{ to, templateName, otp }`                                                                                 | Anyone with log access can take over a phone login                                                                    | Remove the OTP value; log only a correlation ID                                             |
| **P1**   | Magic login token is written to logs                                        | `api/razorpay-webhook.js:590-592` logs the token                                                                                   | Log access becomes account access                                                                                     | Never log the token                                                                         |
| **P2**   | No IP/global OTP rate limit                                                 | `api/auth.js` limits per phone (`5/day`, cooldown, attempts) but not per IP or globally                                            | Attackers can rotate phone numbers to consume WhatsApp/SMS spend                                                      | Add IP/global rate limits or a queue                                                        |
| **P2**   | No CSP/HSTS/security headers                                                | `vercel.json` only sets cache headers                                                                                              | No defense-in-depth against XSS/clickjacking                                                                          | Add CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, frame policy                    |
| **P2**   | Admin secret is in `sessionStorage`                                         | `public/admin.html` `getToken()`/`login()`                                                                                         | Any XSS on the admin origin can exfiltrate the secret                                                                 | This is an accepted requirement; keep the page XSS-free and add CSP as compensating control |

> Note: the existing `safeEqualStrings` helper is good. Use it for cron checks too; the cron routes currently use plain `!==`.

---

## 3. Correctness and data-integrity findings

### 3.1 Payment webhook can leave partial subscriptions

`api/razorpay-webhook.js:325-360` inserts the subscription, then later inserts `subscription_slots`. If the slot insert fails, the code logs the error but the subscription already exists, and the webhook still clears the session and sends a success message. The customer gets a plan with no delivery slots.

**Recommendation:** perform subscription + slots + initial order creation in a single Postgres RPC/transaction, or return `500` on slot failure and let Razorpay retry.

### 3.2 Meal change accepts an item ID without checking it exists in the plan

`bot/handlers/orders.js:264-298` fetches menu items, but if `items.find(...)` returns nothing it still updates the order with:

- `item_id: itemId`
- `item_name: "Selected meal"`

The item ID comes from the customer's list reply. A stale menu, a changed menu, or a crafted reply can therefore write a non-menu item ID. The code should reject when the item is not found in the fetched plan/slot list.

### 3.3 SKIP tells the customer the meal moved even if the insert failed

`bot/handlers/orders.js:141-166`:

- computes `pushedDate`
- inserts the pushed order
- ignores the insert result
- sends `skipPushed` whenever `pushedDate` is set

If the insert fails, the meal is marked skipped, the customer is told it moved, and no replacement order exists.

**Recommendation:** check the insert error, only send the pushed message on success, and include the insert failure in the response.

### 3.4 UTC dates used where IST is intended

The codebase has IST helpers in `lib/cronUtils.js` (`todayDateStrIST`, `tomorrowDateStrIST`, `toDateStr`) and `api/admin.js` (`todayDateStrIST`), but several paths still use `new Date().toISOString().split("T")[0]`:

- `api/auth.js:273,284,298` — active subscriptions, upcoming meals
- `bot/handlers/greeting.js:17` — active subscription check
- `bot/handlers/menu.js:42` — “My Plan” active check
- `bot/handlers/subscription.js:82` — active-plan guard
- `api/web-order.js:88` — double-subscription guard
- `api/admin.js:613` — kitchen-closed list “today”
- `api/cron/commit-meals.js:38-45` — expiry cutoff
- `api/cron/expiry-reminder.js:39` — reminder date

Between **00:00 and 05:29 IST**, UTC is still the previous date. This can show an ended plan as active, include yesterday's meals, or allow a new purchase while an old plan is still active. Centralize on the IST helper and remove the local copies.

### 3.5 Kitchen-closed extension selects the wrong subscriptions

`api/admin.js:654-676` extends every active subscription with `end_date >= closedDate`, without checking `start_date <= closedDate`. A plan that starts after the closed date is still extended. It also:

- allows a past date via the API (the UI has `min`, but the API does not enforce it)
- does not skip Sundays (Sunday is already a non-delivery day)
- does not cancel/skip pending orders already created for that date
- is not transactional; partial failures leave some plans extended and some not

**Recommendation:** filter `start_date <= date AND end_date >= date`, reject past dates, skip Sundays, and handle existing orders for that date.

### 3.6 Order creation has a check-then-insert race and no unique constraint in tracked schema

`lib/cronUtils.js` `ensureOrder`/`commitOrders` checks for an existing order before inserting. `supabase/migration.sql:249-271` defines indexes but **no unique constraint on `(slot_id, delivery_date)`** (or `(subscription_id, delivery_date, slot)`). If the cron runs concurrently or a webhook retries at the wrong time, duplicate orders are possible.

**Recommendation:** add a unique index/constraint and use `upsert` with `onConflict`. Verify the live database first; `database_current.sql` is ignored and not authoritative.

### 3.7 Admin CSV export may silently truncate

`api/admin.js:495-502` sets `.range(0, 4999)`. Supabase/PostgREST projects commonly cap responses at 1000 rows (`Max Rows` setting), so `.range(0,4999)` can still return only 1000 rows. The export then looks successful but is incomplete.

**Recommendation:** paginate until exhausted, stream rows, or perform the export in a background job.

### 3.8 Plan cache never invalidates

**Fixed.** `lib/mealPlans.js` no longer keeps a module-level plan cache, so admin
price edits take effect on the next request. `/api/plans` is also served with
`Cache-Control: no-store` while pricing remains editable.

### 3.9 `notified_at` is written before the WhatsApp send succeeds

`lib/notifySlot.js:116-119` updates `notified_at` before calling `sendNotification` (lines 149-177). If WhatsApp rejects the message, the order looks notified and is unlikely to be retried.

**Recommendation:** write `notified_at` after a successful send, or add a `notification_status`/retry counter and make the cron idempotent.

### 3.10 Pushed-order notifications are not deduplicated

The pushed-order loop in `lib/notifySlot.js` selects pending orders beyond the subscription end date, but does not filter on `notified_at`. A cron retry/manual run can send the same “rescheduled meal” notification again.

### 3.11 Idle-session tracking uses the wrong timestamp

`bot/session.js`:

- `setSession` writes `lastActivityAt` and updates the activity sorted set.
- `updateUserActivity` writes only `lastUserMessageAt`.
- `isExpired` checks `lastActivityAt`, not `lastUserMessageAt`.
- `findExpiredSessions` reads the sorted-set score, which `updateUserActivity` does not update.

A customer who stays in an onboarding state and keeps interacting without a state transition can be treated as idle and expired. Also, `getSession` deletes expired session keys but does not remove the member from the activity set, so the set accumulates stale entries.

**Recommendation:** make `updateUserActivity` update `lastActivityAt` and the sorted-set score, or make `isExpired` use the maximum of both timestamps; remove the activity-set member when deleting an expired session.

### 3.12 Cancellation is not transactional

`api/admin.js:426-452` cancels future orders first, then marks the subscription cancelled. If the subscription update fails, the customer's meals are cancelled but the plan remains active. Use a transaction/RPC for the order + subscription updates.

### 3.13 Admin plan-default writes lack validation

`api/admin.js:723+` validates `slot`/`day_of_week` but does not validate that `plan_id`/`dish_id` are UUIDs or that `date` is a valid date. Database foreign keys catch most bad IDs, but malformed dates and stale IDs produce 500s instead of 400s. Add explicit validation.

### 3.14 WhatsApp list-row limits

`getMenuItems` defaults to 10 rows (`lib/petpooja.js`), which matches WhatsApp's list-row cap. Saved addresses in `handleAddressChoice` are not capped; a customer with more than 9 saved addresses plus “Other” can exceed the 10-row limit and cause the send to fail. Cap/paginate addresses.

---

## 4. Dead and unused code

These are candidates confirmed by repository-wide reference search. Before deleting, confirm that an external VPS script does not import them (Petpooja sync/dispatch scripts are not in this repo).

### 4.1 Safe cleanup candidates

| File                        | Dead item                                                                          | Evidence                                            |
| --------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| `lib/env.js`                | Entire file; `validateEnv` is never called                                         | No imports of `lib/env.js`; no `validateEnv()` call |
| `lib/sendNotification.js`   | `sendSimpleNotification`                                                           | Only defined, never imported                        |
| `lib/sendNotification.js`   | `sendButtons`, `sendText` imports                                                  | Not used in the file                                |
| `lib/whatsapp.js`           | `markAsRead`                                                                       | Only mentioned in `README.md`; no code call         |
| `lib/petpooja.js`           | `getCategories`                                                                    | No import/call in repo                              |
| `lib/mealPlans.js`          | `getPlanByTag`                                                                     | No import/call in repo                              |
| `bot/session.js`            | `deleteSession`                                                                    | Duplicate of `clearSession`; no callers             |
| `bot/session.js`            | `markSessionExpired`                                                               | No callers                                          |
| `bot/states.js`             | `MEAL_PLAN_INFO`, `SELECTING_SLOTS`, `ORDER_PLACED`, `ACTIVE_PLAN`                 | Only definitions; never set/read                    |
| `bot/states.js`             | `SELECTING_MEAL_SLOT`                                                              | Only used in dead `bot/handler.js` branches         |
| `bot/handler.js`            | `SELECTING_MEAL_SLOT` branch (lines 259-316)                                       | No writer for the state                             |
| `bot/handler.js`            | `getMenuItems`, `sendList`, `supabase`, `MENU_UNAVAILABLE`, `CHANGE_MEAL_LIST_ALT` | Used only in the dead branch                        |
| `api/auth.js`               | `sendText`, `sendNotification` imports                                             | Unused (`api/auth.js:3-4`)                          |
| `api/razorpay-webhook.js`   | `sendText` import                                                                  | Unused (`:3`)                                       |
| `api/razorpay-webhook.js`   | `supabaseAuth` client                                                              | Duplicate unused client (`:27-30`)                  |
| `package.json`              | `dotenv` dependency                                                                | No import in repo                                   |
| `package.json`              | `supabase` CLI                                                                     | No npm script references it; verify manual usage    |
| `public/js/nav.js`          | `/single-meals` link                                                               | No `single-meals` page or rewrite                   |
| `public/bot-messages.html`  | Unlinked static page                                                               | No page links to it; duplicates `bot-messages.md`   |
| `public/admin.html`         | Inline `<style>` block                                                             | Moved to `public/css/admin.css` in this pass        |

### 4.2 Stale documentation / misleading files

| File                                      | Problem                                                                                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                               | Describes a single-file bot, a `handleIncomingMessage` function, `markAsRead`, and only three env vars. The actual app is multi-file and uses many more env vars. |
| `docs/audit.md`                           | Last refreshed 2026-09-24; several findings are fixed or stale (Google Fonts, cache headers, admin routing).                                                      |
| `templates.md`                            | Rescheduled template says 3 body params; `lib/notifySlot.js` sends 4 (slot label, emoji, item, date). Missing `subscription_cancelled`.                           |
| `templates-body.md`                       | Correct 4-param rescheduled template, but also missing `subscription_cancelled`.                                                                                  |
| `DB_SCHEMA.md`                            | Says to run `supabase/migration.sql`, which drops all tables/data. Fine for a dev reset; dangerous as general setup.                                              |
| `PETPOOJA_MENU_SETUP.md` / `DB_SCHEMA.md` | Refer to `sync.js`, `sync-plans.js`, `dispatch-orders.js`; those files are not in this repo.                                                                      |
| `database_current.sql`                    | Ignored local dump; stale relative to the migrations. Not tracked.                                                                                                |

### 4.3 Template mismatch to fix

`api/admin.js:463-472` sends `subscription_cancelled` with two body parameters:

1. plan label
2. effective cancellation date

That template is not documented in `templates.md` or `templates-body.md`, and may not exist in Meta. Until it exists and is approved, cancellation still succeeds but the notification may fail outside the 24-hour customer-service window. Set `WHATSAPP_CANCELLED_TEMPLATE` to an approved template or create `subscription_cancelled`.

---

## 5. Duplication and architecture

| Duplication              | Where                                                                                                                                       | Suggested consolidation                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Plan serialization       | `lib/mealPlans.js` and `api/public.js` both map `meal_plans` to the same shape                                                              | Move to one `serializePlan()` helper used by both                               |
| Supabase client creation | 15+ files each call `createClient(...)`                                                                                                     | Shared `lib/supabase.js` is optional (Vercel caches modules), but reduces drift |
| IST date helpers         | `lib/cronUtils.js`, `api/admin.js`, `lib/deliveryDays.js`, bot handlers                                                                     | Export `todayIST()`/`tomorrowIST()` from `lib/time.js` or `lib/cronUtils.js`    |
| Change-menu logic        | Live `bot/handlers/orders.js` and dead `bot/handler.js` branch                                                                              | Delete the dead branch; keep one helper                                         |
| Session storage          | `api/auth.js` uses raw Upstash REST; `bot/session.js` uses `@upstash/redis`                                                                 | Keep namespaces separate but share a small Redis helper if desired              |
| Page CSS/JS              | `index.html` 797 CSS lines, `order.html` 498, `dashboard.html` 339, `login.html` 242, `payment-success.html` 211, `admin.html` formerly 665 | Shared component CSS in `main.css`/`admin.css`, page-specific rules only        |
| Admin design tokens      | Admin had its own cream/forest palette                                                                                                      | Now aliases main-site tokens in `public/css/admin.css`; keep it that way        |

### Current inline asset footprint (before admin extraction)

| Page                          | Inline CSS lines | Inline JS lines |
| ----------------------------- | ---------------: | --------------: |
| `public/admin.html`           |              665 |             698 |
| `public/bot-messages.html`    |              117 |               0 |
| `public/dashboard.html`       |              339 |             362 |
| `public/index.html`           |              797 |              67 |
| `public/login.html`           |              242 |             182 |
| `public/order.html`           |              498 |             671 |
| `public/payment-success.html` |              211 |              51 |
| `public/privacy-policy.html`  |              138 |               5 |

Admin CSS has now been extracted to `public/css/admin.css`; the other pages still carry page-local CSS. This is not automatically “garbage” (some is page-specific), but it is a large surface for drift.

---

## 6. Performance and operational issues

1. **N+1 delivery-day queries** — `countRemainingDeliveryDays` queries `kitchen_closed_days` on every call. It is called per subscription in:

   - `lib/notifySlot.js` (inside `Promise.allSettled`)
   - `api/cron/expiry-reminder.js` (sequential `for` loop)
   - `bot/handlers/greeting.js` / `menu.js`
   - `api/admin.js` detail/summary loops

   For N subscribers this becomes N extra queries. Load closed days once per cron run and pass them into a pure counter.

2. **Order creation loops** — `lib/cronUtils.js` `autoFillNextDay` and `commitOrders` issue queries per plan/slot/subscription. At current volume this is fine; at scale it can approach the function timeout. Batch/upsert where possible.

3. **`Promise.allSettled` over all subscribers** — `notifySlot` sends all notifications concurrently. This can hit WhatsApp throughput/rate limits. Add bounded concurrency (e.g. 5–10 at a time).

4. **Unhashed assets with `immutable` caching** — `vercel.json:5-19` sets `Cache-Control: public, max-age=31536000, immutable` for `/css/*` and `/js/*`, but filenames are not content-hashed. After a deploy, browsers may keep old CSS/JS for up to a year. Use `must-revalidate`/short max-age or hashed filenames.

5. **Expiry-reminder schedule mismatch** — `vercel.json:138` runs `0 8 * * *` UTC = **13:30 IST**. `templates.md` says 8 AM IST; `DB_SCHEMA.md` correctly says 1:30 PM. Decide the intended time and align docs.

6. **No pagination on bulk queries** — active subscriptions/orders are fetched without pagination. Supabase's default `Max Rows` (often 1000) can silently cap cron/admin operations.

7. **`npm run dev` is broken locally** — `package.json` uses `vercel dev --local`, which fails with “`vercel dev` must not recursively invoke itself.” Use `vercel dev` or a different local command.

---

## 7. Admin UI/design consistency

The admin now follows the main-site design system:

- `public/admin.html` loads `/css/main.css` and `/css/admin.css`.
- `public/css/admin.css` aliases the main tokens:
  - `--leaf`, `--green-500`, `--orange-500`, `--gray-*`
  - `--font-display` (Archivo) and `--font` (Inter)
  - `--radius-lg`, `--shadow-sm`, `--shadow-md`
- The wordmark uses the same `Fit<span class="wordmark-accent">Fuel</span>` treatment with an `ADMIN` sublabel.
- Buttons, pills, badges, cards, inputs, bottom tabs, toast, and login sheet use the same green/orange/gray system.
- `public/admin.html` dropped from 1,382 lines to 719 lines; CSS is now a separate 748-line `public/css/admin.css`.

Remaining design debt:

- `public/bot-messages.html` still has its own 117-line palette and no shared nav; decide whether it is an internal doc or remove it.
- `public/index.html`, `order.html`, `dashboard.html`, `login.html`, and `payment-success.html` still have large page-local `<style>` blocks. Consolidate only the repeated primitives (buttons, inputs, cards, typography) rather than forcing everything into `main.css`.
- No favicon across pages; still 404. Add a small SVG favicon if desired.
- `/single-meals` remains a dead link in `public/js/nav.js`.

---

## 8. Tooling and quality gates

Current `package.json` scripts:

- `dev`: `vercel dev --local` (broken)
- `format`: `prettier --write`

Missing:

- `test`
- `lint`
- `typecheck` (no TypeScript)
- CI workflow
- Environment validation (`lib/env.js` exists but is not wired in)

Recommended minimum:

1. Add `npm run lint` (ESLint) and `npm run test` (Node's built-in test runner or Vitest).
2. Add a smoke test for:
   - admin auth 401/200
   - cancellation date selection
   - payment webhook idempotency
   - `countRemainingDeliveryDays` with Sundays/closed days
3. Wire `validateEnv()` into API entrypoints or Vercel build, and fail closed.
4. Add a CI job for `node --check`, Prettier, and tests.

---

## 9. Verified checks performed

- No missing relative JavaScript imports found in tracked JS.
- `node --check` passes for all tracked `.js` files.
- Inline admin script parses successfully (`public/admin.html`).
- Prettier passes for `public/admin.html` and `public/css/admin.css`.
- Admin page renders in headless Chromium at 390×900 and 1280×1000 with main-site typography, green/orange palette, wordmark, and bottom tabs.
- Production deployment `a04884b` is Ready; `/admin` serves the new `main.css` + `admin.css` links.
- Production `/api/admin/subscriptions/summary` without an auth header returns `401 {"error":"Unauthorized"}`, confirming `ADMIN_SECRET` is set in production.
- No production data or migrations were changed.
- Cancellation was not live-tested against production subscriptions.

---

## 10. Suggested next cleanup slices

1. **Security slice (P0):** fail-closed secret checks, WhatsApp signature verification, remove OTP/token logging.
2. **Payment slice (P0/P1):** unique pending-purchase key, transaction for subscription+slots, don't clear session on recoverable failure.
3. **Bot data slice (P1):** validate meal selection, check SKIP insert error, fix session activity timestamps, delete dead `SELECTING_MEAL_SLOT` branch.
4. **Date/kitchen slice (P1):** replace UTC date calls with IST helpers; fix kitchen-closed filters; add order uniqueness.
5. **Dead-code slice (P2):** remove unused exports/imports/clients, update README/templates/audit, decide on `/single-meals` and `bot-messages.html`.
6. **Quality slice (P2):** add lint/test/CI, add env validation, fix `npm run dev`, add cache-busting for unhashed assets.

---

## 11. Applied cleanup (2026-10-27)

The safe part of the dead-code/docs slice has been applied:

- Removed the unreachable `SELECTING_MEAL_SLOT` branch and unused bot states.
- Removed `lib/env.js`, `sendSimpleNotification`, `markAsRead`, `deleteSession`,
  and `markSessionExpired`.
- Removed unused imports and Supabase clients from `api/auth.js`,
  `api/razorpay-webhook.js`, and the lunch/dinner notification crons.
- Removed the remaining `/single-meals` link from the account menu.
- Changed unhashed `/css/*` and `/js/*` caching from one-year immutable to
  5-minute revalidation.
- Rewrote `README.md`, `templates.md`, `templates-body.md`, `docs/audit.md`,
  `DB_SCHEMA.md`, and the Petpooja sync notes.
- Removed the broken `dev` script (use `npx vercel dev` directly) and the unused
  `dotenv` dev dependency.

`bot-messages.html` was intentionally kept pending an owner decision.

`getCategories()` and `getPlanByTag()` were intentionally kept because the
external VPS Petpooja scripts are not in this repository and may import them.
