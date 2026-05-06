-- Migration: create kitchen_closed_days table
-- Tracks dates on which the kitchen is closed (ad-hoc holidays).
-- When a date is inserted via the admin API, all active subscription
-- end_dates are extended by one calendar day to compensate.

CREATE TABLE IF NOT EXISTS "public"."kitchen_closed_days" (
    "id"         uuid                     DEFAULT gen_random_uuid() NOT NULL,
    "date"       date                     NOT NULL,
    "reason"     text,
    "created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "public"."kitchen_closed_days" OWNER TO "postgres";

ALTER TABLE ONLY "public"."kitchen_closed_days"
    ADD CONSTRAINT "kitchen_closed_days_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."kitchen_closed_days"
    ADD CONSTRAINT "kitchen_closed_days_date_key" UNIQUE ("date");

CREATE INDEX "idx_kitchen_closed_date"
    ON "public"."kitchen_closed_days" USING btree ("date");

ALTER TABLE "public"."kitchen_closed_days" ENABLE ROW LEVEL SECURITY;

-- Only the service_role (used by server-side API functions) needs access.
-- anon and authenticated roles should have no access to this admin table.
GRANT ALL ON TABLE "public"."kitchen_closed_days" TO "service_role";
