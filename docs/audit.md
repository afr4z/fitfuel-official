# FitFuel Security and Quality Audit

Last refreshed: **2026-10-27**

This file tracks the current state. The detailed evidence and line references are
in `tasks/code-analysis.md`. Historical fixed findings are kept below so the
same issues are not re-opened by mistake.

## Current priority

| Priority | Finding                                                             | Status   |
| -------- | ------------------------------------------------------------------- | -------- |
| P0       | Admin, cron, and Razorpay checks fail open when secrets are missing | **OPEN** |
| P0       | WhatsApp POST webhook is not signature-verified                     | **OPEN** |
| P0       | Pending checkout state is keyed only by phone                       | **OPEN** |
| P1       | Payment webhook can create a subscription without slots             | **OPEN** |
| P1       | Meal change accepts an item that is not in the plan menu            | **OPEN** |
| P1       | SKIP can tell the customer a meal moved when insert failed          | **OPEN** |
| P1       | Several UTC date calls are used where IST is intended               | **OPEN** |
| P1       | OTP and magic-login token are logged                                | **OPEN** |
| P2       | No CSP/HSTS/security headers                                        | **OPEN** |
| P2       | No automated tests, lint, typecheck, or CI                          | **OPEN** |
| P2       | Google Fonts are render-blocking; page-local CSS is duplicated      | **OPEN** |

## Fixed

| Finding                                                                              | Status                                                         |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Admin API imports and wildcard router mismatch                                       | Fixed — admin API rebuilt and live                             |
| Admin UI did not follow the main site design                                         | Fixed — `main.css` + `admin.css`, wordmark, shared tokens      |
| Admin had no subscription management                                                 | Fixed — summary, list, filters, detail, export, cancel         |
| DOM XSS through `innerHTML`                                                          | Fixed — shared `html-escape.js`; all sinks escaped             |
| OTP/session/magic tokens used `Math.random`                                          | Fixed — `crypto.randomInt` / `randomBytes`                     |
| OTP had no per-phone rate limit or attempt lockout                                   | Fixed — Upstash throttle, daily cap, lockout                   |
| Magic login by reference could forge a session                                       | Fixed — high-entropy `magic_` token                            |
| Razorpay webhook did not assert paid amount                                          | Fixed                                                          |
| Admin secret used plain string comparison                                            | Fixed — `lib/timingSafe.js`                                    |
| Webhook idempotency could create duplicate subscriptions                             | Fixed — unique index on `razorpay_payment_id`                  |
| `/single-meals` dead links                                                           | Fixed — removed from the account menu; no remaining references |
| Unhashed CSS/JS were cached as immutable for one year                                | Fixed — 5-minute revalidation                                  |
| Dead `SELECTING_MEAL_SLOT` bot branch and states                                     | Removed                                                        |
| Dead `lib/env.js`, `markAsRead`, `sendSimpleNotification`, duplicate session helpers | Removed                                                        |
| Unused imports and Supabase clients in auth, Razorpay, lunch/dinner crons            | Removed                                                        |
| Stale README, template catalog, schema, and Petpooja setup docs                      | Refreshed                                                      |

## Accepted decisions

- **Single admin login.** Everyone with `ADMIN_SECRET` has full access. No roles,
  cookies, or new session system.
- **Admin secret stays in `sessionStorage`.** Keep the admin page XSS-free and add
  CSP as the compensating control.
- **Dishes are read-only in admin.** Petpooja remains the source of truth.
- **No automatic refunds.** Cancellation stops future meals; refunds are handled
  manually through Razorpay.
- **No cancellation columns.** Use `status = 'cancelled'` and derive the effective
  date from the earliest cancelled order.
- **OTP/PII logging is currently retained** for development convenience. This
  should be removed before the next security pass.
- **`public/bot-messages.html` is kept** as an internal review page until the team
  confirms it is no longer used.

## Open findings

### P0 — fail-open secrets

`api/admin.js`, the cron handlers, and `api/razorpay-webhook.js` only enforce
authentication when the corresponding secret is set. If a deployment is missing
`ADMIN_SECRET`, `CRON_SECRET`, or `RAZORPAY_WEBHOOK_SECRET`, the endpoint becomes
public. Return `500`/`503` when a required secret is absent, and use
`safeEqualStrings` for every secret comparison.

### P0 — WhatsApp webhook signature

`api/webhook.js` verifies the GET `hub.verify_token`, but POST payloads are
accepted without checking `X-Hub-Signature-256`. Verify the Meta app secret over
the raw request body, and reject requests when `WHATSAPP_APP_SECRET` is absent.
This needs a raw-body strategy before implementation.

### P0 — checkout state keyed by phone

`api/web-order.js` stores pending checkout data in `session:${phone}`.
`api/razorpay-webhook.js` resolves it by phone alone. A new link can overwrite an
old pending purchase, and paying the old link can provision the wrong plan.
Store pending purchases under a unique reference/payment-link ID and keep the
phone only as a lookup attribute.

### P1 — payment provisioning is not atomic

The Razorpay webhook inserts a subscription, then inserts `subscription_slots`.
If the slot insert fails, the subscription remains and the customer can receive a
success message with no delivery slots. Use a Postgres RPC/transaction, or return
`500` on slot failure so Razorpay retries safely.

### P1 — meal changes are not validated

`bot/handlers/orders.js` updates the order even when the selected item is not in
the fetched plan/slot menu. Reject unknown items instead of writing
`"Selected meal"`.

### P1 — SKIP insert errors are ignored

The skip flow inserts a replacement order, ignores the result, and then tells the
customer the meal was moved. Check the insert error and only send the
“rescheduled” message after a successful insert.

### P1 — IST date consistency

Several paths still use `new Date().toISOString().split("T")[0]` instead of the
IST helpers in `lib/cronUtils.js`. This is wrong between midnight and 05:30 IST
and affects active-plan checks, upcoming meals, expiry cutoffs, and kitchen-closed
dates.

### P1 — OTP and magic token logging

`api/auth.js` logs the plaintext OTP. `api/razorpay-webhook.js` logs the magic
login token. Remove both values from logs; keep a correlation ID or phone hash if
diagnostics are needed.

### P2 — headers, fonts, CSS, and tests

- Add CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, and a frame policy.
- Self-host a variable font or load Google Fonts asynchronously.
- Consolidate repeated page-local CSS primitives into `public/css/main.css`.
- Add ESLint, Node/Vitest tests, `node --check` in CI, and smoke tests for admin
  auth, cancellation dates, payment idempotency, and delivery-day counting.
- Add environment validation at startup and fail closed.

## Verification

- All tracked JavaScript passes `node --check`.
- The inline admin script parses.
- `public/admin.html` and `public/css/admin.css` pass Prettier.
- The admin page renders in headless Chromium at 390×900 and 1280×1000.
- Production `/admin` serves `main.css` and `admin.css`.
- Production `/api/admin/subscriptions/summary` without auth returns `401`.
- No production data or migrations were changed by this audit.

## Related documents

- `tasks/code-analysis.md` — full evidence and line-level recommendations.
- `README.md` — setup, environment, and deployment.
- `templates.md` / `templates-body.md` — WhatsApp template contract.
- `DB_SCHEMA.md` — current table layout and job schedule.
- `PETPOOJA_MENU_SETUP.md` — external menu/category setup.
