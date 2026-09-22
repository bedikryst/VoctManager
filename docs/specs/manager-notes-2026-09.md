# Personal notes — specification

Status: **Stage 1 (backend) built, audited and committed (`3bcb9ad`). `make migrate`
(`core/0027_note`) has been run on dev only; staging/prod still pending. Stage 2 (frontend) built
2026-09-22, audited 2026-09-22 (the audit failed it), remediated the same day, then reviewed by the
developer in a browser and reworked a third time (composition and type scale — see "Stage 2 — third
pass") — uncommitted, and that third pass is itself unreviewed. Three deviations from the letter of
this spec, plus three places where the spec's own premise turned out to be wrong.**
Written 2026-09-22 from Florent de Bazelaire's request ("a mini notepad / to-do list — somewhere to
jot: call X, write to X, remember Y").

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
- **An offline write must reach the editor as a success.** `onError` keeps the optimistic patch and
  queues the write, but the mutation promise still rejects — and `InlineEditable` reports a rejected
  `onSave` as a failure and stays in edit mode. So a body edit with no signal announced that it had
  failed, in the one scenario this whole design exists for. `useSaveNoteBody` is the seam: it
  swallows exactly `isLikelyOfflineError` and rethrows everything else, so a real 400 or 404 still
  shows its message. The offline semantics stay in the api layer, not in the row.
- **A failed list read must not render as an empty notepad.** `isError` with nothing cached gets its
  own `StatePanel` (`tone="danger"`). "Nothing here" is a statement about the reader's own notes, and
  by this spec's own argument a scratchpad that makes it once stops being consulted. No retry button:
  `RECONCILING_REFETCH` re-reads on focus, reconnect and next mount.
- Bump the query cache buster (DTO change).
  **Deviation, 2026-09-22:** not bumped, deliberately. `["notes"]` is a new key, so no persisted
  snapshot can hold a stale shape of it — the bump would evict every *other* feature's offline
  snapshot to fix nothing. This item is the checklist being followed by rote; the rule it comes from
  (`reference_query_cache_buster`) is about a *changed* DTO.

### Row

- Collapsed: `line-clamp-2` on a `Text` from `shared/ui/primitives/typography`, with `leading-snug`
  restated (the cva compound variant sets line-height, and clamping needs it explicit) and
  `whitespace-pre-wrap`. Parent flex child needs `min-w-0`, as every row in this codebase does.
  **Not** the single-line `truncate` prop — one line cuts a typical note mid-phrase and forces a
  expand on nearly every row, which defeats the mechanism.
- Expanded: full body, plain, with the edit and delete actions on a bar beneath it. Delete is
  reachable only from the expanded state — four targets in a 44 px row is one too many on a phone.
  **Superseded 2026-09-22, third pass.** This read "full body plus an inline editor
  (`shared/ui/primitives/InlineEditable.tsx`)", and the primitive grew a `multiline` prop to serve
  it. The developer's browser review called the result what it was: three surfaces stacked — a
  clamped preview, a hover-lit display button, a narrow textarea with its actions beside it — at
  three different type scales. `InlineEditable` is a "fix a typo in a title" primitive: inline,
  baseline-aligned, actions beside the value. A note body is a block. The editor now lives in
  `features/notes/` (`NoteField`, plus the row's own commit path) and `multiline` is reverted out of
  the shared primitive, which retires deviation 2 below.
- **Expanded is a state of the PANEL, one row at a time.** `NotesPanel` owns `expandedId`; any click
  that reaches the panel — the composer, the background, the gap between two notes — folds the open
  row back to its clamp. A row that has something to say about a click stops it before it gets
  there, and that is the whole mechanism.
- **One type scale for the body, `NOTE_TEXT`, and it is the FIELD's scale** (`FIELD_TEXT_SCALE.sm`
  — 16px on touch, 14px behind `fine-pointer`), worn by the clamp, by the expanded body, by the
  editor and by the editor's mirror. Reading size is writing size, or every edit begins with the
  text resizing under the caret. It cannot go below 16px on a touch device: iOS magnifies the whole
  app the instant focus lands in a smaller field and a standalone PWA never zooms back out. So
  "make the editing text a pixel smaller" is not available on a phone; the reading text moved up to
  meet the field instead, which is also the cheaper half of the open question about letter size.
  **Build note, retired:** `InlineEditable` was single-line only (`<input>`, Enter always commits — an HTML
  input cannot hold a newline at all, including a pasted one). That is incompatible with "line
  breaks preserved," so it gained a `multiline` prop (`<textarea>`, Enter inserts a newline,
  Ctrl/Cmd+Enter commits, blur still commits) rather than the note row hand-rolling a second editor.
  Scoped and additive — `InlineEditableProps` only grew a prop, the existing single-line behaviour
  and `InlineEditable.test.ts` are untouched — but it is a change to a shared primitive outside
  `features/notes/`, done without stopping to ask, so it is named here explicitly.
- **Hit areas:** the row is the expand toggle, so it is a `role="button"` carrying its own controls.
  Keyboard activation goes through `onActivate` from `shared/lib/dom/a11y.ts` — the SSOT for exactly
  this shape — which acts only on a keystroke aimed at the row itself. A hand-rolled `onKeyDown`
  gets this wrong in both directions: it misses Space (a `role="button"` owes both keys) and it
  fires on Enter bubbling up from the checkbox, so one keypress both ticks the note and folds the
  row. The checkbox and the delete button stop their own *click*; nothing wraps the body in a
  `stopPropagation` div — `InlineEditable` already swallows the click on its own control, and such a
  wrapper eats the whole line, which is the largest target the row offers. `aria-expanded` on the
  row, `aria-pressed` on the checkbox.
- Expansion animates **two** `grid-template-rows: 0fr ↔ 1fr` tracks in opposite directions at once —
  the preview closing as the editor opens — so the row's height moves continuously. One track plus a
  conditional render (the first build) snaps the preview away before the editor has grown, and shows
  both at once on the way back.
  **Correction to this spec:** the reason given here for not using framer-motion ("restricted to
  transform/opacity, cannot animate height") is false — `features/archive/components/PieceRow.tsx`
  animates `height: 0 → auto` under `AnimatePresence`. The CSS grid is kept anyway, because it needs
  no exit animation to keep the outgoing track measurable, but the stated reason was not the reason.
- The closing track carries `inert`. `overflow-hidden` hides a collapsed editor from the eye only:
  without `inert` every collapsed row leaves its editor and its delete button in the tab order and
  in the accessibility tree, so twenty notes are forty invisible tab stops, the delete action this
  spec puts behind expansion is reachable from the keyboard at all times, and a screen reader reads
  each body twice (clamped preview, then full text).
- Done rows: struck through, moved to a collapsed "Completed" disclosure below the open ones.

### Composer

- Always at the **top** of the panel, never the bottom: a bottom-anchored composer collides with
  the iOS keyboard inset, which is a solved-but-fragile area of this app.
- **Enter submits, and the field takes no newline at all** — that is what enforces the front-loaded
  first line that makes `line-clamp-2` readable. Multi-line detail is added later, in the expanded
  row's editor.
  **Corrected 2026-09-22, third pass:** this said "single-line input
  (`shared/ui/primitives/Input.tsx`)", conflating "no newline" with "one visible line". An `<input>`
  scrolls sideways, so a capture longer than the field could not be read back before it was
  committed. It is now the same growing `NoteField` the row editor uses: it wraps and grows to about
  eight lines, and `Enter` is still swallowed unconditionally (Shift+Enter included), so nothing
  multi-line gets in behind the clamp.
- Autofocus on every open that proves a physical keyboard is present, and on no other.
  **Superseded 2026-09-22** (developer's call): this originally read "only when the panel was opened
  by the explicit 'new note' action". Too narrow — pressing "n" or reaching for the shell icon *is*
  the intent to write, and landing in a panel that then needs a second click to start typing is a
  wasted step. What the old rule was really protecting against is the on-screen keyboard eating a
  third of a phone screen, and that maps to the input device, not to which button was pressed.
  So: the "n" hotkey and the `DesktopSidebar` icon both open-and-focus; the mobile dock's button
  opens plain. No media query is needed for this — pressing "n" proves a hardware keyboard, and the
  sidebar icon only renders under `fine-pointer`. The two surfaces are already the right two.
- Carried as a **latch** on the panel context (`pendingCompose` + `consumePendingCompose`), not as a
  counter the composer compares against its own first render. Below `wide-shell` the panel lives in a
  `BottomSheet`, which unmounts its children when closed, so the composer mounts *fresh* on that
  open: a counter it has never seen is indistinguishable from one it has already consumed, and the
  field never takes focus on a phone. The latch is dropped on close as well as on use, so it cannot
  steal focus on a later plain open.

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
  **352px wide (`w-88`), widened from 280px on 2026-09-22** — the first width was a phone's column
  parked on a desktop, and a note that wraps four times in the rail wraps once in a browser. The
  number is stated twice, here and as `PINNED_PAD` (352 + the 16px inset) in `useNotesPin.ts`; they
  have to move together or the pinned rail overlaps `<main>`.
- Collapse animates **`clipPath` only**, so nothing reflows:
  `inset(0px 0px 0px 100% round 2.5rem)` collapsed → `inset(0px 0% 0px 0px round 2.5rem)` open, with
  the sidebar's spring (`stiffness: 400, damping: 40, mass: 0.8`). Children fade with
  `initial={false}` on opacity, and the card carries `inert` while collapsed.
  **Correction to this spec:** the collapsed inset was originally specified as
  `calc(100% - 88px)`, transcribed from `DesktopSidebar`. It does not carry over. The sidebar's 88px
  sliver holds the logo and the nav icons; this rail has no permanent content, so the same number
  leaves an empty marble column parked over the right edge of every panel page ≥60rem — and because
  `clipPath` clips hit-testing along with paint, that column also swallowed every click landing in
  it, including onto the rail's own invisible close and pin buttons sitting in the top-right corner.
  Collapsing to zero width is the fix; the developer chose it over giving the sliver content
  (2026-09-22).
- `inert` while collapsed, not `aria-hidden`. The panel stays mounted — the composer has to survive a
  plain open with its draft — and `aria-hidden` on a subtree whose children are still focusable is
  the wrong half of the job. `inert` takes the subtree out of hit-testing, the tab order and the
  accessibility tree at once (see `shared/ui/primitives/inertSurface.ts`, which states the rule).
  The sidebar does not need this because its collapsed content is genuinely reachable; it settles for
  `pointer-events-none`.
- `useNotesPin` copies `useSidebarPin` exactly: `localStorage` key `voct.notes.pinned`, and it is
  the **only** writer of a `--rail-pad` custom property on `document.documentElement`.
- `<main>` in `DashboardLayout.tsx` currently ends its fine-pointer rule with `fine-pointer:pr-6`.
  That is the slot: `wide-shell:pr-[calc(var(--rail-pad,0px)+1.5rem)]`. The two pad variables are
  independent; the left one is untouched.
- Pin toggle is the same `Tooltip` + `aria-pressed` button with the rotating `Pin` icon.

### Entry points

- **Command palette.** `CommandItem` already supports `run?: () => void` as an alternative to `to`.
  Add a dedicated `useMemo` section rather than loosening the required `to` on `COMMAND_ACTIONS`.
  **Correction to this spec:** the theme rows are *not* the precedent for leaving the palette open.
  A theme repaints the page behind the dialog, which is the only place it can be judged; the notes
  panel is a surface of its own, and the palette is a full-screen `z-focus-trap` overlay — the rail
  (`z-60`) opens *underneath* it, invisible, while the palette keeps the keyboard and the autofocus
  lands in a field nobody can see. On mobile both sit at `z-focus-trap` and fight. `CommandItem`
  therefore gained `closeOnRun?: boolean`; the notes row sets it, the theme rows do not.
- **Shell icon** in `DesktopSidebar` and the mobile nav trigger, with a quiet dot when open notes
  exist. A dot, not a count — a count turns a scratchpad into a source of pressure.
  **Build note:** `MobileNavTrigger`'s bar was already four role-scoped tabs + alerts + "More" in a
  `max-w-md` row; the notes tab makes seven. Nothing in the spec says where in that bar it goes, and
  the build did not resolve the crowding question — it added a seventh `flex-1` slot the same shape
  as the others and left the visual call to the developer's own review, per this project's
  verification policy (UI is judged in the browser, not by the agent). If it reads as cramped, the
  fix belongs here, not as a silent redesign.
- **`NotesPanelProvider`** mirrors `CommandPaletteProvider`: context
  `{ isOpen, pendingCompose, consumePendingCompose, open, openToCompose, close }`, a
  `useNotesPanel()` that throws outside the provider, and a global hotkey guarded by
  `isEditableTarget` so it does not fire while typing.
- **"n" opens; it does not toggle.** Pressing a letter to catch a thought and finding the panel gone
  instead is the wrong half of a toggle — and with the rail pinned a toggle is invisible anyway,
  since `isExpanded` is `isOpen || isPinned` and the keypress only flips a flag nothing reads.
  Escape and the close button are the way out. (This also retires the "pinned rail makes 'n' look
  dead" item.) There is no `toggle` on the context: nothing called it once the hotkey stopped.

### Routes where the panel must not exist

The score stand and the PDF viewer compute their fit (auto / page / width / half) from the real
viewport width. A pinned rail there would make that arithmetic wrong, not merely cramped. The
provider renders no rail on those routes — suppressed, not hidden.

**Closed 2026-09-22.** `shared/lib/dom/fullscreenSurface.ts` is the signal the note below said did
not exist: a module counter, a `useFullscreenSurface(isOpen)` that registers a viewport-owning
surface, and an `isFullscreenSurfaceOpen()` the hotkey reads at the keystroke. `PdfViewerModal`
registers, which covers the score stand, the score book and the document preview in one line.
Deliberately **not** reactive (the only caller is a keydown handler) and deliberately **not**
`useBodyScrollLock`, which measures a different thing: `PdfViewerModal` is a `fixed inset-0` surface
that never takes that lock, while half the app's ordinary drawers do. Register a surface here only
if it fills the viewport *and* computes from its width — that is what makes a panel over it wrong
rather than merely untidy.

**Build note — the original gap, kept for the reasoning.** The standalone PDF viewer
(`/documents/:docType/:docId`) is a sibling route of the dashboard shell, never nested under
`DashboardLayout` — so `NotesPanelProvider`, mounted inside that layout, is structurally absent
there with no suppression code needed. The score stand is different: `ScoreStandModal` opens as
local component state on an **unchanged URL** (no route, no search param), so a route check cannot
see it — and this codebase has no shared "a fullscreen modal is open" signal to check instead
(confirmed by search before writing this: `useBodyScrollLock` tracks a module-level counter but
does not expose it reactively; nothing else in `shared/` does either). Building one was judged to be
outside this stage's scope. What ships instead: the rail's `z-60` sits under the score stand's
`z-90` (`--z-focus-trap`), so it cannot show through even while mounted underneath. The gap that
remains is narrow but real — pressing "n" while the score stand is open opens the notes sheet/rail
on top of it, at the same `z-focus-trap` layer as the score stand's own overlay on mobile. Left for
a follow-up rather than resolved by inventing new cross-cutting modal-tracking infrastructure here.

## What the interface says out loud

Three statements, each in the one place its question arises, and nothing else. No info icon, no
popover, no onboarding step — `project_onboarding_no_tours_2026-06` settled that. The test applied
was "what does it cost the reader not to know this", and only three things scored above zero.

- **Retention, under the expanded "Completed" disclosure.** The highest-cost silence in the feature:
  the purge is a *hard* delete with no bin and no export, and a reader who treats the done section as
  a record of what they got through this month loses it without ever being told. Only shown with the
  section open — in the empty state it would be noise.
- **Privacy, under the composer, in the panel body.** Not in the rail's header, because the phone
  never sees that header; not in a tooltip, because a touch device has no hover to reveal one. In a
  shell where every other surface shows the whole choir's data, the default assumption about a new
  tab is "shared until told otherwise", and the cost of that assumption is invisible — people do not
  stop using the notepad, they stop writing the things it was built for.
  **The claim is product-level and must stay that way:** no manager and no superuser reads these
  through the API, and `Note` is deliberately not registered in the admin. That is what "only you"
  can honestly mean. Never "nobody has access", never anything implying encryption — the database
  and the backups exist, and this is the kind of sentence someone will one day ask you to defend.
- **The "n" key, in the sidebar icon's tooltip**, following `SHORTCUT_LABEL`'s precedent. A bare
  letter, so no platform split. Desktop only, since the tooltip's host only renders under
  `fine-pointer` — advertising a key on a surface that has no keyboard is worse than silence.

Everything else a reader works out by using it, and saying it would be condescending: that the
composer takes Enter, that a row expands, that edits save on blur, that capture works offline.

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

## Stage 2 — audit and remediation (2026-09-22)

The frontend was meant to run as three or four stages, the first by Sonnet 5 and the rest by Opus 5.
It was built as one pass instead, verified green (`typecheck`/`lint`/`build`) and **failed a
subsequent audit**. What "green" bought and what it did not is the useful part of this record: every
defect below compiles, lints and type-checks, and three of them are visible within a minute of
opening the panel in a browser.

**The pattern, stated once, because it is the thing to watch for next time.** The build copied the
shape of the nearest precedent — `DesktopSidebar` for the rail, the theme rows for the palette,
`useAnnotationMutations` for the queue — and dropped, in each case, the one line that was the reason
the precedent works. Four of the nine fixes are literally a line that exists in the file next door:
`pointer-events`/`inert` on collapsed chrome (`DesktopSidebar.tsx:198`), `onActivate` instead of a
hand-rolled `onKeyDown` (`shared/lib/dom/a11y.ts`, which exists *because* of this exact bug in
`PieceRow`), `inert` on a hidden subtree, and no `stopPropagation` wrapper around an `InlineEditable`.
Two of those traps are already written down in `.agent/memory/`. Copying a shape is not reuse.

Remediated, all in place: collapsed rail ate clicks and showed an empty column; the palette opened
the panel under itself; mobile autofocus never fired; Enter on the checkbox both ticked and folded the
row, while Space did nothing; collapsed rows kept their editor and delete button in the tab order;
the expand/collapse animation snapped; a failed read rendered as an empty notepad; an offline body
edit reported failure; select-all on a multiline body meant the first keystroke wiped it.

Also fixed, outside `features/notes/`: `InlineEditable`'s new `mt-1` on the pencil icon was
unconditional, which shifted it in all 17 call sites across the app. Now `multiline`-only. The other
shared-primitive change (`multiline` itself) stands as built and is deviation 2 below.

**Deviations from the letter of this spec — four as built, three still standing:**

1. Route suppression holds for the standalone PDF viewer (structurally absent) but not for
   `ScoreStandModal`, which opens on an unchanged URL. Unresolved by design — see the build note
   under "Routes where the panel must not exist". Pressing "n" over the score stand still opens the
   panel.
2. ~~`InlineEditable` gained a `multiline` prop.~~ **Retired 2026-09-22, third pass** — the prop is
   reverted and the primitive is back to its pre-notes shape, byte for byte in behaviour. The
   scratchpad's editor is `features/notes/components/NoteField.tsx`.
3. Mobile nav is now seven slots. The build added a seventh `flex-1` the same shape as the others and
   left the crowding to the developer's own review, per the verification policy.
4. The query cache buster was not bumped — see the reason under "Queries".

**Corrections to this spec itself, three**, each marked inline where the wrong claim was: framer-motion
*can* animate height in this codebase; the theme rows are *not* a precedent for keeping the palette
open; the sidebar's 88px collapsed sliver does *not* carry over to a rail with no permanent content.

None of this widens the feature. The model, the permissions and the **Out, deliberately** list are
exactly as specced.

**Second pass, same day**, after the developer reviewed the remediation in a browser and asked what
the interface should say for itself: the three statements under "What the interface says out loud",
the "n" hotkey turned from a toggle into open-and-focus, the shell icon likewise, and the score-stand
gap closed with `fullscreenSurface.ts` — which was a precondition, not a bonus: advertising a key
makes its one known misfire common.

**Closed by inspection 2026-09-22, two of the four — both were non-problems:**

- *Offline queue labels are hardcoded Polish.* They are, and it does not matter: **nothing renders
  `QueuedWrite.label`.** The shell surfaces `pendingCount` (a number) and `useOfflineSync` toasts two
  fixed sentences. The field's own docstring claimed a "sync indicator" that does not exist and has
  been corrected to say so, because the next reader would otherwise have translated four features'
  worth of dead strings. The real opportunity it names — making the rejection toast say *what* was
  rejected — is a feature, not this feature's debt.
- *Notes have no `meta` echo, unlike annotations' `pendingMarks`.* Deliberately not built. The echo
  exists for annotations because a score page is redrawn from the server's answer, so a pending mark
  has nowhere else to live. A note's list **is** the query cache, and the cache is persisted, so an
  offline note survives a reload without one. The gap it would close is narrower than it first looked:
  a *rejected* replay, which is already a toast (`summary.rejected > 0`), for a write whose only
  realistic rejection is a 500 — the body is client-validated and the id collision is
  cryptographically absurd. A mirror of `pendingMarks` to cover that is more machinery than the risk.

**Settled by the developer 2026-09-22, the last two of that round** (the third pass below opened one
more, on resting type size):

- *The cost of `useNotes()`.* **Accepted as is — do not "optimise" this later.** The traffic is one
  small GET per panel entry plus one per window focus, per user. Note the correction: the shell's dot
  is not what drives it — on `wide-shell` the rail keeps `NotesPanel` mounted even while collapsed,
  so the query is live whatever the nav bars do. The two ways to cut it both cost something visible:
  unmounting the panel on close loses a half-typed draft (and leaves the rail's collapse animation
  running on empty content), and dropping the dot removes the notepad's only reminder that it exists.
  The list is a few unpaginated rows for a choir of a few dozen. Trading a visible thing for an
  invisible saving is the wrong trade here.
- *Palette ordering.* "Nowa notatka" stays at the top of the resting action list. Quick capture is
  what a command palette is for.

## Stage 2 — third pass, the developer's browser review (2026-09-22)

Six observations, all about the panel as an object rather than about what it does. Five were
straightforwardly right and are fixed; the sixth could not be granted as asked and was answered
sideways. What each one turned out to be:

1. *"The editing text is slightly too big — shrink it a pixel."* Not available on a phone: below
   16px iOS magnifies the app and a standalone PWA does not zoom back out. The real defect was
   underneath it — the body was set at **three** sizes (clamp 14, expanded body 16, field 16/14),
   so every step of reading and editing one note resized it. One scale now, `NOTE_TEXT`, and it is
   the field's. The visible consequence on a phone is that reading gets *bigger*, not the field
   smaller.
2. *"Wider on desktop, there is room."* 280 → 352px.
3. *"The tick and the cross should not be eating the field's width."* They were: `InlineEditable`
   lays its actions out beside the value, and in a 280px rail that left the textarea about 150px.
   Save and cancel are now labelled buttons on a bar below a full-width field.
4. *"Edit mode is shabby."* The diagnosis is under "Row" above — three stacked surfaces at three
   scales, two of them hover-lit. The row is now the only lit surface, and the expanded body is
   text rather than a button (a button there takes its accessible name from the note and announces
   it as "edit note", which is the one reading that loses the note; the pencil on the action bar
   carries the name and the keyboard path instead).
5. *"Expanding works, but a click anywhere else should fold it back."* Expansion moved to the panel
   — one row at a time, any click reaching the panel folds it. The first half of the request
   already held and still does: a collapsed row expands from a click anywhere on it, and only a
   body that is already whole opens the editor.
6. *"The composer should show what is being typed."* It wraps and grows now. See the correction
   under "Composer".

**Still open after this pass:** whether 14px is the right resting size for the panel on a desktop.
The recommendation from the previous session stands — do **not** add a size control to the notepad.
If the need turns out to be general, promote `features/messages/lib/messageTextScale.ts` to
`shared/` as one reading-size setting for the whole panel, in Settings. That is its own spec and its
own session; a feature-to-feature import is not an option here.

## Deviating from this spec

The spec is binding for the implementation stages. Anything it puts under **Out, deliberately** was
rejected with a reason, not overlooked — due dates, reordering, assignment and project links are
not improvements to add in passing. If a stage hits something the spec does not cover, report it
and stop; do not resolve it by widening the feature.
