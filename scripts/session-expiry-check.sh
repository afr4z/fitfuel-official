#!/bin/sh
# Session expiry cleanup — call every 5 minutes from your VPS cron.
#
# Prerequisites:
#   1. Set CRON_SECRET in your VPS environment or paste it below.
#   2. Replace YOUR_VERCEL_URL with your actual deployment URL.
#
# Crontab entry (run `crontab -e` and add):
#   */5 * * * * /path/to/scripts/session-expiry-check.sh

CRON_SECRET="${CRON_SECRET:-change_this_to_a_random_cron_secret}"
VERCEL_URL="${VERCEL_URL:-https://fitfuel-bot.vercel.app}"

curl -sf -H "Authorization: Bearer $CRON_SECRET" "$VERCEL_URL/api/cron/session-expiry" \
  && echo "[$(date)] session-expiry OK" \
  || echo "[$(date)] session-expiry FAILED"
