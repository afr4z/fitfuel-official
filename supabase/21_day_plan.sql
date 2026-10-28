-- Add the 21-day plan duration.
--
-- 21-day plans use the same per-meal rate as the existing 28-day tier, so
-- admins can still change the 21-day price independently from /admin.
--
-- This also adds the "21day" plan_type. Existing subscriptions are unaffected;
-- plan_type remains "monthly" for 28-day plans.

BEGIN;

ALTER TABLE meal_plan_subscriptions
  DROP CONSTRAINT IF EXISTS meal_plan_subscriptions_plan_type_check;

ALTER TABLE meal_plan_subscriptions
  ADD CONSTRAINT meal_plan_subscriptions_plan_type_check
  CHECK (plan_type IN ('3day', 'weekly', 'biweekly', '21day', 'monthly'));

INSERT INTO plan_pricing (plan_id, days, price_per_meal_per_day)
SELECT plan_id, 21, price_per_meal_per_day
FROM plan_pricing
WHERE days = 28
ON CONFLICT (plan_id, days) DO NOTHING;

COMMIT;
