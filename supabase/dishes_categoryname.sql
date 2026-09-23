-- Additive live-DB migration: rename dishes.description → dishes.categoryname
-- The column only ever stored the Petpooja category name the dish was synced
-- from (written by sync.js / sync-plans.js); nothing in the app reads it, so
-- the rename just makes the field's meaning explicit.
-- Run this in the Supabase SQL editor on the live database.

ALTER TABLE public.dishes RENAME COLUMN description TO categoryname;