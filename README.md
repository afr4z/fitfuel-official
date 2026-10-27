# FitFuel Nutrition

WhatsApp meal-plan bot, website checkout, Razorpay webhook, subscription
operations, and the admin console. The app is deployed as Vercel serverless
functions with static pages in `public/`.

## Structure

```
api/
├── webhook.js              WhatsApp Cloud API webhook
├── web-order.js            Website checkout → Razorpay payment link
├── razorpay-webhook.js     Payment success/failure → subscription
├── auth.js                 Website OTP, magic login, sessions, addresses
├── admin.js                Admin menu + subscription APIs
├── public.js               Public plan list
└── cron/                   Daily meal, expiry, and session jobs

bot/
├── handler.js              WhatsApp state router
├── session.js              Redis-backed bot sessions
├── states.js               Bot states
├── config/                 Messages and plan labels
└── handlers/               Greeting, menu, orders, subscription, expiry

lib/                        Supabase, WhatsApp, Razorpay, delivery, cron helpers
public/                     Website, admin, dashboard, checkout, static assets
supabase/                   SQL migrations / one-off schema patches
scripts/                    VPS session-expiry trigger
```

## Environment variables

Required:

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_ACCESS_TOKEN
WHATSAPP_VERIFY_TOKEN
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
ADMIN_SECRET
CRON_SECRET
APP_URL
```

Optional:

```
SESSION_TIMEOUT_MINUTES=5
RENEWAL_THRESHOLD_DAYS=2
BYPASS_DEADLINE_CHECK=false

WHATSAPP_OTP_TEMPLATE=otp_code
WHATSAPP_BREAKFAST_TEMPLATE=breakfast_notification
WHATSAPP_LUNCH_TEMPLATE=lunch_notification
WHATSAPP_DINNER_TEMPLATE=dinner_notification
WHATSAPP_RESCHEDULED_TEMPLATE=rescheduled_meal
WHATSAPP_EXPIRY_TEMPLATE=expiry_reminder
WHATSAPP_SESSION_EXPIRED_TEMPLATE=session_expired
WHATSAPP_PAYMENT_CONFIRMED_TEMPLATE=payment_confirmed
WHATSAPP_PAYMENT_FAILED_TEMPLATE=payment_failed
WHATSAPP_KITCHEN_CLOSED_TEMPLATE=kitchen_closed
WHATSAPP_CANCELLED_TEMPLATE=subscription_cancelled
```

Template requirements are documented in `templates.md` and
`templates-body.md`.

## Deploy

Push to `main` and let Vercel build the project:

```bash
git push origin main
```

Or deploy from the CLI:

```bash
npx vercel --prod
```

## Local development

The package intentionally has no `dev` script. `vercel dev` must not invoke
itself through an npm script, so run Vercel directly:

```bash
npx vercel dev
```

To receive WhatsApp webhooks locally, expose the dev server with a tunnel and
register the tunnel URL in Meta:

```
https://<tunnel-host>/api/webhook
```

For database changes, review `DB_SCHEMA.md` and `supabase/` first.
`supabase/migration.sql` is a destructive development reset; do not run it
against production.

## Admin

- UI: `/admin`
- API: `/api/admin/*`
- Auth: `Authorization: Bearer <ADMIN_SECRET>`
- The secret is entered on the login screen and kept in `sessionStorage`.

Admin operations:

- Weekly default menu
- Tomorrow-only overrides
- Kitchen-closed days
- Subscription summary/list/detail/export
- Subscription cancellation

## Important flows

- **Meal confirmation:** `lib/notifySlot.js`, called by
  `api/cron/notify-breakfast.js`, `notify-lunch.js`, and `notify-dinner.js`.
- **Change meal menu:** `bot/handlers/orders.js`.
- **Payment → subscription:** `api/razorpay-webhook.js`.
- **Website checkout:** `public/order.html` → `api/web-order.js`.
- **Admin subscription APIs:** `api/admin.js`.

## Known follow-ups

The full review is in `tasks/code-analysis.md`. Highest-priority follow-ups:

- Fail closed when `ADMIN_SECRET`, `CRON_SECRET`, or
  `RAZORPAY_WEBHOOK_SECRET` is missing.
- Verify WhatsApp POST webhook signatures.
- Decouple pending checkout state from the phone-keyed bot session.
- Make subscription + slot creation transactional.
- Normalize date handling on IST helpers.
- Add tests, lint, and CI.
