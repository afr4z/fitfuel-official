-- ⚠️ Additive migration for an EXISTING database (dev phase — data preserved).
-- Run this in the Supabase SQL editor. For fresh databases, supabase/migration.sql
-- already contains the full schema (no need to run this file).

-- ─── 1. customer_addresses (address book — source of truth) ──────────────────

CREATE TABLE IF NOT EXISTS customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  address TEXT NOT NULL,
  location JSONB,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_addresses_unique ON customer_addresses(customer_id, address);

-- ─── 2. Backfill existing customers.address / location into the address book ──
-- Every customer with a saved address/location gets one default "Home" row.

INSERT INTO customer_addresses (customer_id, label, address, location, is_default)
  SELECT
    id,
    'Home',
    COALESCE(NULLIF(address, ''), 'Address pending'),
    location,
    true
  FROM customers
  WHERE address IS NOT NULL OR location IS NOT NULL
ON CONFLICT DO NOTHING;

-- ─── 3. Subscriptions point at the delivery address used at checkout ──────────

ALTER TABLE meal_plan_subscriptions
  ADD COLUMN IF NOT EXISTS address_id UUID REFERENCES customer_addresses(id) ON DELETE SET NULL;

-- ─── 4. Drop superseded columns (no backward compatibility — dev phase) ────────

ALTER TABLE customers DROP COLUMN IF EXISTS address;
ALTER TABLE customers DROP COLUMN IF EXISTS location;