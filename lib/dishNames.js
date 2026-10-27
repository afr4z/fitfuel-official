const SLOT_SUFFIX = /\s*[(\[]\s*(breakfast|lunch|dinner)\s*[)\]]\s*$/i;

/**
 * Petpooja prefixes dish names with their slot, e.g. "Poha (Breakfast)".
 * Keep that tag in `dishes.name` for sync matching; strip it only when the
 * name is shown or sent to a customer.
 */
export function stripDishSlotSuffix(name) {
  if (!name) return name;
  return String(name).replace(SLOT_SUFFIX, "").trim();
}
