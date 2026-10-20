#!/bin/sh
# Keeps this server on the latest commit of the GitHub branch. Run it from cron every few minutes (see DEPLOY.md).
# Pull-based: the server fetches from GitHub, nothing is pushed to it, and no secret is stored on GitHub.
# All settings stay in hrms/.env.production on this server.
#
# Per run: fetch -> new commit? -> CI green for that commit? -> fast-forward -> rebuild -> wait for /api/health.
# If the new version never becomes healthy it goes back to the previous commit and will not retry that commit.
# Database migrations are not undone by a rollback: keep migrations backward compatible.
set -eu

BRANCH="${BRANCH:-main}"
REPO="${REPO:-clouds24ocampo/HRMSCLOUD}" # only used to read the CI result
REQUIRE_CI="${REQUIRE_CI:-true}"         # set to false to deploy every commit without waiting for CI
HEALTH_TRIES="${HEALTH_TRIES:-36}"       # health checks after a rebuild, HEALTH_WAIT seconds apart (36 x 10s = 6 minutes)
HEALTH_WAIT="${HEALTH_WAIT:-10}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FAILED_FILE=/var/tmp/hrms-failed-commit
LOCK=/tmp/hrms-auto-update.lock
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

log() { echo "$(date '+%F %T') $*"; }
short() { echo "$1" | cut -c1-7; }

# One run at a time. mkdir is atomic; a lock left behind by a crash expires after an hour.
if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +60 2>/dev/null)" ]; then rmdir "$LOCK" && mkdir "$LOCK" || exit 0; else exit 0; fi
fi
trap 'rmdir "$LOCK"' EXIT

cd "$ROOT"
[ -f hrms/.env.production ] || { log "hrms/.env.production is missing; create it first (see DEPLOY.md)"; exit 1; }

git fetch -q origin "$BRANCH"
OLD="$(git rev-parse HEAD)"
NEW="$(git rev-parse "origin/$BRANCH")"
[ "$OLD" = "$NEW" ] && exit 0
[ "$(cat "$FAILED_FILE" 2>/dev/null || true)" = "$NEW" ] && exit 0 # this commit already failed to start; wait for a newer one

if [ "$REQUIRE_CI" = "true" ]; then
  runs="$(curl -fsS -m 20 "https://api.github.com/repos/$REPO/commits/$NEW/check-runs")" || { log "cannot read CI status, will retry"; exit 0; }
  total="$(printf '%s' "$runs" | sed -n 's/.*"total_count": *\([0-9]*\).*/\1/p' | head -1)"
  pending="$(printf '%s' "$runs" | grep -cE '"status": *"(queued|in_progress|waiting|pending|requested)"' || true)"
  bad="$(printf '%s' "$runs" | grep -cE '"conclusion": *"(failure|cancelled|timed_out|action_required|startup_failure|stale)"' || true)"
  if [ "${total:-0}" -eq 0 ] || [ "$pending" -gt 0 ]; then log "CI still running for $(short "$NEW"), will retry"; exit 0; fi
  if [ "$bad" -gt 0 ]; then log "CI failed for $(short "$NEW"), not deploying"; exit 0; fi
fi

log "updating $(short "$OLD") -> $(short "$NEW")"
git merge -q --ff-only "origin/$BRANCH" || { log "local changes on the server block the update; fix by hand"; exit 1; }

cd hrms
healthy() {
  i=0
  while [ "$i" -lt "$HEALTH_TRIES" ]; do
    $COMPOSE exec -T app wget -qO- http://127.0.0.1:3300/api/health 2>/dev/null | grep -q '"ok"' && return 0
    i=$((i + 1)); sleep "$HEALTH_WAIT"
  done
  return 1
}

if $COMPOSE up -d --build && healthy; then
  rm -f "$FAILED_FILE"
  docker image prune -f >/dev/null 2>&1 || true
  log "deployed $(short "$NEW")"
  exit 0
fi

log "$(short "$NEW") did not become healthy, rolling back to $(short "$OLD")"
echo "$NEW" > "$FAILED_FILE"
cd "$ROOT" && git reset -q --hard "$OLD" && cd hrms && $COMPOSE up -d --build
log "rolled back to $(short "$OLD"); $(short "$NEW") will not be retried until a newer commit arrives"
exit 1
