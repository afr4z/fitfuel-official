-- Add the 28-day pricing tier for every active meal plan.
--
-- This is intentionally additive: the old 30-day rows can stay in place while
-- the previous production build is still running. Once the 28-day build is
-- live, remove the 30-day rows:
--
--   DELETE FROM plan_pricing WHERE days = 30;
--
-- Existing subscriptions are unaffected; they keep their current end_date.

INSERT INTO plan_pricing (plan_id, days, price_per_meal_per_day)
SELECT plan_id, 28, price_per_meal_per_day
FROM plan_pricing
WHERE days = 30
ON CONFLICT (plan_id, days) DO NOTHING;
