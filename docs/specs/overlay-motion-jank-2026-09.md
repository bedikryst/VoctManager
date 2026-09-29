# Overlay motion on a phone — why every sheet, drawer and menu stutters (2026-09)

Status: **open** — stages 1–3 implemented 2026-09-29, not yet checked on the phone. Stage 0
(the developer's, on the phone) has no recorded result; stages 4–5 wait for it and for the
phone check of 1–3. See **Implementation notes** at the end for where the build departs from
the text.

Successor to `frontend-performance-remediation-2026-08.md`. Its conclusion (paint/composite-bound,
not re-render-bound) still holds; this file is about what its method could not see.

Reported symptom: on a phone the panel feels laggy — most of all dropdown menus and every
modal or panel that opens, closes, expands or collapses.

## Why three passes did not find it

1. **Fixes went to the instance, not the pattern.** August stage 2 changed two things on the
   mobile menu only — the scrim's blur (2.1) and a scroll lock that released mid-exit (2.3). The
   lock defect is still live in 16 other overlays driven by an `isOpen` flag, including the two
   shared primitives (`BottomSheet`, `ConfirmModal`) most modals route through. Whether 2.1's blur
   was ever a real cost was not measured; stage 0 and the nav-scrim restore in 1.1 test it.
2. **"Transform/opacity only" was checked as a property name.** framer-motion runs `x`, `y`,
   `scale` and `height` as JavaScript on the main thread, writing `style.transform` every frame.
   Only `opacity`, `transform` (as a whole string), `filter` and `clipPath` are handed to WAAPI
   and run on the compositor. Every sheet and drawer entrance in the panel is a main-thread spring,
   and its first frames coincide with the frame that mounts the overlay's content — so it drops
   exactly the frames the eye watches.
3. **Blur was judged per element, never counted.** A `backdrop-filter` is recomputed every frame
   its region is damaged, and each blurred element is its own GPU pass that has to read back what
   is already drawn beneath it — on a phone's tile-based GPU, that readback is the expensive part,
   far more than the radius. One blurred layer is cheap, which is why a site with a frosted header
   does not stutter. An overlay here that fades or slides pays for every blur under it at once:
   the scrim, the drawer's own nested bars, and each blurred badge, tab bar and sticky header on
   the page behind. Several of those sit under a ≥ 90 % opaque fill and show nothing.

Nobody has recorded a trace on the device. Stage 0 is the cheapest possible substitute.

---

## Stage 0 — A/B on the phone, no code (developer)

A bookmarklet that switches every `backdrop-filter` off until reload:

```
javascript:(()=>{const d=document,i='vm-noblur',s=d.getElementById(i);if(s){s.remove();alert('blur: ON');return}const e=d.createElement('style');e.id=i;e.textContent='*,*::before,*::after{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}';d.head.appendChild(e);alert('blur: OFF')})()
```

Runs in a browser tab only (the installed app has no address bar). Open the same bottom sheet,
the same drawer (artist editor) and the same dropdown with blur ON, then OFF.

- **Clearly smoother with blur OFF** → blur contributes on this phone; stage 4 runs after 1–3.
- **No difference** → blur is harmless here and stage 4 is dropped; stages 2, 3 and 5 carry the
  fix, and stage 1 is hygiene.
  For the dropdowns specifically (their `popover-motion` is already CSS, on the compositor), the
  next suspect is Radix's modal mode: `pointer-events: none` on `<body>` plus an injected
  scroll-lock stylesheet restyle the whole document on every open and close. `DropdownMenu`
  accepts `modal={false}`; `Select` has no such switch. Unmeasured — not in any stage yet.

## Stage 1 — invisible blur off the overlays, visible blur kept

Rule (developer's call, 2026-09-29): blur that shows stays — the frosted scrims are the look.
Blur that cannot show goes: under a fill ≥ 90 % opaque, or over a backdrop that is the overlay's
own flat fill. Removing it changes no pixel and removes a GPU pass per element.

| # | Where | Change |
|---|---|---|
| 1.1 | Full-viewport scrims, 19: `BottomSheet:111`, `ConfirmModal:107`, `CommandPalette:299`, `PdfViewerModal:196`, `EditionUploadDrawer:55`, `AvatarEditorModal:264`, `CrewEditorPanel:106`, `LocationEditorPanel:117`, `ArtistEditorPanel:200`, `ArtistDossier:527`, `DocumentUploadModal:132`, `DocumentPreviewModal:54`, `CategoryFormModal:185`, `LegalModals:67`, `PushPermissionPrimer:91`, `ProjectInvitationToasts:109`, `DelegationBriefingModal:157`, `PublishProjectModal:112`, `AnnotationGuide:228` | **Stay as they are.** After stages 2–3 land, `MobileNavSheet:248` gets its pre-August scrim back (`bg-black/45 backdrop-blur-[4px]`) as the controlled test: if the menu stutters again with that single change, the blur is what costs on this phone |
| 1.2 | Popovers at /95: `DropdownMenu:48`, `Select:190`, `DateTimeField:327`; `CommandPalette:316` (/96); `Tooltip:79` (/90, also drop its `will-change-transform`); sticky bars at /92: `ListGroupHeader:44`, `FinanceShell` 139/152 | Drop `backdrop-blur-*` |
| 1.3 | Drawer surfaces at /95: `LocationEditorPanel:127`, `CrewEditorPanel:116`, `BottomSheet:137` (dark tone). Nested bars and cards whose backdrop is the drawer's own flat fill: `LocationEditorPanel` 131/158, `CrewEditorPanel` 120/144, `ArtistEditorPanel` 214/246, `ArtistDossier:542`. `NotificationCenter`: read its fill first | Drop. The sticky footers over scrolling form content (`LocationEditorPanel:333`, `CrewEditorPanel:248`, `ArtistEditorPanel:665`, `ArtistDossier:743`) keep theirs — the frost shows there, and it is one bar per drawer |

**Exit:** `rg "backdrop-blur" frontend/src` returns none of the 1.2/1.3 drop lines. Nothing in
this stage is meant to be visible: if a surface looks different afterwards, it was misclassified —
put its blur back.

## Stage 2 — overlay motion off the main thread, lock released after the exit

| # | Change |
|---|---|
| 2.1 | Every overlay entrance/exit that springs `x`, `y` or `scale` (drawers: `ArtistEditorPanel:206`, `ArtistDossier:533`, `LocationEditorPanel:123`, `CrewEditorPanel:112`; sheets: `BottomSheet:129`, `MobileNavSheet:275`; then `rg "initial=\{\{[^}]*\b(x\|y\|scale)\b"` over the remaining overlay files) animates `transform` as a string instead — `initial={{ transform: "translateX(100%)" }}` → `"translateX(0%)"`. Same spring; Motion converts it to `linear()` easing for WAAPI |
| 2.2 | A draggable sheet (`BottomSheet`, and `MobileNavSheet` if it drags) cannot do 2.1 on the dragged element: an explicit `transform` overrides the `y` that drag writes. Split it — the entrance/exit on a wrapper, drag keeps `y` on the sheet inside |
| 2.3 | `useBodyScrollLock`: read `window.innerWidth - documentElement.clientWidth` **before** writing `overflow`; when it is 0 (every phone — overlay scrollbars), skip both `getBoundingClientRect` reads and the padding payback. The measurement exists for a classic scrollbar a phone does not have |
| 2.4 | The lock's lifetime becomes the overlay's, as in `MobileNavSheet`: `useBodyScrollLock(true)` inside the component `AnimatePresence` keeps mounted, not `useBodyScrollLock(isOpen)` above it. Shared primitives first (`BottomSheet`, `ConfirmModal`), then the rest of the `useBodyScrollLock(` call sites. Page-level locks (`ArtistManagement:155`, `CrewManagement:85`, `LocationsManager:104`) move into the panel they are locking for |

**Exit:** during a drawer's slide in desktop devtools, `document.querySelector('[role=dialog]').getAnimations()`
is non-empty (the proof it is WAAPI, not JS). Motion must read the same; the spring constants do
not change.

## Stage 3 — the mobile menu's opening frame

`useCommandItems` builds `sources` when `MobileNavSheet` mounts, i.e. on every open, in the same
frames as the sheet's spring: it folds diacritics over every project, every artist and the whole
piece archive. The resting menu (empty query) shows actions, favourites, recents and navigation
only — artist and piece rows are unused until the first keystroke.

Split `sources`: project/nav/action rows stay eager (favourites and recents need `projectById`);
artist and piece rows are built only once the query is non-empty. Keep the queries' `enabled`
as is — the fetch on open is what makes the first keystroke instant.

## Stage 4 — permanent in-flow blur (only if stage 0 shows blur costs, and 1–3 did not cure it)

The same law as GlassCard's 2026-06 decision, on everything that pass did not reach. Each one
re-blurs on every scroll frame (the ambient field is `fixed`, so the backdrop moves under it) and
under every overlay animation above it — this is the count that turns one cheap scrim into a
stack. Primitives multiply by count, so they come first: `Badge` (two variants), `Button:38`,
`RouteTabs`, `ProjectTabs`, `ArchiveTabs`, `TimelineProjectCard:173` (one per card),
`KineticActionCue`, `fieldShell` `dark`. Then sticky and fixed bars: `Schedule:240`,
`MiniPlayerBar`, `RehearsalDock`, `BulkActionBar`, `PieceBulkBar`, `SelectionBar`, `FeedbackDock`,
`OfflineStatusBadge`; the loading veils `PieceRowTracks:383`, `LocationMapPicker:467`.

Where the fill is < 85 % and content visibly scrolls beneath (sticky tab bars), dropping the blur
is a visible change: raise the fill instead, and list each one for the developer's eye.

**Stays:** `GlassCard variant="surface"` and the PDF / score chrome (`PdfViewer`, `PdfBottomNav`,
`PdfOutlineDrawer`, the annotation bars), which float over a real document.

## Stage 5 — collapsibles that animate `height` (ordered by stage 0)

Motion animates `height: "auto"` in JavaScript, and each frame is a document relayout plus a
re-raster of everything below the expanding block. Sites: `TimelineRehearsalCard` 439/460 (inside a
`layout` wrapper at 189), `TimelineProjectCard:639`, `NextEventHero` 719/759, `RehearsalInspector:479`,
`RehearsalPage:532`, `PieceRow:402`, `ComposerRow:287`, `ArchiveSearchBar:158`, `SecurityTab` (4),
`GeneralTab:140`, `LogisticsTab:72`, `AuthAlert:31`.

**Decision for the developer** — recommended: on the long lists (timeline, archive rows, the hero)
the height snaps and the revealed block arrives by `opacity` + a small `y` on the compositor, the
panel's no-travel law applied to disclosure; the light settings forms keep the glide. Rejected in
advance: CSS `grid-template-rows: 0fr → 1fr`, which is still a relayout per frame.

Separately, a `layout` wrapper around a card whose own content resizes (`TimelineRehearsalCard:189`)
should be `layout="position"`: the list reflow is all it exists for.

## Decisions, settled

- **`backdrop-filter` law** (developer's call 2026-09-29). Blur is paid per blurred element under
  whatever animates, not per radius. Blur that shows — a scrim, a translucent surface over content
  that differs beneath it — is a design choice and stays. Blur that cannot show — under a fill
  ≥ 90 %, or over an overlay's own flat fill — is removed. An overlay carries at most its scrim
  plus one bar.
- **"Transform" in the motion rule means compositor-driven.** Overlay entrances and exits animate
  `transform` or `opacity` as WAAPI (Motion with a `transform` string, or CSS keyframes like
  `popover-motion`). framer's `x`/`y`/`scale` stay legitimate for drag and gesture-driven motion,
  which must track the finger on the main thread anyway. When stage 2 lands, the Motion bullet in
  `AGENTS.md` says so.

## Implementation notes (2026-09-29, stages 1–3)

- **WAAPI proven outside the app.** framer-motion 12.38 in headless Edge, same versions as
  `frontend/node_modules`: during an entrance, an element on a `transform` string has one running
  animation on `transform` with a `linear()` easing; its twin on `x` has none and tracks the same
  curve from JavaScript. Exits the same, with `circIn` handed over as `cubic-bezier`. The CSS
  keyframes fallback was not needed. The stage 2 exit check in the app's devtools is still open.
- **Rest pose is the identity string, never `none`.** Motion rebuilds a `none` keyframe from the
  template with every number zeroed, which turns `scale()` into `scale(0)`. The rules live in
  `shared/ui/kinematics/motion-presets.ts`.
- **Modals that relied on framer's defaults** (`ConfirmModal`, `AvatarEditorModal`) name them:
  `OVERLAY_POP_TRANSITION` is framer's `y` spring and `opacity` ease written out. `scale` moves on
  the `y` spring, where it used to be critically damped: an overshoot of about 0.6 %.
- **Beyond the listed sites.** `EditionUploadDrawer` animated `right` (a relayout per frame) and
  now slides on `transform`, over its own width instead of the viewport's. `NotificationCenter`'s
  touch sheet and `LocationSheet` drag, so they are split like `BottomSheet`. `LocationSheet`
  starts one viewport below its peek, as before, expressed as a share of its own height.
- **Swipe-dismiss holds the sheet where it was released.** The drag's snap-back is stopped, so it
  does not pull the sheet up against the exit, and the next open resets the offset.
- **2.4:** the lock is `<BodyScrollLock />` inside the `AnimatePresence` subtree. `LocationsManager`
  keeps a page-level lock for the desktop rail detail only, because that detail is no overlay.
- **Dropped with their blur:** `Tooltip`'s `will-change-transform`. `NotificationCenter` has no
  blur to drop: its panel is opaque and its scrim is 1.1.
- **1.1 control test in place:** the `MobileNavSheet` scrim is `bg-black/45 backdrop-blur-xs`
  (4 px).
