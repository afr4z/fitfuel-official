# FitFuel Database Schema

Run `supabase/migration.sql` to apply (drops all data).

## Creation Order

| Step | Table | Depends On |
|------|-------|-----------|
| 1 | `customers` | — |
| 2 | `meal_plans` | — |
| 2b | `plan_pricing` | meal_plans |
| 3 | `dishes` | meal_plans |
| 2c | `weekly_meal_schedule` | meal_plans, dishes |
| 2d | `next_day_meals` | meal_plans, dishes |
| 4 | `meal_plan_subscriptions` | customers |
| 5 | `subscription_slots` | meal_plan_subscriptions |
| 6 | `orders` | meal_plan_subscriptions, subscription_slots |
| 7 | `kitchen_closed_days` | — |

---

## 1. `customers`

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  address TEXT,
  location JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 2. `meal_plans`

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

Seed: 6 plans (healthy_nonveg, high_protein_nonveg, weight_loss_nonveg, healthy_veg, high_protein_veg, weight_loss_veg).

---

## 2b. `plan_pricing`

```sql
CREATE TABLE plan_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  days INTEGER NOT NULL,
  price_per_meal_per_day DECIMAL(10,2) NOT NULL,
  UNIQUE (plan_id, days)
);
```

Tiered per-day pricing. `price_per_meal_per_day` varies by duration
(e.g. 3-day @ ₹250/meal/day, 30-day @ ₹190/meal/day).

---

## 3. `dishes`

```sql
CREATE TABLE dishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_veg BOOLEAN NOT NULL DEFAULT true,
  price DECIMAL(10,2) NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Seed: 5 placeholder dishes per plan (30 total).

---

## 2c. `weekly_meal_schedule` (replaces `plan_weekly_meals`)

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

Default dish per plan × day-of-week (Mon–Sat) × slot. Never null — 108 rows seeded.
Managed via admin panel "Weekly Schedule" tab.

---

## 2d. `next_day_meals`

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

Tomorrow's override per plan × slot. Managed via admin panel "Tomorrow" tab.
Locked after 7:45pm IST. Auto-filled by commit-meals cron at 7:45pm from
`weekly_meal_schedule`.

---

## 4. `meal_plan_subscriptions`

```sql
CREATE TABLE meal_plan_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  meal_plan_id UUID REFERENCES meal_plans(id),
  phone TEXT NOT NULL,
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
```

`meal_plan_id` links to the plan category.

---

## 5. `subscription_slots`

```sql
CREATE TABLE subscription_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES meal_plan_subscriptions(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner')),
  delivery_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, slot)
);
```

Default dishes are looked up at order-creation time from `next_day_meals` →
`weekly_meal_schedule` fallback.

---

## 6. `orders`

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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'skipped', 'delivered')),
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

`accept_until` is set by the cron job. Users cannot confirm/change/skip after this deadline.

---

## 7. `kitchen_closed_days`

```sql
CREATE TABLE kitchen_closed_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Notification & Commit Schedule (IST)

| Event              | Time (IST) | UTC Cron     | Description                                   |
|--------------------|-----------|--------------|-----------------------------------------------|
| commit-meals       | 7:45pm    | `15 14 * * *` | Auto-fill next_day_meals + create all orders  |
| notify-breakfast   | 8:00pm    | `30 14 * * *` | Breakfast notification for tomorrow           |
| notify-lunch       | 8:30am    | `0 3 * * *`  | Lunch notification for same day               |
| notify-dinner      | 4:00pm    | `30 10 * * *` | Dinner notification for same day              |
| expiry-reminder    | 1:30pm    | `0 8 * * *`  | Remind subscribers with 2 delivery days left  |

Accept deadlines: Breakfast → 10pm IST, Lunch → 9:30am IST, Dinner → 5pm IST.

---

## Entity Relationships

```
customers 1──N meal_plan_subscriptions 1──N subscription_slots
                                                │
                                                N
                                              orders

meal_plans 1──N plan_pricing
meal_plans 1──N weekly_meal_schedule
meal_plans 1──N next_day_meals
meal_plans 1──N dishes
meal_plan_subscriptions ──── meal_plans

weekly_meal_schedule.dish_id ──── dishes.id
next_day_meals.dish_id ────────── dishes.id
```

## Meal Default Lookup Order

1. Check `next_day_meals` for `(plan_id, date, slot)` — if exists, use it.
2. Fall back to `weekly_meal_schedule` for `(plan_id, day_of_week, slot)`.
3. `weekly_meal_schedule` is always fully seeded — no null fallback needed.
