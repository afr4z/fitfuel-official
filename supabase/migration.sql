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

-- ─── 3. dishes (created before weekly_meal_schedule so FK references work) ──────

CREATE TABLE dishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_veg BOOLEAN NOT NULL DEFAULT true,
  price DECIMAL(10,2) NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  petpooja_item_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dishes_meal_plan ON dishes(meal_plan_id);
CREATE INDEX idx_dishes_available ON dishes(is_available);

-- 5 placeholder dishes per plan (all veg/non-veg accordingly)

INSERT INTO dishes (meal_plan_id, name, is_veg, price)
  SELECT id, 'Grilled Chicken with Steamed Vegetables', false, 180 FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Egg White Omelette with Whole Wheat Toast', false, 150 FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Chicken Salad with Olive Oil Dressing', false, 200 FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Tuna Sandwich with Mixed Greens', false, 190 FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Chicken Soup with Croutons', false, 170 FROM meal_plans WHERE tag = 'healthy_nonveg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price)
  SELECT id, 'Double Chicken Breast with Quinoa', false, 250 FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Egg and Chicken Wrap', false, 220 FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Protein Power Bowl Chicken Eggs Beans', false, 260 FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Grilled Fish with Broccoli', false, 280 FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Chicken Tikka with Greek Yogurt', false, 240 FROM meal_plans WHERE tag = 'high_protein_nonveg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price)
  SELECT id, 'Lemon Herb Chicken with Zucchini', false, 190 FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Egg Drop Soup with Chicken Strips', false, 160 FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Turkey Lettuce Wraps', false, 210 FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Baked Fish with Asparagus', false, 230 FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Chicken Bone Broth with Veggies', false, 150 FROM meal_plans WHERE tag = 'weight_loss_nonveg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price)
  SELECT id, 'Paneer Bhurji with Multigrain Roti', true, 160 FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Vegetable Pulao with Raita', true, 140 FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Chickpea Salad with Lemon Dressing', true, 150 FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Moong Dal Chilla with Mint Chutney', true, 130 FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Mixed Vegetable Soup', true, 120 FROM meal_plans WHERE tag = 'healthy_veg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price)
  SELECT id, 'Soya Chunks with Brown Rice', true, 180 FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Paneer Tikka with Salad', true, 200 FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Dal Khichdi with Curd', true, 150 FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Sprouts Salad with Peanuts', true, 160 FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Tofu and Vegetable Stir Fry', true, 190 FROM meal_plans WHERE tag = 'high_protein_veg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price)
  SELECT id, 'Lauki Soup with Roasted Veggies', true, 120 FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Quinoa Vegetable Bowl', true, 180 FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Cabbage Soup with Tofu', true, 130 FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Grilled Paneer Salad', true, 190 FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Green Detox Smoothie Bowl', true, 150 FROM meal_plans WHERE tag = 'weight_loss_veg';

-- ─── 2c. weekly_meal_schedule (default dish per plan × day-of-week × slot) ──────
-- Replaces old plan_weekly_meals. No null dish defaults — guaranteed by seed below.

CREATE TABLE weekly_meal_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner')),
  dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, day_of_week, slot)
);

-- Generate 108 schedule rows (6 plans × 6 days × 3 slots) by cyclically assigning
-- the 5 dishes per plan in order: dish 1→2→3→4→5→1→2→… across the 18 slots.
INSERT INTO weekly_meal_schedule (plan_id, day_of_week, slot, dish_id)
  WITH numbered_dishes AS (
    SELECT
      d.id,
      d.meal_plan_id,
      ROW_NUMBER() OVER (PARTITION BY d.meal_plan_id ORDER BY d.name) AS idx
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
   AND nd.idx = ((d.dow - 1) * 3 + s.slot_order) % 5 + 1;

-- ─── 2d. next_day_meals (tomorrow override per plan × slot) ─────────────────────
-- Populated by admin panel or auto-filled by commit-meals cron.

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

-- ─── 7. kitchen_closed_days ────────────────────────────────────────────────────

CREATE TABLE kitchen_closed_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Permissions ───────────────────────────────────────────────────────────────
-- Grant table access to service_role (used by server-side code).
-- Supabase's service_role key bypasses RLS but still needs table-level grants.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
