-- ⚠️ Drops all existing data and recreates from scratch.
DROP TABLE IF EXISTS next_day_meals CASCADE;
DROP TABLE IF EXISTS weekly_meal_schedule CASCADE;
DROP TABLE IF EXISTS plan_weekly_meals CASCADE;
DROP TABLE IF EXISTS plan_pricing CASCADE;
DROP TABLE IF EXISTS plan_slot_defaults CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS subscription_slots CASCADE;
DROP TABLE IF EXISTS meal_plan_subscriptions CASCADE;
DROP TABLE IF EXISTS dishes CASCADE;
DROP TABLE IF EXISTS meal_plans CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS kitchen_closed_days CASCADE;

-- ─── 1. customers ──────────────────────────────────────────────────────────────

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  address TEXT,
  location JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. meal_plans ─────────────────────────────────────────────────────────────

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

INSERT INTO meal_plans (name, tag, description, emoji, base_price) VALUES
  ('Healthy Diet Plan Non-Veg',      'healthy_nonveg',      'Balanced everyday nutrition (Non-Veg)',          '🥗', 207),
  ('High Protein Meal Plan Non-Veg', 'high_protein_nonveg', 'Protein-focused meals for muscle recovery',       '💪', 242),
  ('Weight Loss Meal Plan Non-Veg',  'weight_loss_nonveg',  'Calorie-controlled fat-loss meals (Non-Veg)',     '🔥', 194),
  ('Healthy Diet Plan Veg',          'healthy_veg',         'Balanced everyday nutrition (Veg)',               '🥗', 193),
  ('High Protein Meal Plan Veg',     'high_protein_veg',    'Protein-rich vegetarian meals',                   '💪', 230),
  ('Weight Loss Meal Plan Veg',      'weight_loss_veg',     'Low-calorie vegetarian fat-loss meals',           '🔥', 197);

-- ─── 2b. plan_pricing (tiered pricing per plan per duration) ────────────────────

CREATE TABLE plan_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  days INTEGER NOT NULL,
  price_per_meal_per_day DECIMAL(10,2) NOT NULL,
  UNIQUE (plan_id, days)
);

INSERT INTO plan_pricing (plan_id, days, price_per_meal_per_day)
  SELECT mp.id, v.days, v.price
  FROM meal_plans mp
  CROSS JOIN (VALUES (3, 250), (7, 220), (14, 207), (30, 190)) AS v(days, price)
  WHERE mp.tag = 'healthy_nonveg';

INSERT INTO plan_pricing (plan_id, days, price_per_meal_per_day)
  SELECT mp.id, v.days, v.price
  FROM meal_plans mp
  CROSS JOIN (VALUES (3, 290), (7, 260), (14, 242), (30, 220)) AS v(days, price)
  WHERE mp.tag = 'high_protein_nonveg';

INSERT INTO plan_pricing (plan_id, days, price_per_meal_per_day)
  SELECT mp.id, v.days, v.price
  FROM meal_plans mp
  CROSS JOIN (VALUES (3, 240), (7, 210), (14, 194), (30, 175)) AS v(days, price)
  WHERE mp.tag = 'weight_loss_nonveg';

INSERT INTO plan_pricing (plan_id, days, price_per_meal_per_day)
  SELECT mp.id, v.days, v.price
  FROM meal_plans mp
  CROSS JOIN (VALUES (3, 240), (7, 210), (14, 193), (30, 175)) AS v(days, price)
  WHERE mp.tag = 'healthy_veg';

INSERT INTO plan_pricing (plan_id, days, price_per_meal_per_day)
  SELECT mp.id, v.days, v.price
  FROM meal_plans mp
  CROSS JOIN (VALUES (3, 280), (7, 245), (14, 230), (30, 210)) AS v(days, price)
  WHERE mp.tag = 'high_protein_veg';

INSERT INTO plan_pricing (plan_id, days, price_per_meal_per_day)
  SELECT mp.id, v.days, v.price
  FROM meal_plans mp
  CROSS JOIN (VALUES (3, 240), (7, 210), (14, 197), (30, 178)) AS v(days, price)
  WHERE mp.tag = 'weight_loss_veg';

-- ─── 3. dishes (now includes slot and nutrition columns) ────────────────────────

CREATE TABLE dishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
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

-- ─── Dishes (real items from Petpooja dump) ─────────────────────────────────────
-- Only items that exist in the Petpooja dashboard. When new Petpooja categories
-- and items are added, add corresponding rows here at the correct (plan, slot).

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, petpooja_item_id, nutrition)
  SELECT id, 'Veg Healthy Item',             true,  130, 'breakfast', '10650531', '{"calories":250,"protein":10,"fat":5,"carbs":35}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Healthy Veg Item',             true,  150, 'breakfast', '10650532', '{"calories":300,"protein":12,"fat":6,"carbs":40}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, petpooja_item_id, nutrition)
  SELECT id, 'Fresh Garden Omelette',              false, 150, 'breakfast', '10650533', '{}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'High Protein Pancakes (Without Whey)', true, 150, 'breakfast', '10652743', '{}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Mixed Fruit Yogurt Bowl',             true,  150, 'breakfast', '10652744', '{}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Vegetable Sandwich',                  true,  150, 'breakfast', '10652745', '{}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Protein Smoothie',                    true,  150, 'breakfast', '10652746', '{}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, petpooja_item_id, nutrition)
  SELECT id, 'High Protein Veg Item',       true,  250, 'breakfast', '10650534', '{}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, petpooja_item_id, nutrition)
  SELECT id, 'High Protein Non Veg Item',   false, 150, 'breakfast', '10650535', '{}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, petpooja_item_id, nutrition)
  SELECT id, 'Weight Loss Veg Item',        true,  150, 'breakfast', '10650536', '{}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, petpooja_item_id, nutrition)
  SELECT id, 'Weight Loss Nonveg Item',     false, 150, 'breakfast', '10650537', '{}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg';

-- ─── 2c. weekly_meal_schedule (default dish per plan × day-of-week × slot) ──────

CREATE TABLE weekly_meal_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner')),
  dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, day_of_week, slot)
);

-- Generate schedule rows by cyclically assigning dishes per plan × slot.
-- Uses the actual count of dishes per plan×slot instead of assuming 7.
INSERT INTO weekly_meal_schedule (plan_id, day_of_week, slot, dish_id)
  WITH numbered_dishes AS (
    SELECT
      d.id,
      d.meal_plan_id,
      d.slot AS dish_slot,
      ROW_NUMBER() OVER (PARTITION BY d.meal_plan_id, d.slot ORDER BY d.name) AS idx,
      COUNT(*) OVER (PARTITION BY d.meal_plan_id, d.slot) AS cnt
    FROM dishes d
    WHERE d.is_available = true
  )
  SELECT
    mp.id,
    d.dow,
    s.slot,
    nd.id
  FROM meal_plans mp
  CROSS JOIN (VALUES (1), (2), (3), (4), (5), (6)) AS d(dow)
  CROSS JOIN (VALUES ('breakfast', 0), ('lunch', 1), ('dinner', 2)) AS s(slot, slot_order)
  JOIN numbered_dishes nd
    ON nd.meal_plan_id = mp.id
   AND nd.dish_slot = s.slot
   AND nd.idx = ((d.dow - 1) * 3 + s.slot_order) % nd.cnt + 1;

-- ─── 2d. next_day_meals ────────────────────────────────────────────────────────

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

-- ─── 4. meal_plan_subscriptions ────────────────────────────────────────────────

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

-- ─── 5. subscription_slots ─────────────────────────────────────────────────────

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

-- ─── 6. orders ─────────────────────────────────────────────────────────────────

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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'skipped', 'sent_to_kitchen', 'accepted', 'ready', 'delivered', 'cancelled')),
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

-- ─── 7. kitchen_closed_days ────────────────────────────────────────────────────

CREATE TABLE kitchen_closed_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Test data ─────────────────────────────────────────────────────────────────
-- Insert a test customer so dispatch-orders.js has someone to send to.
INSERT INTO customers (phone, name, address) VALUES
  ('9999999999', 'Test User', 'Test Address, Bangalore');

-- Create a test subscription (healthy_veg, 3day, starting today).
INSERT INTO meal_plan_subscriptions (customer_id, meal_plan_id, phone, plan_type, start_date, end_date)
  SELECT c.id, mp.id, '9999999999', '3day', CURRENT_DATE, CURRENT_DATE + 2
  FROM customers c, meal_plans mp
  WHERE c.phone = '9999999999' AND mp.tag = 'healthy_veg';

-- Create a slot for breakfast dispatch at 07:30 IST.
INSERT INTO subscription_slots (subscription_id, slot, delivery_time)
  SELECT mps.id, 'breakfast', '07:30:00'::time
  FROM meal_plan_subscriptions mps
  WHERE mps.phone = '9999999999';

-- Create a confirmed order for tomorrow breakfast.
-- Uses a subquery to find the dish UUID for "Healthy Veg Item" × healthy_veg × breakfast.
INSERT INTO orders (subscription_id, slot_id, phone, delivery_date, slot, delivery_time, item_id, item_name, is_default, status)
  SELECT
    mps.id,
    ss.id,
    '9999999999',
    CURRENT_DATE + 1,
    'breakfast',
    '07:30:00'::time,
    d.id::text,
    d.name,
    true,
    'confirmed'
  FROM meal_plan_subscriptions mps
  JOIN subscription_slots ss ON ss.subscription_id = mps.id AND ss.slot = 'breakfast'
  JOIN dishes d ON d.meal_plan_id = mps.meal_plan_id AND d.slot = 'breakfast' AND d.name = 'Healthy Veg Item'
  WHERE mps.phone = '9999999999';

-- ─── Permissions ───────────────────────────────────────────────────────────────

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
