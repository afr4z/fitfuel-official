-- Delivery charges editable from the admin panel.
-- One singleton row. Rates are GST-inclusive per meal. The application uses
-- hardcoded defaults only if this row or table is missing.

CREATE TABLE IF NOT EXISTS delivery_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  free_km NUMERIC(6, 2) NOT NULL DEFAULT 3 CHECK (free_km >= 0),
  standard_per_meal NUMERIC(10, 2) NOT NULL DEFAULT 20 CHECK (standard_per_meal >= 0),
  long_plan_per_meal NUMERIC(10, 2) NOT NULL DEFAULT 15 CHECK (long_plan_per_meal >= 0),
  long_plan_min_days INTEGER NOT NULL DEFAULT 20 CHECK (long_plan_min_days >= 1),
  unknown_policy TEXT NOT NULL DEFAULT 'charge'
    CHECK (unknown_policy IN ('charge', 'free')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO delivery_settings (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE delivery_settings ENABLE ROW LEVEL SECURITY;
