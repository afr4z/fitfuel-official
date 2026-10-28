# FitFuel Database Schema

The authoritative schema and seed data are in
[`supabase/migration.sql`](./supabase/migration.sql). That file **drops every
table** and must not be run against production.

Additional one-off patches live in `supabase/*.sql`. Prefer a new, additive
migration over editing a file that has already been applied.

## Tables

Creation order:

| Step | Table                     | Depends on                                      |
| ---- | ------------------------- | ----------------------------------------------- |
| 1    | `customers`               | —                                               |
| 2    | `customer_addresses`      | `customers`                                     |
| 3    | `meal_plans`              | —                                               |
| 4    | `plan_pricing`            | `meal_plans`                                    |
| 5    | `dishes`                  | `meal_plans`                                    |
| 6    | `weekly_meal_schedule`    | `meal_plans`, `dishes`                          |
| 7    | `next_day_meals`          | `meal_plans`, `dishes`                          |
| 8    | `meal_plan_subscriptions` | `customers`, `meal_plans`, `customer_addresses` |
| 9    | `subscription_slots`      | `meal_plan_subscriptions`                       |
| 10   | `orders`                  | `meal_plan_subscriptions`, `subscription_slots` |
| 11   | `kitchen_closed_days`     | —                                               |
| 12   | `invoice_counters`        | —                                               |
| 13   | `invoices`                | `meal_plan_subscriptions`, `customers`          |
| 14   | `delivery_settings`       | —                                               |
| 15   | `gst_settings`            | —                                               |

---

## 1. `customers`

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2. `customer_addresses`

```sql
CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  address TEXT NOT NULL,
  location JSONB,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_addresses_customer
  ON customer_addresses(customer_id);
CREATE UNIQUE INDEX idx_customer_addresses_unique
  ON customer_addresses(customer_id, address);
```

The address book is the source of truth for website checkout. The bot session
also stores a temporary address/location while onboarding.

## 3. `meal_plans`

```sql
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tag TEXT NOT NULL UNIQUE,
  description TEXT,
  emoji TEXT DEFAULT '🥗',
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Six seeded plans:

- `healthy_nonveg`
- `high_protein_nonveg`
- `weight_loss_nonveg`
- `healthy_veg`
- `high_protein_veg`
- `weight_loss_veg`

## 4. `plan_pricing`

```sql
CREATE TABLE plan_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  days INTEGER NOT NULL,
  price_per_meal_per_day DECIMAL(10,2) NOT NULL,
  UNIQUE (plan_id, days)
);
```

Tiered per-day pricing for 3, 7, 14, and 28-day plans. The server recomputes the
amount from this table; the browser does not control price. Rates are managed
from the admin **Pricing** tab.

Delivery is charged separately by distance and plan length. See
`lib/deliveryPricing.js`; quotes are server-side only.

## 5. `dishes`

```sql
CREATE TABLE dishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  categoryname TEXT,
  is_veg BOOLEAN NOT NULL DEFAULT true,
  price DECIMAL(10,2) NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  petpooja_item_id TEXT,
  slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner')),
  nutrition JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dishes_meal_plan ON dishes(meal_plan_id);
CREATE INDEX idx_dishes_available ON dishes(is_available);
CREATE INDEX idx_dishes_slot ON dishes(slot);
```

Dishes are read-only in the admin UI. Petpooja remains the source of truth, and
the external sync scripts update this table. `petpooja_item_id` is used when
orders are dispatched to Petpooja.

## 6. `weekly_meal_schedule`

```sql
CREATE TABLE weekly_meal_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner')),
  dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, day_of_week, slot)
);
```

Default dish for each plan × Monday–Saturday × slot. Managed from the admin
**Weekly** tab. Rows are seeded by cyclically assigning available dishes, so the
number of rows depends on the dish count.

## 7. `next_day_meals`

```sql
CREATE TABLE next_day_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner')),
  dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, date, slot)
);

CREATE INDEX idx_next_day_meals_date ON next_day_meals(date);
```

Tomorrow's override for a plan × slot. Managed from the admin **Tomorrow** tab.
Locked after 7:45 PM IST. The `commit-meals` cron fills missing rows from
`weekly_meal_schedule` at 7:45 PM IST.

## 8. `meal_plan_subscriptions`

```sql
CREATE TABLE meal_plan_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  meal_plan_id UUID REFERENCES meal_plans(id),
  phone TEXT NOT NULL,
  address_id UUID REFERENCES customer_addresses(id) ON DELETE SET NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('3day', 'weekly', 'biweekly', '21day', 'monthly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'paid',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_phone ON meal_plan_subscriptions(phone);
CREATE INDEX idx_subscriptions_status ON meal_plan_subscriptions(status);

CREATE UNIQUE INDEX idx_subscriptions_razorpay_payment
  ON meal_plan_subscriptions(razorpay_payment_id);
```

One Razorpay payment can provision at most one subscription. Multiple `NULL`
payment IDs are allowed for WhatsApp-only subscriptions.

Cancellation uses `status = 'cancelled'`; `start_date` and `end_date` are not
rewritten. The effective cancellation date is derived from the earliest cancelled
order.

## 9. `subscription_slots`

```sql
CREATE TABLE subscription_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES meal_plan_subscriptions(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner')),
  delivery_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, slot)
);

CREATE INDEX idx_slots_subscription ON subscription_slots(subscription_id);
CREATE INDEX idx_slots_slot ON subscription_slots(slot);
```

## 10. `orders`

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES meal_plan_subscriptions(id) ON DELETE CASCADE,
  slot_id UUID REFERENCES subscription_slots(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  delivery_date DATE NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner')),
  delivery_time TIME,
  item_id TEXT,
  item_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'confirmed',
      'skipped',
      'sent_to_kitchen',
      'accepted',
      'ready',
      'delivered',
      'cancelled'
    )
  ),
  petpooja_client_id TEXT,
  accept_until TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_phone ON orders(phone);
CREATE INDEX idx_orders_delivery_date ON orders(delivery_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_slot_id ON orders(slot_id);
```

`accept_until` is the customer-facing cutoff. A meal can be confirmed, changed,
or skipped only before this timestamp. `sent_to_kitchen`, `accepted`, and `ready`
orders are already with Petpooja and are skipped by admin cancellation.

## 11. `kitchen_closed_days`

```sql
CREATE TABLE kitchen_closed_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

When a day is marked closed, active subscriptions that would have received a
meal that day are extended by one day, and the affected customers are notified.

## 12. `invoice_counters`

```sql
CREATE TABLE invoice_counters (
  financial_year TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`next_invoice_number(financial_year)` atomically increments the counter and
returns the next sequence. Numbers are formatted as `FF/2026-27/0001`.

## 13. `invoices`

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  financial_year TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  subscription_id UUID REFERENCES meal_plan_subscriptions(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  razorpay_payment_id TEXT NOT NULL UNIQUE,
  razorpay_payment_link_id TEXT,
  amount_paise INTEGER NOT NULL,
  plan_amount_paise INTEGER,
  delivery_amount_paise INTEGER,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 5,
  taxable_paise INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0,
  sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0,
  place_of_supply TEXT,
  inter_state BOOLEAN NOT NULL DEFAULT false,
  buyer_name TEXT,
  buyer_phone TEXT,
  buyer_email TEXT,
  buyer_address TEXT,
  buyer_gstin TEXT,
  seller_snapshot JSONB NOT NULL,
  buyer_snapshot JSONB NOT NULL,
  line_items JSONB NOT NULL,
  pdf_path TEXT,
  status TEXT NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'sent', 'failed')),
  whatsapp_message_id TEXT,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

One row per successful Razorpay payment. `seller_snapshot`, `buyer_snapshot`
and `line_items` are immutable so the PDF can be regenerated after the original
storage object is gone. The PDF is stored in the private `invoices` Storage
bucket. See `supabase/invoices.sql`.

## 14. `delivery_settings`

```sql
CREATE TABLE delivery_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  free_km NUMERIC(6,2) NOT NULL DEFAULT 3 CHECK (free_km >= 0),
  standard_per_meal NUMERIC(10,2) NOT NULL DEFAULT 20 CHECK (standard_per_meal >= 0),
  long_plan_per_meal NUMERIC(10,2) NOT NULL DEFAULT 15 CHECK (long_plan_per_meal >= 0),
  long_plan_min_days INTEGER NOT NULL DEFAULT 20 CHECK (long_plan_min_days >= 1),
  unknown_policy TEXT NOT NULL DEFAULT 'charge'
    CHECK (unknown_policy IN ('charge', 'free')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Singleton row (`id = true`) edited from **Admin → Pricing → Delivery charges**.
Delivery quotes read it on every request, so changes apply without a redeploy.
If the row or table is unavailable, `lib/deliverySettings.js` falls back to the
`DELIVERY_*` environment variables. See `supabase/delivery-settings.sql`.

## 15. `gst_settings`

```sql
CREATE TABLE gst_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  seller_gstin TEXT NOT NULL DEFAULT '',
  seller_legal_name TEXT NOT NULL DEFAULT '',
  seller_trade_name TEXT NOT NULL DEFAULT '',
  seller_address_lines TEXT NOT NULL DEFAULT '',
  seller_pan TEXT NOT NULL DEFAULT '',
  seller_email TEXT NOT NULL DEFAULT '',
  seller_phone TEXT NOT NULL DEFAULT '',
  seller_state_code TEXT NOT NULL DEFAULT '36',
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 5
    CHECK (gst_rate > 0 AND gst_rate <= 50),
  sac TEXT NOT NULL DEFAULT '996331',
  delivery_sac TEXT NOT NULL DEFAULT '996331',
  invoice_prefix TEXT NOT NULL DEFAULT 'FF',
  terms TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Singleton row (`id = true`) edited from **Admin → Company**. It holds the full
seller identity and tax setup used on new GST invoices. Invoicing only becomes
active when the row is enabled and the GSTIN, legal name, and address are valid.
Before the first save, `lib/invoiceService.js` falls back to the `GST_*`
environment variables. See `supabase/gst-settings.sql`.

---

## Notification and commit schedule (IST)

| Job                | Time (IST) | UTC cron      | What it does                                    |
| ------------------ | ---------- | ------------- | ----------------------------------------------- |
| `commit-meals`     | 7:45 PM    | `15 14 * * *` | Fill `next_day_meals` and create pending orders |
| `notify-breakfast` | 8:00 PM    | `30 14 * * *` | Breakfast notification for tomorrow             |
| `notify-lunch`     | 8:30 AM    | `0 3 * * *`   | Lunch notification for today                    |
| `notify-dinner`    | 4:00 PM    | `30 10 * * *` | Dinner notification for today                   |
| `expiry-reminder`  | 1:30 PM    | `0 8 * * *`   | Remind subscribers with the threshold days left |
| `session-expiry`   | Every min  | VPS cron      | Notify idle bot sessions (not a Vercel cron)    |

Customer cutoffs: breakfast 10:00 PM IST (previous day), lunch 9:30 AM IST,
dinner 5:00 PM IST.

## Entity relationships

```text
customers 1──N customer_addresses
customers 1──N meal_plan_subscriptions
meal_plans 1──N plan_pricing
meal_plans 1──N dishes
meal_plans 1──N weekly_meal_schedule
meal_plans 1──N next_day_meals

meal_plan_subscriptions 1──N subscription_slots
meal_plan_subscriptions 1──N orders
meal_plan_subscriptions 1──N invoices
customers               1──N invoices
subscription_slots      1──N orders
```

## Meal default lookup

1. Look for `next_day_meals` at `(plan_id, date, slot)`.
2. Otherwise use `weekly_meal_schedule` at `(plan_id, day_of_week, slot)`.
3. `weekly_meal_schedule` is seeded for every plan × slot, so there is no
   dish-name fallback.
