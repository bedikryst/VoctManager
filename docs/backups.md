# Backups & Disaster Recovery

Operational runbook for [`infra/backup.sh`](../infra/backup.sh) — the on-droplet
backup job. Read this before relying on backups, and run the **restore drill**
(bottom) at least once so you know it works before you need it.

## What it protects

Each run produces two archives, timestamped, in `$BACKUP_DIR` (default
`~/voct-backups`):

| Archive | Contents | Recreatable without it? |
|---|---|---|
| `voct-db-<TS>.sql.gz` | Full PostgreSQL dump (`pg_dump --clean --if-exists`) | **No** — the only copy of all app data |
| `voct-media-<TS>.tgz` | `voct_data/media` (avatars, audio, scores, documents) | **No** — user uploads, gitignored, single live copy |

Two layers of safety, by design:

- **Local copy** in `$BACKUP_DIR` (outside the repo checkout) — survives a bad
  deploy, human error, and `git clean -fdx`.
- **Off-site copy** on the foundation's **Google Shared Drive** via `rclone` —
  the only copy that survives losing the droplet or its disk. Kept inside the
  foundation's own Workspace tenant, so it introduces **no new RODO
  sub-processor** (Google is already one). The DB dump contains members'
  personal data — treat the Shared Drive accordingly (EU region, restricted
  membership).

Failure is never silent: every run pings a **healthcheck monitor**. A missed
success ping is what alerts you — this is the safeguard that was absent when the
job silently stopped after a single run.

## Prerequisites on the droplet

```bash
# rclone (off-site) and curl (healthcheck pings)
sudo apt-get update && sudo apt-get install -y rclone curl
# ...or the newer upstream rclone:  curl https://rclone.org/install.sh | sudo bash
```

## One-time setup

### 1. Failure alerting (healthchecks.io)

1. Create a free check at <https://healthchecks.io> (or self-host). Set the
   period to `1 day` and a grace of a few hours.
2. Add an email/Telegram/Slack integration so a missed ping actually reaches you.
3. Copy the ping URL (`https://hc-ping.com/<uuid>`) — it goes into
   `HEALTHCHECK_URL` below.

### 2. Off-site: service account + Shared Drive

Using a **service account bound to a Shared Drive** — not personal OAuth — is
deliberate: it needs no browser, no interactive token, and **never expires**
(a personal-Drive OAuth app in "Testing" mode silently dies after 7 days).

1. In **Google Cloud Console** (a project inside the foundation's org): enable
   the **Google Drive API**, create a **Service Account**, and download its
   **JSON key**. Copy the key to the droplet, e.g. `/root/voct-sa.json`
   (`chmod 600`).
2. In **Google Drive**, create a **Shared Drive** (e.g. `VoctManager Backups`).
   Add the service account's email (`...@...iam.gserviceaccount.com`) as a
   **Content Manager**. Copy the Shared Drive ID from its URL
   (`.../drive/folders/<ID>` → the ID is the `0A...` value).
3. *(Recommended)* In **Workspace Admin → data regions**, pin the org / this
   Shared Drive to the **EU**.
4. Configure the rclone remote on the droplet. Pass config params as
   **space-separated `key value` pairs** — the `key=value` form only works on
   newer rclone, and the `apt` build errors with `found key without value`:
   ```bash
   rclone config create voct-drive drive \
     scope drive \
     service_account_file /root/voct-sa.json \
     team_drive 0AHriIeVMnRF3Uk9PVA
   # sanity check — should list the Shared Drive without prompting:
   rclone lsd voct-drive:
   ```

### 3. Secrets file

```bash
cd ~/VoctManager
cp infra/backup.env.example infra/backup.env
nano infra/backup.env   # fill RCLONE_REMOTE, RCLONE_CONFIG, HEALTHCHECK_URL
```

`RCLONE_REMOTE=voct-drive:backups` writes into a `backups/` folder on the
Shared Drive.

### 4. First run + verify

```bash
cd ~/VoctManager && bash infra/backup.sh
```

Confirm all three:
- `ls -lh ~/voct-backups/` shows a fresh `.sql.gz` **and** `.tgz`.
- `rclone ls voct-drive:backups` shows the same two files off-site.
- The healthchecks.io dashboard flipped to **up** (green).

### 5. Schedule it (cron)

Run `which docker bash` first and substitute the real paths below (cron has a
minimal `PATH`; the backup script fixes its own, but the prune lines call
`docker` directly).

```bash
crontab -e
```

```cron
# Daily DB + media backup at 03:30 (script handles off-site + healthcheck).
30 3 * * * cd $HOME/VoctManager && /usr/bin/bash infra/backup.sh >> $HOME/voct-backups/backup.log 2>&1

# Reclaim Docker disk (rollback is git-based, so pruning old images is safe):
#   dangling images daily; build cache weekly, keeping 5 GB warm for fast rebuilds.
0 4 * * *  /usr/bin/docker image prune -f                          >> $HOME/voct-backups/prune.log 2>&1
0 4 * * 0  /usr/bin/docker builder prune -f --keep-storage 5GB     >> $HOME/voct-backups/prune.log 2>&1
```

## Restore drill

Do this once now, against the current data, so it is muscle memory later.

```bash
cd ~/VoctManager

# If the local copy is gone (e.g. droplet was rebuilt), pull it off-site first:
#   rclone copy voct-drive:backups/voct-db-<TS>.sql.gz  ~/voct-backups/
#   rclone copy voct-drive:backups/voct-media-<TS>.tgz  ~/voct-backups/

# --- Database (dump replays cleanly onto the live DB: --clean --if-exists) ---
gunzip -c ~/voct-backups/voct-db-<TS>.sql.gz \
  | docker compose -f docker-compose.yml -f docker-compose.prod.yml \
      exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# --- Media (stop writers first to avoid mid-write races) ---------------------
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop web celery
rm -rf voct_data/media && tar xzf ~/voct-backups/voct-media-<TS>.tgz -C voct_data
docker compose -f docker-compose.yml -f docker-compose.prod.yml start web celery
```

## Health checklist (review quarterly)

- [*] healthchecks.io shows a green ping every day (not just green *now*).
- [*] `rclone ls voct-drive:backups` holds ~`KEEP_DAYS` of both archive types.
- [ ] A restore drill was completed within the last quarter.
- [*] The service-account JSON key and `infra/backup.env` are `chmod 600`.
- [*] The Shared Drive is pinned to the EU region and its membership is minimal.
