-- GST invoices for successful payments.
--
-- Stores an immutable snapshot of the seller, buyer, line items and tax
-- breakdown so an invoice can be re-rendered or re-sent later without relying
-- on the original checkout session.

ALTER TABLE meal_plan_subscriptions
  ADD COLUMN IF NOT EXISTS payment_breakdown JSONB;

CREATE TABLE IF NOT EXISTS invoice_counters (
  financial_year TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;

-- Atomically allocates the next invoice number for an Indian financial year
-- (Apr-Mar). Gaps are acceptable; duplicate numbers are not.
CREATE OR REPLACE FUNCTION next_invoice_number(p_financial_year TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_number INTEGER;
BEGIN
  INSERT INTO invoice_counters AS c (financial_year, last_number)
  VALUES (p_financial_year, 1)
  ON CONFLICT (financial_year)
  DO UPDATE SET
    last_number = c.last_number + 1,
    updated_at = now()
  RETURNING c.last_number INTO v_number;

  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION next_invoice_number(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION next_invoice_number(TEXT) TO service_role;

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  financial_year TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  subscription_id UUID REFERENCES meal_plan_subscriptions(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  razorpay_payment_id TEXT NOT NULL UNIQUE,
  razorpay_payment_link_id TEXT,
  amount_paise INTEGER NOT NULL,
  plan_amount_paise INTEGER,
  delivery_amount_paise INTEGER,
  delivery_description TEXT,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 5,
  taxable_paise INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0,
  sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0,
  place_of_supply TEXT,
  inter_state BOOLEAN NOT NULL DEFAULT false,
  buyer_name TEXT,
  buyer_phone TEXT,
  buyer_email TEXT,
  buyer_address TEXT,
  buyer_gstin TEXT,
  seller_snapshot JSONB NOT NULL,
  buyer_snapshot JSONB NOT NULL,
  line_items JSONB NOT NULL,
  pdf_path TEXT,
  status TEXT NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'sending', 'sent', 'failed')),
  whatsapp_message_id TEXT,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Existing installs need the delivery description and the "sending" claim
-- state added without dropping the table.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS delivery_description TEXT;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('generated', 'sending', 'sent', 'failed'));

-- Atomically claims an invoice for one sender. A concurrent Razorpay retry or
-- admin resend gets no row and therefore must not send a second WhatsApp
-- message. Stale "sending" rows are reclaimable after 10 minutes.
CREATE OR REPLACE FUNCTION claim_invoice_send(
  p_invoice_id UUID,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS SETOF invoices
LANGUAGE sql
AS $$
  UPDATE invoices
  SET status = 'sending', updated_at = now()
  WHERE id = p_invoice_id
    AND (
      status IN ('generated', 'failed')
      OR (p_force AND status = 'sent')
      OR (status = 'sending' AND updated_at < now() - INTERVAL '10 minutes')
    )
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION claim_invoice_send(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_invoice_send(UUID, BOOLEAN) TO service_role;

CREATE INDEX IF NOT EXISTS idx_invoices_subscription
  ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_phone
  ON invoices(phone);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at
  ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON invoices(status);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Private bucket. Invoices contain customer name, phone and address, so they
-- are only accessible via service-role signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;
