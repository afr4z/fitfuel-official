-- Company / GST invoice details editable from the admin panel.
-- One singleton row. If this row is absent, the app falls back to the
-- GST_* environment variables.

CREATE TABLE IF NOT EXISTS gst_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  seller_gstin TEXT NOT NULL DEFAULT '',
  seller_legal_name TEXT NOT NULL DEFAULT '',
  seller_trade_name TEXT NOT NULL DEFAULT '',
  seller_address_lines TEXT NOT NULL DEFAULT '',
  seller_pan TEXT NOT NULL DEFAULT '',
  seller_email TEXT NOT NULL DEFAULT '',
  seller_phone TEXT NOT NULL DEFAULT '',
  seller_state_code TEXT NOT NULL DEFAULT '36',
  gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 5
    CHECK (gst_rate > 0 AND gst_rate <= 50),
  sac TEXT NOT NULL DEFAULT '996331',
  delivery_sac TEXT NOT NULL DEFAULT '996331',
  invoice_prefix TEXT NOT NULL DEFAULT 'FF',
  terms TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gst_settings ENABLE ROW LEVEL SECURITY;
