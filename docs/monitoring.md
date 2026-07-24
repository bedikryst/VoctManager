# Monitoring & Alerting

Operational runbook for knowing that VoctManager is down — or quietly broken —
before a chorister tells you.

## What is watched, and why only this

Three signals, chosen because each one fails in a way the others cannot see:

| Signal | Answers | Alert fires when |
|---|---|---|
| **Uptime** — external HTTP poll of `/healthz` | "is the site reachable from the internet at all?" | nginx, TLS, DNS or the droplet is down |
| **Readiness** — external HTTP poll of `/api/health/ready/` | "can the backend actually serve a request?" | Postgres or Redis is unreachable while nginx still answers |
| **Beat heartbeat** — `core.ping_beat_heartbeat` → healthchecks.io | "is the async pipeline alive?" | beat died, the broker is unreachable, or every worker is hung |

Deliberately **not** built: Prometheus, Grafana, OpenTelemetry. Metrics answer
"how much", and at a single-tenant install on one droplet with one maintainer
there is no SLO, no on-call rotation and no traffic to answer that about. The
questions that actually get asked here are "is it down" and "what threw" — the
three probes above plus error tracking cover both at a fraction of the operating
cost. Revisit if a second ensemble ever shares the deployment.

## The two probes are not interchangeable

`/api/health/` is **liveness**: dependency-free, used by the Docker healthcheck
from inside the container. It must never check the database — restarting the web
container because Postgres is slow yields a container that comes back equally
degraded, and it cascades into celery through `depends_on: service_healthy`.

`/api/health/ready/` is **readiness**: it runs `SELECT 1` and a Redis
write-then-read (a bare `PING` would call a maxmemory-blocked Redis healthy), and
returns **503** with the failing dependency named when either is down. It is for
the external monitor only — never wire it to the Docker healthcheck.

Neither endpoint echoes driver errors. Both are unauthenticated, and exception
text leaks hostnames, credential fragments and library versions; the detail goes
to the container log instead.

## Setup

### 1. Uptime + readiness (UptimeRobot)

Free tier, 5-minute interval, e-mail alerts. It only ever sees a public health
endpoint — no personal data, so no RODO sub-processor question arises.

1. Create two **HTTP(s)** monitors:
   - `https://voctensemble.com/healthz` — expect `200`.
   - `https://voctensemble.com/api/health/ready/` — expect `200`. A 503 here
     means the backend is up but degraded, which is the case a plain uptime check
     misses entirely.
2. Set the alert contact to an address you actually read on a phone.
3. Enable the **SSL certificate expiry** alert on the domain. Certbot renews
   automatically; this catches the renewal that silently stopped working.

### 2. Beat heartbeat (healthchecks.io)

A second check on the account that already monitors the backup job — do **not**
reuse the backup check, or a dead scheduler will hide behind a healthy backup.

1. New check, period **1 hour**, grace **1 hour** (the task runs hourly; see
   `CELERY_BEAT_SCHEDULE['core-ping-beat-heartbeat']`).
2. Copy its ping URL into the root `.env`:
   ```
   BEAT_HEARTBEAT_URL=https://hc-ping.com/<uuid>
   ```
3. Redeploy so celery picks up the variable (`make deploy`), then confirm the
   check flips green within the hour:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml \
     exec -T web python -c "from core.tasks import ping_beat_heartbeat; print(ping_beat_heartbeat())"
   ```
   `True` means the ping reached the monitor. Note this runs the function
   directly — a green check from a *scheduled* run is what proves beat itself.

Why an absent-signal alarm rather than an error alert: a ping that stops arriving
is the only signal that still fires when the whole stack is down. An alert that
depends on the broken system to send it is not an alert. This is the exact gap
that let the backup job stop for a month without anyone noticing.

## Logs

Container logs rotate at 50 MB × 5 per service (`x-default-logging` in
`docker-compose.yml`) — sized for incident forensics, not just disk safety. At
the previous 10 MB × 3 a chatty container retained only hours, so evidence had
usually rotated away before a problem was reported.

```bash
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
$COMPOSE logs --since 2h web        # backend, JSON lines in prod
$COMPOSE logs --since 2h celery     # tasks, beat
$COMPOSE ps                          # health status of every container
```

There is no log aggregation (Loki, SigNoz, ELK) on purpose: at this scale
`docker logs` with real retention answers the same questions without another
stateful service competing for RAM on the build host.

## When an alert fires

| Alert | First command | Likely cause |
|---|---|---|
| `/healthz` down | `$COMPOSE ps` | droplet rebooted, nginx container unhealthy, disk full |
| readiness 503 | `curl -s https://voctensemble.com/api/health/ready/` | named dependency: Postgres or Redis container down |
| heartbeat missing | `$COMPOSE ps` then `$COMPOSE logs --since 3h celery` | celery hung or crash-looping; `docker restart voct_celery` |
| backup check missing | `tail -50 ~/voct-backups/backup.log` | see [backups.md](backups.md) |
| cert expiry | `sudo certbot certificates` | renewal hook broken |

After a droplet reboot, `restart: always` brings every container back, but
`depends_on` ordering is **not** honoured outside `up` — so confirm `$COMPOSE ps`
shows `web` and `celery` as *healthy*, not merely *running*.

## Health checklist (review quarterly)

- [ ] Both UptimeRobot monitors show a green history, not just green now.
- [ ] The heartbeat check has no gaps in its last 30 days.
- [ ] A test alert actually reached your phone.
- [ ] `$COMPOSE ps` shows every container healthy.
- [ ] Restore drill completed — see [backups.md](backups.md).
