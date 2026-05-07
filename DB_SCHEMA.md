# FitFuel Database Schema

Apply these via the Supabase dashboard SQL editor. Create in the numbered order to respect FK dependencies.

---

## Creation Order

| Step | Table | Depends On |
|------|-------|-----------|
| 1 | `customers` | — |
| 2 | `meal_plans` | — |
| 3 | `dishes` | meal_plans |
| 4 | `meal_plan_subscriptions` | customers |
| 5 | `subscription_slots` | meal_plan_subscriptions, dishes |
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
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed data matching bot/config/plans.js PLAN_CATEGORIES tags
INSERT INTO meal_plans (name, tag) VALUES
  ('Weight Loss', 'weight_loss'),
  ('Muscle Gain', 'muscle_gain'),
  ('Keto', 'keto'),
  ('Diabetic-Friendly', 'diabetic'),
  ('Vegan', 'vegan'),
  ('Balanced', 'balanced');
```

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

CREATE INDEX idx_dishes_meal_plan ON dishes(meal_plan_id);
CREATE INDEX idx_dishes_available ON dishes(is_available);
```

---

## 4. `meal_plan_subscriptions`

```sql
CREATE TABLE meal_plan_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
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

---

## 5. `subscription_slots`

```sql
CREATE TABLE subscription_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES meal_plan_subscriptions(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner')),
  delivery_time TIME NOT NULL,
  default_item_id UUID REFERENCES dishes(id) ON DELETE SET NULL,
  default_item_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, slot)
);

CREATE INDEX idx_slots_subscription ON subscription_slots(subscription_id);
CREATE INDEX idx_slots_slot ON subscription_slots(slot);
```

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
  notified_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_phone ON orders(phone);
CREATE INDEX idx_orders_delivery_date ON orders(delivery_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_slot_id ON orders(slot_id);
```

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

## Entity Relationships

```
customers 1──N meal_plan_subscriptions 1──N subscription_slots
                                                │
                                                N
                                              orders

meal_plans 1──N dishes
                  │
                  N
          subscription_slots.default_item_id
```
