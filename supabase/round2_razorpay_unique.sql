-- Round 2 hardening — idempotency for Razorpay webhooks.
-- Run against the live database (Supabase SQL editor) BEFORE deploying the
-- webhook idempotency code, so duplicate deliveries are rejected at the DB.

-- One processed payment may provision at most one subscription.
-- Multiple NULLs are allowed (WhatsApp-only subscriptions that never went
-- through a payment link). No duplicates confirmed on live data (checked
-- 2026-09-24); if this fails, dedupe first.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_razorpay_payment
  ON meal_plan_subscriptions(razorpay_payment_id);