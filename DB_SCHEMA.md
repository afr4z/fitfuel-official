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
  plan_type TEXT NOT NULL CHECK (plan_type IN ('3day', 'weekly', 'biweekly', 'monthly')),
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
subscription_slots      1──N orders
```

## Meal default lookup

1. Look for `next_day_meals` at `(plan_id, date, slot)`.
2. Otherwise use `weekly_meal_schedule` at `(plan_id, day_of_week, slot)`.
3. `weekly_meal_schedule` is seeded for every plan × slot, so there is no
   dish-name fallback.
