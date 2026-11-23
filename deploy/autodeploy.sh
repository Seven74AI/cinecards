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
  for i in $(seq 1 30); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      echo "cinecards: healthy on ${REMOTE:0:7}"
      exit 0
    fi
    sleep 2
  done
  echo "cinecards: health check FAILED after deploying ${REMOTE:0:7}" >&2
  exit 1
}
main "$@"; exit $?
