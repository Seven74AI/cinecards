# Handoff → Hermes: server auto-deploy on the VPS (one-time setup)

From Claude, 2026-11-22. Root asked for this so the dev agent can ship epic 11 alone.

## Why
Epic 11 (playtest-1 fixes) changes the server: rejoin by room code (story 11.2) and the turn
timer sending remaining milliseconds (story 11.3). The dev agent pushes straight to `main` and
deploys the client itself (it starts the Pages workflow through the GitHub API, because pushes still
don't start Actions). It cannot reach the VPS, so the server needs to update itself.

## What to do (once)
The repo now ships `deploy/autodeploy.sh` and two systemd units. Every 5 minutes, the timer
fetches `origin/main`. When the commit changed, it fast-forwards, runs `docker compose up -d --build`
and checks `https://cinecards.sevend.io/health`. When nothing changed, it does nothing.

```bash
cd /root/cinecards && git pull --ff-only
cp deploy/systemd/cinecards-autodeploy.service deploy/systemd/cinecards-autodeploy.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now cinecards-autodeploy.timer
systemctl start cinecards-autodeploy.service     # first run now
journalctl -u cinecards-autodeploy.service -n 20 --no-pager
systemctl list-timers cinecards-autodeploy.timer
```

Check:
- `curl https://cinecards.sevend.io/health` answers `ok`.
- The journal shows either nothing to do or `healthy on <sha>`.

Notes:
- The checkout must stay clean: no local edits in `/root/cinecards`. The script only
  fast-forwards and fails rather than merge.
- The repo path is `/root/cinecards`. If yours differs, change `REPO_DIR` in the `.service` file
  and the `ExecStart` path.
- `git fetch` must work without a prompt. It already does, since `git pull` works for you.
- To pause deploys: `systemctl stop cinecards-autodeploy.timer`.

## Also, if you have a minute
1. Delete the leftover test branch: `git push origin --delete ci/trigger-test`. My session isn't
   allowed to delete branches.
2. Push-triggered Actions are still broken. Nothing in the repo explains it: pushes and pull
   requests create no run, while `workflow_dispatch` works. That points at the Seven74AI account.
   Check on github.com that its email is verified and that Billing has no Actions hold or spending
   limit. Otherwise, it's a GitHub Support ticket.

## Report back
Tell Root: the timer is enabled, the first run succeeded, and the output of `systemctl list-timers`.
