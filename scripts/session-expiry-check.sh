#!/bin/sh
# Session expiry cleanup — called every minute from the VPS cron.
#
# Credentials and deployment URL are read from .env.local in the repo root
# (gitignored) when present, and can also be supplied via the environment:
#   CRON_SECRET   shared secret for /api/cron/* endpoints
#   VERCEL_URL    deployment base URL
#
# Crontab entry (run `crontab -e` and add):
#   * * * * * /path/to/scripts/session-expiry-check.sh >> /path/to/logs/session-expiry.log 2>&1

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ENV_FILE="$SCRIPT_DIR/../.env.local"

env_value() {
  # env_value KEY -> last KEY=value line from ENV_FILE with surrounding quotes stripped
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- | sed -e 's/^"//' -e 's/"$//'
}

[ -n "$CRON_SECRET" ] || CRON_SECRET=$(env_value CRON_SECRET)
[ -n "$VERCEL_URL" ] || VERCEL_URL=$(env_value VERCEL_URL)

CRON_SECRET="${CRON_SECRET:-change_this_to_a_random_cron_secret}"
VERCEL_URL="${VERCEL_URL:-https://fitfuel-official.vercel.app}"

curl -sf \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$VERCEL_URL/api/cron/session-expiry" \
&& echo "[$(date)] session-expiry OK" \
|| echo "[$(date)] session-expiry FAILED"
