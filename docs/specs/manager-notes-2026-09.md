# Personal notes — specification

Status: **Stage 1 (backend) built and audited 2026-09-22 — uncommitted, `make migrate` still
pending in every environment. Stage 2 (frontend) not started.** Written 2026-09-22 from Florent de
Bazelaire's request ("a mini notepad / to-do list — somewhere to jot: call X, write to X,
remember Y").

A private scratchpad living inside the panel shell. One flat list of short entries, each with a
done state. Reachable from every panel route without navigating away from the current page.

## Why it is not a local-only store

The obvious shortcut — a `localStorage` list — is wrong here for three concrete reasons:

- Entries are captured on the phone and consumed at the laptop. A per-device store never reconciles.
- `clearAllOffline()` runs on logout and wipes the persisted Zustand store. The first logout would
  silently destroy every note.
- A notepad that loses entries once stops being consulted permanently.

The server is the source of truth. Offline capture is handled by the **existing** write queue
(`app/store/useOfflineStore.ts` + `shared/offline/offlineClient.ts`), which is what that queue is
for. Only the *pin* state of the desktop rail is a device preference and belongs in `localStorage`.

## Scope

**In:** one flat list per user; free-text body; done toggle; edit; delete; offline capture and
edit; a right-side rail on wide viewports, a bottom sheet elsewhere; a global open action.

**Out, deliberately:**

- **Due dates and reminders.** A due date implies a push notification, which implies the whole
  `NotificationType` checklist, timezone handling and preference storage in two places. That is a
  second scheduler next to the one this app already has.
- **Assigning a note to another person.** That is a message; `messaging` exists.
- **Manual reordering.** Drag on touch fights the scroll, and it needs a dedicated order endpoint.
  Open-first + newest-first covers the use case at this size.
- **Links to a project, artist or rehearsal.** Tempting ("call X" — X is in the roster), but it
  turns a two-week feature into a month. The model tolerates a nullable FK added later; the
  feature does not ship in v1.
- **Rich text.** Plain text, line breaks preserved.

## Settled decisions

1. **Notes are private to their owner.** Decided 2026-09-22. No manager, including a superuser,
   reads another person's notes through the API. A shared team list was considered and rejected: it
   would need an author field in the DTO, an unfiltered queryset and real concurrent-edit conflict
   handling — a different feature, not a toggle.
2. **Every authenticated user gets it**, not only managers. Role-gating would add a permission
   class and a conditional mount for no benefit; the model does not care about roles.
3. **No dashboard card.** Decided 2026-09-22. The panel is opened deliberately; a private
   scratchpad does not belong on a screen that gets shown to other people.

## Data model

`backend/core/models.py`. `core` already owns the account domain (`UserProfile`, `FeedbackReport`)
and nothing about a personal scratchpad belongs to `roster` or `archive`.

```python
class Note(EnterpriseBaseModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name="notes", ...)
    body = models.TextField(...)          # plain text, line breaks preserved
    is_done = models.BooleanField(default=False, ...)
    done_at = models.DateTimeField(null=True, blank=True, ...)
```

- Inherits UUID PK (`default=uuid.uuid4`), `created_at`, `updated_at`, soft delete, `objects` /
  `all_objects` from `EnterpriseBaseModel`. The client-supplied-id path needs no model change.
- `on_delete=CASCADE` (unlike `FeedbackReport.reporter`, which is `SET_NULL` so reports survive an
  account purge). Private notes must not outlive their owner — this is the GDPR-correct choice.
- `Meta`: `db_table = "core_note"`, `ordering = ["is_done", "-created_at"]` (open first, newest
  first), `verbose_name` / `verbose_name_plural` via `gettext_lazy`, and **re-declare** the base
  class indexes — `EnterpriseBaseModel.Meta.indexes` is not inherited when a child declares its own
  `Meta` without inheriting it (see `FeedbackReport.Meta` for the precedent). Add
  `Index(fields=["owner", "is_done", "-created_at"])`.
- `done_at` is set/cleared in the serializer on the `is_done` transition, never accepted from the
  client.
- Next migration: `core/0027_…`.

### Retention

Completed notes are hard-deleted 30 days after `done_at` by a daily Celery task in
`backend/core/tasks.py`, registered in the existing beat schedule. Without it the list grows
without bound; with it, the done section stays a short-term undo rather than an archive. Purging
inside a GET request is not acceptable — a read must not mutate.

### Erasure and portability

`on_delete=CASCADE` does **not**, on its own, keep a note from outliving its owner:
`UserIdentityService.process_account_soft_deletion` anonymizes the auth row rather than deleting
it, so the cascade never fires. Erasure therefore purges notes explicitly
(`Note.all_objects.filter(owner=user).hard_delete()`), beside the existing `user.profile.hard_delete()`
and for the same reason — a note is free text that routinely names third parties.

Portability is the mirror image: `generate_gdpr_export` carries the owner's live notes (body,
`is_done`, `created_at`, `done_at`). Soft-deleted notes are left out — to their author those are
already gone, and returning them would read as the app keeping what they discarded.

## API

Router registration in `backend/config/urls.py`: `router.register(r"notes", NoteViewSet,
basename="note")`. `core` has no `urls.py` today and does not need one for a single viewset.

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/notes/` | Own notes only. Open first, then newest. No pagination (retention bounds the list). |
| `POST` | `/api/notes/` | Accepts an optional client-minted `id` (replay-idempotent — see below). |
| `PATCH` | `/api/notes/{id}/` | `body` and/or `is_done`. |
| `DELETE` | `/api/notes/{id}/` | Soft delete. |

**`NoteViewSet`** (`backend/core/views.py` — the first viewset in this app; `core` uses APIView and
generics today, so follow `archive.AnnotationViewSet` for the viewset shape):

- `permission_classes = [permissions.IsAuthenticated]`.
- `get_queryset(self) -> QuerySet[Note]` → `Note.objects.filter(owner=request_user(self.request))`.
  Ownership is enforced by the queryset, not by an object permission — a non-owner gets 404, which
  is the correct answer for a private resource (403 would confirm the note exists).
- `perform_create` → `serializer.save(owner=user)`. The owner is never read from the payload.
- **Replay idempotency**, mirroring `archive/views.py:989-997`: when the payload carries an `id`,
  look it up with `Note.all_objects.filter(pk=supplied_id).first()`; if it exists and belongs to
  someone else → `PermissionDenied`; if it belongs to the requester → set `serializer.instance` and
  return without creating a duplicate. Soft-deleted rows count as existing, hence `all_objects`.
  This is what makes an offline replay safe.
- `perform_destroy` → `instance.delete()` (soft).
- `http_method_names` drops `put`. Every writable field carries a default, so a whole-object
  replace would behave identically to a partial one — a second spelling of PATCH that nothing calls
  and every reader has to reason about.

**`NoteSerializer`** (`backend/core/serializers.py`):

- `id = serializers.UUIDField(required=False)` declared by hand, deliberately bypassing the
  `ModelSerializer` `UniqueValidator` — otherwise a queue replay returns 400 instead of being
  absorbed. `validate()` pops `id` when `self.instance is not None` so an edit cannot move rows.
- `validate_body`: strip; reject empty with `_("Note cannot be empty.")`; cap at
  `MAX_NOTE_BODY_LENGTH = 2000` by truncation, following `validate_body` on `FeedbackReportSerializer`.
- Read-only: `id` on update, `created_at`, `updated_at`, `done_at`.
- Messages via `gettext_lazy as _`; `backend/locale/` keeps the `.mo` files tracked.

## Frontend

### Slice

`frontend/src/features/notes/` — folder convention copied from `features/crew/`:

```
api/notes.service.ts        api/notes.queries.ts
types/notes.dto.ts          types/index.ts
hooks/useNotesPanel.ts      (open/close context consumer)
components/NotesPanel.tsx   NoteRow.tsx   NoteComposer.tsx   NotesEmptyState.tsx
```

Shell chrome lives in `widgets/panel-shell/notes/` (`NotesRail.tsx`, `NotesSheet.tsx`,
`NotesPanelProvider.tsx`, `useNotesPin.ts`) and composes `NotesPanel` from the feature. Widgets
compose features; the feature never imports the shell.

### Queries

- `notesKeys` prefix; list query spreads `RECONCILING_REFETCH` from `shared/api/queryPolicy.ts`.
- Optimistic create/update/delete following `useUpdateComposer` in
  `features/archive/api/archive.queries.ts` (cancel → snapshot `getQueryData` → `setQueryData` →
  restore in `onError` → invalidate in `onSettled`).
- **Create mints the UUID on the client** (`crypto.randomUUID()`), so the optimistic row has its
  final identity and a later edit or toggle addresses the same row whether or not the create has
  reached the server yet. This is the annotations model and it is the foundation of offline edit.
- `onError` → if `isLikelyOfflineError(error)`, keep the optimistic patch and `enqueueWrite(...)`;
  otherwise roll back. `onSettled` skips invalidation while `navigator.onLine` is false.
  Follow `useAnnotationMutations` in `features/annotations/api/annotations.queries.ts`, which is the
  closest existing analogue (full CRUD through the queue).
- `dedupeKey`: `note:{id}:{field}` — a body edit and a done toggle on the same note must not
  collapse into each other, but repeated taps on the same toggle must.
- **Two replay behaviours the server was measured doing, which the client must design against:**
  a replayed POST whose row already exists returns `201` with the **stored** body, silently
  discarding a changed one — so a create and a later body edit have to stay separate queue entries,
  which is exactly what the `dedupeKey` above buys; and a replayed POST for a note that has since
  been soft-deleted also returns `201`, for a row `GET /api/notes/` will never list. A `201` is
  therefore not a promise that the note is visible: treat the list response as the truth and let
  the reconcile drop the optimistic row, or it will flash back in and vanish on the next refetch.
- Add `"note"` to the `OfflineWriteKind` union in `app/store/useOfflineStore.ts`.
- Bump the query cache buster (DTO change).

### Row

- Collapsed: `line-clamp-2` on a `Text` from `shared/ui/primitives/typography`, with `leading-snug`
  restated (the cva compound variant sets line-height, and clamping needs it explicit) and
  `whitespace-pre-wrap`. Parent flex child needs `min-w-0`, as every row in this codebase does.
  **Not** the single-line `truncate` prop — one line cuts a typical note mid-phrase and forces a
  expand on nearly every row, which defeats the mechanism.
- Expanded: full body plus an inline editor (`shared/ui/primitives/InlineEditable.tsx`) and the
  delete action. Delete is reachable only from the expanded state — four targets in a 44 px row is
  one too many on a phone.
- **Hit areas:** the checkbox is its own button with `stopPropagation` on click *and* keydown
  (space bubbles to the row otherwise); the body is the expand toggle; nothing else in the row is
  interactive. `aria-expanded` on the row, `aria-pressed` on the checkbox.
- Expansion animates via `grid-template-rows: 0fr → 1fr` in CSS, one row at a time. Framer-motion
  is restricted to transform/opacity here and cannot animate height.
- Done rows: struck through, moved to a collapsed "Completed" disclosure below the open ones.

### Composer

- Always at the **top** of the panel, never the bottom: a bottom-anchored composer collides with
  the iOS keyboard inset, which is a solved-but-fragile area of this app.
- Single-line input (`shared/ui/primitives/Input.tsx`). **Enter submits.** There is no newline in
  quick capture — that is what enforces the front-loaded first line that makes `line-clamp-2`
  readable. Multi-line detail is added later in the expanded row's editor.
- Autofocus only when the panel was opened by the explicit "new note" action, never on a plain open.

### Surfaces

Two anchorings, one panel component, one open state.

| Viewport | Surface |
| --- | --- |
| `< 60rem` (phone, tablet portrait) | `shared/ui/composites/BottomSheet.tsx` — already portals to `document.body`, drag-to-dismiss, safe-area padding, `z-focus-trap`, and becomes a centred modal from `sm:`. Use as-is. |
| `≥ 60rem` (tablet landscape, laptop, desktop) | Right rail, overlay by default. |
| `≥ 60rem` **and** `fine-pointer` | Rail additionally pinnable — pinned stops overlaying and the page reflows around it. |

**The breakpoint is new and deliberate.** The shell keys its desktop chrome on pointer type
(`DesktopSidebar` is `fine-pointer:flex`), so a tablet gets the phone shell today. Introduce one
Tailwind variant, `wide-shell` (`@media (min-width: 60rem)`), used **only** by this panel. iPad
landscape (1024) gets the rail; iPad portrait (768) does not, because a 300 px rail on a 768 px
viewport is a third of the screen.

### Rail

Mirror of `DesktopSidebar.tsx` / `useSidebarPin.ts`:

- `GlassCard as={motion.aside}` at `fixed right-4 top-4 bottom-4 z-60`, hidden below `wide-shell`.
- Collapse animates **`clipPath` only**, so nothing reflows:
  `inset(0px 0px 0px calc(100% - 88px) round 2.5rem)` collapsed →
  `inset(0px 0% 0px 0px round 2.5rem)` open, with the sidebar's spring
  (`stiffness: 400, damping: 40, mass: 0.8`). Children fade with `initial={false}` on opacity plus
  `aria-hidden` when closed.
- `useNotesPin` copies `useSidebarPin` exactly: `localStorage` key `voct.notes.pinned`, and it is
  the **only** writer of a `--rail-pad` custom property on `document.documentElement`.
- `<main>` in `DashboardLayout.tsx` currently ends its fine-pointer rule with `fine-pointer:pr-6`.
  That is the slot: `wide-shell:pr-[calc(var(--rail-pad,0px)+1.5rem)]`. The two pad variables are
  independent; the left one is untouched.
- Pin toggle is the same `Tooltip` + `aria-pressed` button with the rotating `Pin` icon.

### Entry points

- **Command palette.** `CommandItem` already supports `run?: () => void` as an alternative to `to`,
  and `run` leaves the palette open — the theme rows are the precedent. Add a dedicated `useMemo`
  section rather than loosening the required `to` on `COMMAND_ACTIONS`.
- **Shell icon** in `DesktopSidebar` and the mobile nav trigger, with a quiet dot when open notes
  exist. A dot, not a count — a count turns a scratchpad into a source of pressure.
- **`NotesPanelProvider`** mirrors `CommandPaletteProvider`: context `{ isOpen, open, close, toggle }`,
  a `useNotesPanel()` that throws outside the provider, and a global hotkey guarded by
  `isEditableTarget` so it does not fire while typing.

### Routes where the panel must not exist

The score stand and the PDF viewer compute their fit (auto / page / width / half) from the real
viewport width. A pinned rail there would make that arithmetic wrong, not merely cramped. The
provider renders no rail on those routes — suppressed, not hidden.

## i18n

New keys under `notes.*` in all three locales
(`frontend/src/shared/config/locales/{pl,en,fr}/translation.json`). Polish is primary and must read
natively. Backend messages go through `backend/locale/` — `.mo` files are tracked and nobody runs
`compilemessages`, so compile them with `polib` as part of the change.

`"Note cannot be empty."` is the only backend string that reaches a reader, and it is in all three
catalogs. The model's `verbose_name` / `verbose_name_plural` are deliberately **not**: `Note` and
`Notes` already exist as msgids meaning "Notatka" (call sheet) and "Uwagi" (a casting remark), so
adding them bare would merge three unrelated concepts onto two keys. They stay untranslated, which
costs nothing — `Note` is not registered in the admin, by the same rule as settled decision 1.

## Verification

- Backend: `ruff` + `mypy` on `core`; new `backend/core/test_notes.py` (`APITestCase`, literal URL
  strings, a `UserProfile` created alongside each user — permissions read `user.profile.role`).
  Cases that matter: cross-user read returns 404; cross-user replay of a known id returns 403;
  same-user replay is idempotent; `done_at` is set and cleared on the transition; the retention
  task deletes only rows past the window.
- Frontend: `npm run typecheck`, then `npm run build` before the stage is called done.
- `make migrate` is a manual step in every environment, including production.
- UI is reviewed by the developer in their own browser.

## Deviating from this spec

The spec is binding for the implementation stages. Anything it puts under **Out, deliberately** was
rejected with a reason, not overlooked — due dates, reordering, assignment and project links are
not improvements to add in passing. If a stage hits something the spec does not cover, report it
and stop; do not resolve it by widening the feature.
