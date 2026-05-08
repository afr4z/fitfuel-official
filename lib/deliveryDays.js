import { createClient } from "@supabase/supabase-js";

/**
 * Shared helpers for delivery-day calculations.
 * "Delivery days" are all days except Sunday (the kitchen is closed on Sundays).
 *
 * All date parameters are "YYYY-MM-DD" strings (UTC).
 */

/**
 * Starting from `startDate` (inclusive, must already be a non-Sunday),
 * advances the calendar by `deliveryDays` additional non-Sunday days and
 * returns the resulting date as a "YYYY-MM-DD" string.
 *
 * Example: addDeliveryDays("2026-05-08", 6) with a Sunday on 2026-05-10
 *   → skips Sun 10, lands on 2026-05-15 (7 calendar days but 6 delivery days added).
 *
 * @param {string} startDate   "YYYY-MM-DD" string for the first delivery day.
 * @param {number} deliveryDays Number of additional delivery days to add.
 * @returns {string} "YYYY-MM-DD" end date.
 */
export function addDeliveryDays(startDate, deliveryDays) {
  const d = new Date(startDate + "T00:00:00Z");
  let remaining = deliveryDays;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0) remaining--;
  }
  return d.toISOString().split("T")[0];
}

let _supabase;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  }
  return _supabase;
}

/**
 * Counts the number of non-Sunday days from today (UTC, inclusive) to
 * `endDate` (inclusive), excluding any dates the kitchen is closed.
 * Returns 0 if `endDate` is already in the past.
 *
 * @param {string} startDate "YYYY-MM-DD" string.
 * @param {string} endDate   "YYYY-MM-DD" string.
 * @returns {Promise<number>}
 */
export async function countRemainingDeliveryDays(startDate, endDate) {
  const now = new Date();
  const todayStr = new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().split("T")[0];
  const today = new Date(todayStr + "T00:00:00Z");
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  const d = start > today ? start : today;
  const rangeStartStr = d.toISOString().split("T")[0];
  let count = 0;
  while (d <= end) {
    if (d.getUTCDay() !== 0) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }

  try {
    const { data: closedDays } = await getSupabase()
      .from("kitchen_closed_days")
      .select("date")
      .gte("date", rangeStartStr)
      .lte("date", endDate);

    if (closedDays) {
      const closedInRange = closedDays.filter((cd) => {
        const day = new Date(cd.date + "T00:00:00Z").getUTCDay();
        return day !== 0;
      });
      count -= closedInRange.length;
    }
  } catch (err) {
    console.error("[DELIVERY-DAYS] Failed to fetch kitchen closed days:", err);
  }

  return Math.max(0, count);
}
