#!/usr/bin/env bash
# Pull origin/main and rebuild the CineCards server only when the commit changed.
# Run by deploy/systemd/cinecards-autodeploy.timer (every 5 minutes).
set -euo pipefail
# Wrapped in main so bash parses the whole file before git updates it.
main() {
  REPO_DIR="${REPO_DIR:-/root/cinecards}"
  # local check: the public address is behind Cloudflare Access (2026-11-23), which redirects to its login page
  HEALTH_URL="${HEALTH_URL:-http://localhost:2567/health}"
  cd "$REPO_DIR"
  git fetch --quiet origin main
  LOCAL="$(git rev-parse HEAD)"
  REMOTE="$(git rev-parse origin/main)"
  if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0
  fi
  echo "cinecards: deploying ${REMOTE:0:7} (was ${LOCAL:0:7})"
  git merge --ff-only --quiet origin/main
  cd deploy
  docker compose up -d --build
  healthy=0
  for i in $(seq 1 30); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      healthy=1
      break
    fi
    sleep 2
  done
  if [ "$healthy" != 1 ]; then
    echo "cinecards: health check FAILED after deploying ${REMOTE:0:7}" >&2
    exit 1
  fi
  echo "cinecards: healthy on ${REMOTE:0:7}"
  smoke "$REMOTE"
  exit 0
}
# Story 8.7: live smoke test inside the game container (accounts, friends, invitation, duel, emote, decks).
# Its result is DATA_DIR/smoke.json, also served at /api/smoke. A failure is reported, never rolled back.
smoke() {
  local out last
  if out="$(timeout 90 docker compose exec -T -e SMOKE_COMMIT="$1" server \
    node --experimental-transform-types --no-warnings scripts/smoke.mjs 2>&1)"; then
    echo "cinecards: smoke OK on ${1:0:7}"
  else
    printf '%s\n' "$out" >&2
    last="$(printf '%s\n' "$out" | grep -E '^smoke FAILED' | tail -n 1 || true)"
    last="${last#smoke FAILED }"
    echo "cinecards: smoke FAILED ${last:-(no result: $(printf '%s\n' "$out" | tail -n 1))} on ${1:0:7}" >&2
  fi
}
main "$@"; exit $?
