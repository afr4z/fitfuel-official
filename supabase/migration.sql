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

-- ─── Healthy Diet Plan Non-Veg ─────────────────────────────────────────────────

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'Fresh Garden Omelette',              false, 150, 'breakfast', '{"calories":464,"protein":22,"fat":38,"carbs":11}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'High Protein Pancakes (without whey)', true, 180, 'breakfast', '{"calories":459,"protein":16,"fat":16,"carbs":64}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Mixed Fruit Yogurt Bowl',             true, 160, 'breakfast', '{"calories":433,"protein":17,"fat":11,"carbs":68}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Vegetable Sandwich',                  true, 140, 'breakfast', '{"calories":381,"protein":9.4,"fat":14.7,"carbs":49.7}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Protein Smoothie',                    true, 170, 'breakfast', '{"calories":552,"protein":17.4,"fat":22.6,"carbs":70.9}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Overnight Oat Meal',                  true, 130, 'breakfast', '{"calories":445,"protein":18,"fat":13,"carbs":68}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Fruit Salad',                         true, 120, 'breakfast', '{"calories":134,"protein":2,"fat":1,"carbs":31}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'Paneer Millet Bowl',                  true,  220, 'lunch', '{"calories":521,"protein":24,"fat":30,"carbs":38}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Egg Meal Box',                        false, 210, 'lunch', '{"calories":436,"protein":22.8,"fat":19.5,"carbs":46.2}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Fish Meal Box',                       false, 260, 'lunch', '{"calories":364,"protein":25.2,"fat":10,"carbs":41.7}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Roti with Shrimp',                    false, 250, 'lunch', '{"calories":459,"protein":18,"fat":13,"carbs":67}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Veg Pasta',                           true,  190, 'lunch', '{"calories":402,"protein":17.1,"fat":19.8,"carbs":40.7}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Protein Salad (Veg)',                 true,  180, 'lunch', '{"calories":367,"protein":25.6,"fat":20.6,"carbs":20.4}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Grilled Chicken Sandwich',            false, 230, 'lunch', '{"calories":455,"protein":27.4,"fat":15.5,"carbs":48.4}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'Creamy Cucumber Salad',               true,  120, 'dinner', '{"calories":114,"protein":9.4,"fat":2.6,"carbs":15}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Shrimp Omelette',                     false, 200, 'dinner', '{"calories":401,"protein":24,"fat":33,"carbs":5}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Paneer Sandwich',                     true,  190, 'dinner', '{"calories":523,"protein":20,"fat":26,"carbs":49.1}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Mushroom Meal Box',                   true,  210, 'dinner', '{"calories":302,"protein":10,"fat":10,"carbs":45}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Creamy Spinach Pasta',                true,  200, 'dinner', '{"calories":533,"protein":18.3,"fat":32.5,"carbs":43.2}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Chicken Wrap',                        false, 220, 'dinner', '{"calories":372,"protein":25,"fat":20,"carbs":23}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg' UNION ALL
  SELECT id, 'Chicken Fajita',                      false, 260, 'dinner', '{"calories":483,"protein":33,"fat":20,"carbs":41}'::jsonb FROM meal_plans WHERE tag = 'healthy_nonveg';

-- ─── Healthy Diet Plan Veg ─────────────────────────────────────────────────────

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'High Protein Pancakes (without whey)', true, 180, 'breakfast', '{"calories":459,"protein":16,"fat":16,"carbs":64}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Mixed Fruit Yogurt Bowl',             true, 160, 'breakfast', '{"calories":433,"protein":17,"fat":11,"carbs":68}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Vegetable Sandwich',                  true, 140, 'breakfast', '{"calories":381,"protein":9.4,"fat":14.7,"carbs":49.7}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Protein Smoothie',                    true, 170, 'breakfast', '{"calories":552,"protein":17.4,"fat":22.6,"carbs":70.9}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Overnight Oat Meal',                  true, 130, 'breakfast', '{"calories":445,"protein":18,"fat":13,"carbs":68}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Fruit Salad',                         true, 120, 'breakfast', '{"calories":134,"protein":2,"fat":1,"carbs":31}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Peanut Butter Banana Wrap',           true, 160, 'breakfast', '{"calories":520,"protein":18,"fat":21,"carbs":63}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'Paneer Millet Bowl',                  true, 220, 'lunch', '{"calories":521,"protein":24,"fat":30,"carbs":38}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Veg Pasta',                           true, 190, 'lunch', '{"calories":402,"protein":17.1,"fat":19.8,"carbs":40.7}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Protein Salad (Veg)',                 true, 180, 'lunch', '{"calories":367,"protein":25.6,"fat":20.6,"carbs":20.4}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Rajma Meal Box',                      true, 200, 'lunch', '{"calories":430,"protein":19,"fat":8,"carbs":67}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Spinach & Paneer Bowl',               true, 210, 'lunch', '{"calories":470,"protein":25,"fat":21,"carbs":40}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Mushroom Meal Box',                   true, 210, 'lunch', '{"calories":300,"protein":10,"fat":10,"carbs":45}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Roti with Paneer',                    true, 190, 'lunch', '{"calories":500,"protein":22,"fat":18,"carbs":58}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'Creamy Cucumber Salad',               true, 120, 'dinner', '{"calories":114,"protein":9.4,"fat":2.6,"carbs":15}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Paneer Sandwich',                     true, 190, 'dinner', '{"calories":523,"protein":20,"fat":26,"carbs":49.1}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Creamy Spinach Pasta',                true, 200, 'dinner', '{"calories":533,"protein":18.3,"fat":32.5,"carbs":43.2}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Paneer Fajita',                       true, 250, 'dinner', '{"calories":500,"protein":24,"fat":18,"carbs":55}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Creamy Mashed Potato',                true, 140, 'dinner', '{"calories":350,"protein":7,"fat":12,"carbs":53}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Peri-Peri Paneer',                    true, 230, 'dinner', '{"calories":430,"protein":25,"fat":24,"carbs":20}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg' UNION ALL
  SELECT id, 'Sprouts Besan Chilla',                true, 160, 'dinner', '{"calories":320,"protein":18,"fat":9,"carbs":35}'::jsonb FROM meal_plans WHERE tag = 'healthy_veg';

-- ─── High Protein Diet Plan Non-Veg ────────────────────────────────────────────

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'High Protein Oatmeal (Chocolate)',      true, 170, 'breakfast', '{"calories":420,"protein":35,"fat":12,"carbs":55}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'High Protein Chocolate Yogurt Bowl',    true, 180, 'breakfast', '{"calories":380,"protein":38,"fat":8,"carbs":45}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'High Protein Chocolate Smoothie Bowl',  true, 190, 'breakfast', '{"calories":450,"protein":40,"fat":14,"carbs":50}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Chicken & Avocado Toast',               false, 220, 'breakfast', '{"calories":480,"protein":42,"fat":22,"carbs":30}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Chicken Omelette',                      false, 190, 'breakfast', '{"calories":420,"protein":45,"fat":25,"carbs":5}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'High Protein Chocolate Smoothie',       true, 170, 'breakfast', '{"calories":460,"protein":42,"fat":16,"carbs":48}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'High Protein Avocado Smoothie',         true, 180, 'breakfast', '{"calories":430,"protein":38,"fat":20,"carbs":35}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'Chicken Meal Box',                     false, 260, 'lunch', '{"calories":520,"protein":50,"fat":18,"carbs":40}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Roasted Chicken Breast',               false, 250, 'lunch', '{"calories":420,"protein":55,"fat":12,"carbs":15}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Chicken Lemon Strips (Grilled)',       false, 230, 'lunch', '{"calories":400,"protein":48,"fat":15,"carbs":12}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Creamy Chicken Breast',                false, 240, 'lunch', '{"calories":460,"protein":52,"fat":20,"carbs":18}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Grilled Chicken Quinoa Bowl',          false, 270, 'lunch', '{"calories":530,"protein":50,"fat":16,"carbs":45}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Roasted Fish Meal Box',                false, 280, 'lunch', '{"calories":480,"protein":48,"fat":14,"carbs":35}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Chicken Pulao',                        false, 240, 'lunch', '{"calories":500,"protein":42,"fat":16,"carbs":48}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'Chicken Tikki',                        false, 210, 'dinner', '{"calories":380,"protein":40,"fat":18,"carbs":20}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Fish Quinoa Bowl',                     false, 270, 'dinner', '{"calories":460,"protein":45,"fat":14,"carbs":38}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Shrimp Omelette',                      false, 220, 'dinner', '{"calories":400,"protein":42,"fat":22,"carbs":6}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Chicken Pasta',                        false, 230, 'dinner', '{"calories":480,"protein":44,"fat":18,"carbs":42}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Creamy Chicken Salad',                 false, 200, 'dinner', '{"calories":380,"protein":46,"fat":16,"carbs":12}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Spicy Chicken Sandwich',               false, 210, 'dinner', '{"calories":440,"protein":42,"fat":18,"carbs":35}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg' UNION ALL
  SELECT id, 'Air-fried Potatoes with Grilled Chicken', false, 240, 'dinner', '{"calories":490,"protein":48,"fat":16,"carbs":40}'::jsonb FROM meal_plans WHERE tag = 'high_protein_nonveg';

-- ─── High Protein Diet Plan Veg ────────────────────────────────────────────────

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'High Protein Chocolate Oatmeal',        true, 170, 'breakfast', '{"calories":400,"protein":32,"fat":12,"carbs":52}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'High Protein Chocolate Yogurt Bowl',    true, 180, 'breakfast', '{"calories":370,"protein":35,"fat":8,"carbs":42}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'High Protein Cookies & Cream Waffles (without egg)', true, 190, 'breakfast', '{"calories":430,"protein":30,"fat":16,"carbs":50}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Paneer Sandwich',                       true, 190, 'breakfast', '{"calories":450,"protein":28,"fat":20,"carbs":38}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Creamy Spinach Pasta',                  true, 200, 'breakfast', '{"calories":420,"protein":26,"fat":18,"carbs":40}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Ragi Malt',                             true, 120, 'breakfast', '{"calories":280,"protein":25,"fat":6,"carbs":42}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Mixed Fruit Yogurt',                    true, 150, 'breakfast', '{"calories":350,"protein":28,"fat":8,"carbs":50}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'Paneer Millet Bowl',                    true, 230, 'lunch', '{"calories":520,"protein":35,"fat":22,"carbs":42}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'High Protein Roties with Paneer Gravy',  true, 240, 'lunch', '{"calories":510,"protein":38,"fat":20,"carbs":45}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Roti with Chole',                        true, 190, 'lunch', '{"calories":460,"protein":30,"fat":14,"carbs":55}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Rajma Meal Box',                         true, 210, 'lunch', '{"calories":470,"protein":32,"fat":10,"carbs":60}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Vegetable Pulao (Paneer)',               true, 220, 'lunch', '{"calories":480,"protein":34,"fat":18,"carbs":48}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Paneer Tikki',                           true, 200, 'lunch', '{"calories":440,"protein":36,"fat":22,"carbs":30}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Rajma Quinoa Bowl',                      true, 230, 'lunch', '{"calories":490,"protein":38,"fat":12,"carbs":55}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'Mushroom Omelette',                      true, 200, 'dinner', '{"calories":380,"protein":28,"fat":18,"carbs":25}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Paneer Fajita',                          true, 250, 'dinner', '{"calories":480,"protein":36,"fat":22,"carbs":35}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Spinach Paneer Tikki',                   true, 210, 'dinner', '{"calories":400,"protein":32,"fat":20,"carbs":28}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'High Protein Chocolate Smoothie',        true, 170, 'dinner', '{"calories":420,"protein":38,"fat":14,"carbs":42}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Paneer Sandwich',                        true, 190, 'dinner', '{"calories":450,"protein":28,"fat":20,"carbs":38}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Paneer Wrap',                            true, 220, 'dinner', '{"calories":470,"protein":34,"fat":22,"carbs":40}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg' UNION ALL
  SELECT id, 'Veg Pasta',                              true, 190, 'dinner', '{"calories":420,"protein":26,"fat":16,"carbs":45}'::jsonb FROM meal_plans WHERE tag = 'high_protein_veg';

-- ─── Weight Loss Diet Plan Non-Veg ─────────────────────────────────────────────

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'Ragi Malt',                             true, 100, 'breakfast', '{"calories":220,"protein":18,"fat":4,"carbs":38}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Veg & Cheese Sandwich',                 true, 140, 'breakfast', '{"calories":310,"protein":15,"fat":12,"carbs":35}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Spicy Chicken Sandwich',                false, 170, 'breakfast', '{"calories":350,"protein":28,"fat":10,"carbs":32}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Fruit Salad',                           true, 110, 'breakfast', '{"calories":134,"protein":2,"fat":1,"carbs":31}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Egg Whites Omelette',                   false, 130, 'breakfast', '{"calories":210,"protein":25,"fat":8,"carbs":4}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Spinach Papaya Juice',                  true, 90,  'breakfast', '{"calories":140,"protein":3,"fat":1,"carbs":32}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Beetroot Juice',                        true, 90,  'breakfast', '{"calories":120,"protein":2,"fat":0,"carbs":28}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'Broccoli Meal Box',                     true, 190, 'lunch', '{"calories":340,"protein":18,"fat":12,"carbs":38}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Mushroom Meal Box',                     true, 200, 'lunch', '{"calories":300,"protein":14,"fat":10,"carbs":36}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Steamed Broccoli',                      true, 120, 'lunch', '{"calories":160,"protein":10,"fat":4,"carbs":22}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Broccoli Wrap',                         true, 160, 'lunch', '{"calories":290,"protein":14,"fat":10,"carbs":34}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Barbecue Wrap (Veg)',                   true, 170, 'lunch', '{"calories":310,"protein":16,"fat":12,"carbs":35}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Veg Semi Salad',                        true, 140, 'lunch', '{"calories":220,"protein":12,"fat":8,"carbs":26}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Pineapple Juice',                       true, 90,  'lunch', '{"calories":130,"protein":1,"fat":0,"carbs":32}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'Roasted Broccoli',                      true, 120, 'dinner', '{"calories":140,"protein":8,"fat":5,"carbs":18}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'High Fiber Beetroot Smoothie',          true, 110, 'dinner', '{"calories":180,"protein":4,"fat":2,"carbs":36}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Veg & Cheese Sandwich',                 true, 140, 'dinner', '{"calories":310,"protein":15,"fat":12,"carbs":35}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Creamy Avocado Salad',                  true, 180, 'dinner', '{"calories":280,"protein":6,"fat":22,"carbs":16}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Fresh Garden Salad',                    true, 110, 'dinner', '{"calories":120,"protein":4,"fat":2,"carbs":20}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Papaya Juice',                          true, 80,  'dinner', '{"calories":110,"protein":1,"fat":0,"carbs":26}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg' UNION ALL
  SELECT id, 'Watermelon Juice',                      true, 80,  'dinner', '{"calories":90,"protein":1,"fat":0,"carbs":22}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_nonveg';

-- ─── Weight Loss Diet Plan Veg ─────────────────────────────────────────────────

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'Green Smoothie Bowl',                   true, 140, 'breakfast', '{"calories":280,"protein":8,"fat":6,"carbs":50}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Oatmeal with Berry Compote',            true, 120, 'breakfast', '{"calories":310,"protein":10,"fat":5,"carbs":58}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Tofu Scramble with Vegetables',         true, 160, 'breakfast', '{"calories":260,"protein":18,"fat":12,"carbs":18}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Papaya Bowl with Lime',                 true, 100, 'breakfast', '{"calories":180,"protein":2,"fat":1,"carbs":42}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Coconut Water with Chia Seeds',         true, 90,  'breakfast', '{"calories":150,"protein":4,"fat":5,"carbs":24}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Steamed Idli with Sambar',              true, 110, 'breakfast', '{"calories":290,"protein":10,"fat":3,"carbs":58}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Vegetable Poha',                        true, 100, 'breakfast', '{"calories":270,"protein":6,"fat":8,"carbs":44}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'Cauliflower Rice Bowl',                 true, 180, 'lunch', '{"calories":220,"protein":12,"fat":8,"carbs":28}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Zucchini Noodles with Pesto',           true, 190, 'lunch', '{"calories":240,"protein":8,"fat":16,"carbs":18}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Cabbage and Lentil Soup',               true, 120, 'lunch', '{"calories":190,"protein":12,"fat":3,"carbs":30}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Cucumber Avocado Rolls',                true, 160, 'lunch', '{"calories":250,"protein":6,"fat":16,"carbs":22}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Steamed Vegetable Momos',               true, 140, 'lunch', '{"calories":280,"protein":10,"fat":4,"carbs":50}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Mixed Sprouts Salad',                   true, 130, 'lunch', '{"calories":210,"protein":14,"fat":4,"carbs":32}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Lauki Soup with Quinoa',                true, 130, 'lunch', '{"calories":180,"protein":8,"fat":2,"carbs":32}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg';

INSERT INTO dishes (meal_plan_id, name, is_veg, price, slot, nutrition)
  SELECT id, 'Clear Vegetable Soup',                  true, 100, 'dinner', '{"calories":120,"protein":4,"fat":2,"carbs":22}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Tofu and Spinach Salad',                true, 160, 'dinner', '{"calories":220,"protein":16,"fat":12,"carbs":14}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Grilled Zucchini with Hummus',          true, 170, 'dinner', '{"calories":260,"protein":10,"fat":14,"carbs":26}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Cabbage Soup',                          true, 90,  'dinner', '{"calories":150,"protein":6,"fat":2,"carbs":28}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Cucumber Raita with Roasted Papad',     true, 100, 'dinner', '{"calories":200,"protein":8,"fat":6,"carbs":28}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Bell Pepper and Tomato Salad',          true, 110, 'dinner', '{"calories":170,"protein":4,"fat":8,"carbs":22}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg' UNION ALL
  SELECT id, 'Herbal Tea with Rice Cakes',            true, 70,  'dinner', '{"calories":130,"protein":3,"fat":2,"carbs":26}'::jsonb FROM meal_plans WHERE tag = 'weight_loss_veg';

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

-- Generate 108 schedule rows (6 plans × 6 days × 3 slots) by cyclically assigning
-- the 7 dishes per plan in order across the 18 slots per plan.
INSERT INTO weekly_meal_schedule (plan_id, day_of_week, slot, dish_id)
  WITH numbered_dishes AS (
    SELECT
      d.id,
      d.meal_plan_id,
      d.slot AS dish_slot,
      ROW_NUMBER() OVER (PARTITION BY d.meal_plan_id, d.slot ORDER BY d.name) AS idx
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
   AND nd.idx = ((d.dow - 1) * 3 + s.slot_order) % 7 + 1;

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

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
