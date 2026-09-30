# Push reach — follow-ups

Status: **all three stages built and audited 2026-09-27, committed, not viewed in the browser.**
Left: view Stage 3, prod `make deploy` (applies notifications/0023). How it works
now is in `docs/web-push-architecture.md` §12. Builds on 8af983a6. Where the build departs from
the plan below:

- Stage 1: a network error does **not** count towards `consecutive_failures` (nor reset it). An
  all-network batch raises and is retried three times, so counting it would turn one outage into
  four strikes per device and deactivate every recipient's devices within two notices. A device
  without VAPID keys is deactivated at once instead of skipped. Any other per-device exception
  (a key the encryption step rejects) counts as a refusal instead of escaping the loop.
- Stage 2: two cache keys, not one. Only `cache.add` creates the gate; the kinds live under a
  second key. With one key, a listener's `set` racing the task's delete re-creates the gate with
  no task behind it and silences the piece until it expires.
- Stage 3a: the caption sits under "Push" (desktop header, and inline beside each switch's label
  on mobile, which has no header) rather than as one `Push · …` string in a 100 px column. The
  lever and caption also require e-mail not to be muted: with the master switch off nothing
  stands in for push, and "na razie mailem" would be false.

## Stage 1 — transport: device health and per-device failures (backend, one migration)

Problem: a device is deactivated only on 404/410. Any other refusal (403 after a VAPID key
change, 413, persistent 5xx) leaves it `is_active=True` for ever, so `has_push` and the device
count say "reachable" while every push fails. Separately, a network error (`requests`
exception) raised by `webpush()` escapes `_send_vapid_batch` mid-loop, and the task retry then
re-sends to the devices that already received it.

- `notifications/models.py` `PushDevice`: add `last_delivered_at` (DateTimeField, null) and
  `consecutive_failures` (PositiveSmallIntegerField, default 0). `makemigrations notifications`.
- `notifications/push_service.py` `_send_vapid_batch`:
  - catch `requests.RequestException` per device next to `WebPushException`, log, count as a
    failure;
  - after the loop, in bulk: delivered devices get `last_delivered_at=now, consecutive_failures=0`;
    failed ones `consecutive_failures=F('consecutive_failures') + 1`, and those reaching
    `_MAX_CONSECUTIVE_FAILURES = 5` are set `is_active=False` (alongside the existing 404/410 path);
  - if `delivered == 0` and at least one failure was a network error, raise a dedicated
    exception so the task retries: nothing went out, so a retry duplicates nothing. With
    `delivered > 0` never raise.
- `register_web_push`: reset `consecutive_failures=0` in `defaults`.
- `send_test_push` / the `test_push` view must survive the new exception (answer "undeliverable",
  not 500). Check the view before changing the service.
- `has_push` and `GET /api/notifications/devices/` stay on `is_active=True`; that flag now
  tells the truth.
- Tests (`notifications/tests.py`): a partial network failure does not raise and does not
  retry; an all-network failure raises; five consecutive failures deactivate the device; a
  success resets the counter; the exhausted-retry e-mail fallback still fires once.

## Stage 2 — coalesce material notices (backend)

Problem: `MATERIAL_UPLOADED` fires once per uploaded track (`ArchiveManagementService.create_track`
→ `piece_material_updated_event` → `roster/listeners.py` → bulk to every participant), and also on
edition approval (`archive/views.py`, kind `score`). A batch of 12 MP3s is 12 pushes per singer.
Members who have push start switching it off, which undoes the adoption work.

- `roster/listeners.py`: debounce per piece. `cache.add(f"material-notice:{piece_id}", …,
  timeout=WINDOW + margin)`. The first event in a window schedules
  `dispatch_material_notice_task.apply_async(args=[piece_id], countdown=WINDOW)`. Later events only
  record their kind under the key. `WINDOW = 10 min` via a setting with that default.
- The task pops the key, resolves recipients **at send time** (current participants, same query
  as today) and sends one bulk notification. `material_kind` = the single kind when uniform, else
  `None`. The composer already handles `None`, so no new copy is needed.
- Materials **stay out of the e-mail fallback** (`_NO_EMAIL_RESERVE` in `notifications/router.py`).
  One notice per piece is still one e-mail per piece, and a season's preparation touches many
  pieces. Revisit only if a per-recipient batch ("new material: A, B, C") is ever built.
- Tests: three uploads inside the window produce one dispatch; mixed kinds give `None`; a piece
  outside any project sends nothing. Patch `apply_async` and use the locmem cache.
- Trap: Celery does not autoreload. `docker restart voct_celery` in dev.

## Stage 3 — frontend: the fallback lever and offer pacing

**3a. Push column when no device takes push.** `push_enabled` is account-level, yet
`NotificationsTab` shows the push column only when this browser can push, and edits it only
when this browser is subscribed. A member with zero devices therefore cannot stop the reserve
e-mail per type: push OFF on a type means no push and no reserve.

- `features/settings/components/NotificationsTab.tsx`: `showPushColumn` also when
  `pushSummary?.active_devices === 0`; `canManagePushColumn = pushGranted || active_devices === 0`.
  This includes browsers that cannot push (an iPhone in Safari).
- The column header says what the switch governs while no device takes push. New key under
  `settings.notifications` ("push · for now by e-mail" wording, Polish first).
- `email_stands_in` gains the remedy: switching push off on a type stops its e-mail too.
- All three locales. Polish must read natively.

**3b. Auto-close is not a "not now".** In `features/notifications/lib/pushNudge.ts`,
`recordPushNudgeDismissal({ strike })`: a timeout starts the 14-day cooldown without counting
towards the three dismissals, while the close button and a swipe count. In
`hooks/usePushNudgeHost.tsx`, `onAutoClose` passes `strike: false`. Update the file header and
§12.

## After all stages

Update §12 of `docs/web-push-architecture.md`, and `.agent/memory/project_push_adoption_2026-09.md`
with its `MEMORY.md` line. Prod: `make migrate` (Stage 1) and `make prod`.
