const IST_TIMEZONE = "Asia/Kolkata";

const DEFAULT_TIME_OPTS = { hour: "2-digit", minute: "2-digit" };

const DEFAULT_DATE_OPTS = { day: "numeric", month: "short" };

/**
 * Format an ISO timestamp (or date) in India Standard Time,
 * regardless of the server's configured timezone.
 */
export function formatTimeIST(value, opts = {}) {
  return new Date(value).toLocaleTimeString("en-IN", {
    timeZone: IST_TIMEZONE,
    ...DEFAULT_TIME_OPTS,
    ...opts,
  });
}

/**
 * Format a "YYYY-MM-DD" date string in India Standard Time.
 */
export function formatDateIST(dateStr, opts = {}) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-IN", {
    timeZone: IST_TIMEZONE,
    ...DEFAULT_DATE_OPTS,
    ...opts,
  });
}