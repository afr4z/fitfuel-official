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
WHATSAPP_INVOICE_TEMPLATE=invoice_ready
```

Distance-based delivery (defaults are set for the Khammam kitchen):

```
KITCHEN_LAT=17.2478673
KITCHEN_LNG=80.1496404
DELIVERY_FREE_KM=3
DELIVERY_STANDARD_PER_MEAL=20
DELIVERY_LONG_PLAN_PER_MEAL=15
DELIVERY_LONG_PLAN_MIN_DAYS=20
DELIVERY_UNKNOWN_POLICY=charge
DELIVERY_GEOCODE_SUFFIX=Khammam, Telangana, India
DELIVERY_LAUNCH_AT=2026-10-28T00:00:00+05:30
GOOGLE_MAPS_API_KEY=
```

`GOOGLE_MAPS_API_KEY` is optional. Without it, geocoding uses OpenStreetMap
Nominatim and distance uses straight-line Haversine. With it, Google Geocoding
and Distance Matrix are used for road distance.

The `DELIVERY_*` values above are fallbacks. Delivery charges are stored in
the `delivery_settings` table and can be edited from **Admin → Pricing →
Delivery charges** without a redeploy.

Template requirements are documented in `templates.md` and
`templates-body.md`.

GST seller details are editable from **Admin → Company** and stored only in the
`gst_settings` table. There is no seller/tax environment fallback; if the row is
absent or invoicing is disabled, no GST invoice is generated.

Plan prices are treated as GST-inclusive. The admin field is the **total** GST
rate: at 5%, invoices split it into 2.5% CGST + 2.5% SGST for Telangana
customers, or charge 5% IGST for customers in other states. The tax is
back-calculated from the amount paid, not added on top.

Only these invoice operational settings remain environment-driven:

```
GST_INVOICE_SAMPLE=false
INVOICE_STORAGE_BUCKET=invoices
WHATSAPP_INVOICE_TEMPLATE=invoice_ready
```

Invoices are generated in `api/razorpay-webhook.js` after a successful
payment, stored in the private `invoices` Supabase Storage bucket, and sent to
the customer on WhatsApp. If the 24-hour customer-service window is closed,
the send falls back to the approved `invoice_ready` document template.

To retry an invoice that failed to send:

```bash
npm run retry:invoice -- --payment-id pay_xxxxxxxx
```

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
- Plan pricing per meal and duration
- Delivery charges (free radius, per-meal rates, long-plan threshold)
- Company/GST details (legal name, address, GSTIN, PAN, tax settings, enable/disable)
- GST invoice list, PDF download, and WhatsApp resend
- Subscription summary/list/detail/export
- Subscription cancellation

## Important flows

- **Meal confirmation:** `lib/notifySlot.js`, called by
  `api/cron/notify-breakfast.js`, `notify-lunch.js`, and `notify-dinner.js`.
- **Change meal menu:** `bot/handlers/orders.js`.
- **Payment → subscription:** `api/razorpay-webhook.js`.
- **Website checkout:** `public/order.html` → `api/web-order.js`.
- **Delivery quote:** `lib/deliveryPricing.js` → `api/delivery-quote.js`.
  Payment-link totals and Petpooja dispatch use the same distance rules.
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
