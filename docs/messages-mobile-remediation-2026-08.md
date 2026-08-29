# Wiadomości — audit and remediation (2026-08)

Status: **closed** — audited 2026-08-29; all nine stages shipped that day. Stages 1–6 were
confirmed on the developer's own phone; stages 7–9 were verified at 390 × 844 with a coarse
pointer against stubbed fixtures (see *Verification of stages 7–9* at the end), which found and
fixed two defects. · Surface:
`frontend/src/features/messages/` plus four shell seams (`index.html` viewport meta,
`shared/lib/dom/`, `shared/ui/composites/PageHeader.tsx`,
`shared/ui/composites/DropdownMenu.tsx`) and `backend/messaging/`.

Reported symptom, from the developer's own phone: "za dużo, jak się wejdzie w wiadomość",
"kontenery zabierają szerokość", and — named as the worst of the three — "nie mieści się na
jednym ekranie".

## How to read this file

Nine stages. Stages 1–2 are one unit (the chassis and the keyboard it has to yield to);
3–6 are independent and can be taken in any order; 7–8 were found while building those and
9 answers what stage 4's fixed 16 px could not. A stage is done when its **Exit** line is true.

The developer verifies every visual change in their own browser. `npm run typecheck` +
`npm run build` green is the automated bar (see `CLAUDE.md`).

---

## The measurements this pass is answering

Taken 2026-08-29 by reading the code, on a 390 × 844 phone (iPhone 14, standalone PWA), the
manager view — the manager's five triage filters are the worst case; a chorister has two.

### Vertical: the page is 67–92 px taller than the screen

`MessagesPage` reserved `13rem` (208 px) for everything above and below the conversation card:

```
<div className="flex h-[calc(100dvh-13rem)] min-h-115 gap-4">
```

The actual chrome:

| band | px |
|---|---|
| `main` `pt-5` | 20 |
| `PageHeader` (eyebrow + `mb-4` + h1 3xl + `gap-6` + button row + `mb-6`) | ~155 |
| `main` `pb-nav-dock` = `--nav-dock-h + 1.5rem` | 100 (126 with a home indicator) |
| **total** | **275–301** |

Deficit **67–93 px**, which is exactly the clipped composer and the "WYŚLIJ" button sitting
under the nav dock.

The same constant is wrong in the other direction on a desktop, where the chrome is
`pt-6` (24) + a one-row header (~70) + `pb` (24) = **118 px** — so `13rem` also wasted ~90 px
of dead band under the card on every large screen. One magic number, two opposite errors.

`min-h-115` (460 px) made it worse rather than better: on a 667 px viewport it beats the
`calc()` and forces the overflow instead of relieving it.

### Horizontal: a message body gets 55% of the screen

```
390  viewport
-32  main px-4
 -2  GlassCard border
-40  ThreadView px-5
=316 → ×0.78 (max-w-[78%]) = 246 → −32 (bubble px-4) = 214 px of text
```

214 px of 390. Three nested paddings, none of which says anything on a phone. WhatsApp on the
same device gives ~300 px.

### Type: you write at 16 px and read at 12 px

- Composer: `Textarea` → `fieldShellVariants` → `FIELD_TEXT_SCALE.sm` = `text-base` on
  touch = **16 px**.
- Message body: `<Text size="sm">` → `text-xs` = **12 px**.

The one piece of content the screen exists for was set in the smallest body step the system
has — below the panel's own default (14 px) and four steps under what produced it.

---

## Decisions, settled (do not re-open)

- **The bubble language stays.** `ethereal-gold/12` mine, `alabaster/70` theirs, the gold
  hairline, the calm asymmetry — the design system's "deliberately NOT a loud chat-bubble
  aesthetic" is not the defect. What is being replaced is the **chassis**: on a phone a
  conversation is a full-screen surface with three fixed bands, not a card floating inside a
  padded page under a page header. Take WhatsApp's chassis; do not take its skin.
- **The viewport-locked height comes from the tokens, not from a number.**
  `h-[calc(100dvh-var(--nav-dock-h)-3rem)]` is the house pattern — `ArchivePieceCardPage`
  already uses it and its comment names the old MessagesPage `dvh` line as what it was
  derived from. `--nav-dock-h` is `0px` on a fine pointer, so the one expression is correct
  on both modalities. Everything above the panes (the `PageHeader`) lives INSIDE that box as
  a `shrink-0` flex child, so its height is subtracted by flexbox and never guessed.
- **`MessagesPage` does not get `PageTransition`,** and that is not an oversight.
  `PageTransition`'s wrapper is `w-full min-h-screen`; inside it a viewport-locked page can be
  scrolled ~120 px up and down behind a card that is supposed to be pinned.
  `ArchivePieceCardPage` — the only other viewport-locked page — omits it for the same reason.
  If a viewport-locked page is ever to have an entrance, the fix is a `PageTransition` variant
  without `min-h-screen`, not a per-page workaround.
- **Triage lives in one overflow menu, at every width.** Claim / release / resolve are
  occasional actions on a conversation, which is what `DropdownMenu` is documented for. The
  old `TRIAGE_ACTION_CLASS` (`gap-0 px-3 sm:gap-2 sm:px-5`, labels hidden under `sm`) was a
  header trying to carry two labelled buttons beside a name and losing. `z-popover` (95)
  outranks `z-focus-trap` (90), so the menu renders above the full-screen surface.
- **The conversation's mobile surface is a route, not a dialog.** It is portalled and covers
  the dock, but the back arrow and the hardware back button both work through the router. It
  takes `z-focus-trap` because that is the rung for "a surface the member opened", and it
  locks body scroll because iOS rubber-bands the document behind a fixed overlay.

---

## Stage 1 — the chassis

**Why.** Fixes the overflow, the wasted desktop band, the page header that stays on screen
inside a conversation, and two of the three nested paddings.

1. `MessagesPage` root becomes the viewport-locked flex column described above; `PageHeader`
   moves inside it as `shrink-0`; the pane row becomes `min-h-0 flex-1`. `13rem` and
   `min-h-115` are deleted.
2. New `components/ConversationSurface.tsx` — on a phone (`< md`) the open conversation is
   rendered through `<Portal>` as `fixed inset-0 z-focus-trap`, three bands, safe-area aware,
   body scroll locked. On `md+` it renders its children inline and the existing `GlassCard`
   pane is unchanged.
3. On a phone with a conversation open, `PageHeader` and the pane row are `hidden` — the
   surface owns the screen. Nothing paints or takes focus behind it.
4. `ThreadView` / `ChannelView` drop `px-5` to `px-3 sm:px-5` on the header and the stream.
5. Filter tabs: `wrap` becomes `wrap={isDesktop}`. Five wrapped segments were three rows and
   ~118 px of a 720 px card; one horizontally scrollable row is ~42 px. `wrap` stays on the
   desktop's 340 px column, which is what it was added for (a hidden horizontal scrollbar is
   undiscoverable with a mouse and natural with a thumb).

**Exit.** On a 390 × 844 phone nothing is clipped and nothing scrolls behind the conversation;
on a desktop the card reaches the bottom of the viewport with a 24 px gutter.

## Stage 2 — the keyboard

**Why.** Even with stage 1 correct, iOS does not shrink the layout viewport when the keyboard
opens, so a composer pinned to the bottom of a `100dvh` surface is behind it. There is no
`interactive-widget` in the viewport meta and no use of `visualViewport` anywhere in the repo.

1. `index.html`: `interactive-widget=resizes-content` on the viewport meta. Android/Chrome
   then shrinks the layout viewport itself and `dvh` is already right.
2. New `shared/lib/dom/useKeyboardInset.ts` — a ref callback that publishes
   `--keyboard-inset` on the node from `window.visualViewport`
   (`innerHeight − (vv.height + vv.offsetTop)`, floored at 0). It writes a CSS custom property
   rather than returning state: the value changes on every frame of the keyboard animation and
   nothing above it needs to re-render.
3. `ConversationSurface` wears
   `pt-[env(safe-area-inset-top)] pb-[max(var(--keyboard-inset,0px),env(safe-area-inset-bottom))]`.
   The two mechanisms compose: with `resizes-content` the inset computes to ~0 and the
   `dvh` box has already moved, so nothing is counted twice.

**Exit.** On iOS standalone and on Android Chrome, focusing the composer leaves it flush above
the keyboard with the last message visible.

## Stage 3 — the conversation header and the composer

1. Header: back · avatar · **one non-wrapping line** of identity (subject over
   `person · project chip`, each `truncate`) · one `⋯` menu. `flex-wrap` on the identity row
   is what let "Michał Jan Barański" break onto two lines; the two triage buttons beside it
   were ~100 px of the ~230 px that line had.
2. New `components/MessageComposer.tsx`, shared by both views (the two were a copy of each
   other). It brings: `resize-none` (a drag handle in the corner of a composer is a desktop
   artefact), auto-grow from one row to six, and a 44 px round-cornered icon Send on touch
   with the word kept behind `fine-pointer:`.

**Exit.** The identity line never wraps at 320 px; the composer is one row tall when empty and
grows as you type.

## Stage 4 — type and width

1. `MESSAGE_BODY_TEXT = "text-base fine-pointer:text-sm"` — 16 px on touch, the panel's dense
   14 px with a mouse. Same shape as `FIELD_TEXT_SCALE`, and for the same reason: you must not
   read a message smaller than you typed it. It is applied as a `className` over `Text`'s
   default, so if it is ever dropped the fallback is 14 px, not 12.
2. `max-w-[78%]` → `max-w-[86%] sm:max-w-[78%]`. 78% is a desktop rule: on a 800 px pane it
   stops a bubble becoming a band; on 390 px it spends 22% on nothing.
3. A 1:1 thread drops the gutter avatar and the per-bubble sender name. The header already
   names the one other person, and the asymmetry already says who spoke — 36 px of width and a
   line of type for a fact stated twice above.

**Exit.** A message body is ~300 px wide at 16 px on a 390 px phone.

## Stage 5 — one grammar for a message

`ChannelView` drew its own row: full-width, bordered, avatar in a gutter on **every** message,
`is_mine` distinguished only by fill. The same object had two shapes inside one feature.
Channels now render `MessageBubble` with the same asymmetry, plus what a group actually needs:
the sender named on the first message of each run (a 13-person channel repeating the same name
down twelve rows is noise), and the pin control in the bubble's own meta row.

**Exit.** A channel and a thread are visibly the same object; consecutive messages from one
sender name them once.

## Stage 6 — behaviour

1. **Sticky-bottom scroll** (`lib/useStickyScroll.ts`, shared): auto-scroll only when the
   reader is already within 120 px of the bottom, and always after their own send. The old
   effect fired on every change of `messages.length`, and the conversation polls every 10 s —
   so reading history was interrupted by being thrown back to the newest message.
2. **`clearSelection` replaces instead of pushing.** `navigate("/panel/messages")` left
   `[…, list, thread, list]` in the history, so the hardware back button after using the
   in-app back arrow re-opened the conversation just left.
3. The `FeedbackDock` conflict resolves itself: the ambient column sits at
   `--nav-dock-h + 2.25rem`, which is inside the old composer band and outside the new
   full-screen surface (the surface is above it and covers it).

**Exit.** Scrolling up during a poll stays put; hardware back from a conversation reaches the
inbox, not the conversation.

## Found while building stages 1–6 (both shipped)

- **A full-screen loader has to carry its own exit.** `ThreadView` / `ChannelView` returned a
  bare `EtherealLoader` while the history was in flight. In a pane beside an inbox that is
  fine; owning the whole screen it is a screen with no way out — and the same branch also
  caught the *failed* query (`isLoading || !thread`), so a dead request held it forever.
  `ConversationGate` renders the back band above either state, from the markup the loaded
  header uses, so the chrome does not jump when the data lands. **Closed** by the same
  component: `checking` and `failed` are now separate branches, the second a `StatePanel`
  with `refetch`. The gate opens on `!thread` — having NOTHING — and not on `isError`: a
  conversation polls every 10s from a phone in a lift, and a failed poll over a history
  already on screen must leave the history alone.
- **Dropping the per-bubble sender name is only safe when there is one other person.** A 1:1
  thread left in the management queue can be answered by several conductors, and a
  `counterpart` of `null` renders as "Zarząd" — so the header names nobody and the bubbles
  would have named nobody either. `lib/messageRuns.ts` holds both predicates:
  `hasSeveralCounterparts` decides whether a thread borrows the channel's identity treatment,
  `startsSenderRun` decides which message inside a run carries it.

## Stage 7 — the payload

**Why.** `ThreadDetailSerializer` and `ChannelDetailSerializer` returned the **entire** message
list and `CONVERSATION_FRESHNESS` refetched it every 10 s: a monotonically growing payload on a
phone's mobile data, six times a minute, for as long as the conversation stayed open.

1. `selectors.paginate_messages` windows a conversation three ways — the tail (50), one page
   walked back from `?before=<message id>`, or the delta after `?since=<instant>`. A delta
   longer than a page is refused and answered with the tail plus `reset: true`, because
   appending it would leave a hole in the middle of the conversation.
2. The detail serializers take that window from the view's context and never read the
   `messages` relation; `GET …/messages/?before=` serves a window on its own (the same route
   the reply POSTs to).
3. `pinned_messages` becomes its own field. An announcement pinned in March is exactly what
   the channel banner is for, and it stopped being reachable from `messages` the moment
   `messages` became a tail.
4. **The cache — not the last response — now holds the conversation.** `lib/conversationWindow`
   folds every window into what the client has: the poll asks with the newest CONFIRMED
   message's stamp, ids are keyed with the server's copy winning, order comes from parsed
   instants (an ISO stamp either side of a DST change does not sort lexically), and an
   optimistic send is carried through untouched and always last — a poll landing mid-flight
   must not make the reader's own text blink out. Its rollback is by id, never by restoring a
   snapshot that a poll may already have overtaken.
5. `QUERY_CACHE_BUSTER` is bumped: a restored pre-window snapshot paints before any fetch can
   correct it, and the banner would read `pinned_messages` off an object that has none.
6. "Wcześniejsze wiadomości" is a button, not a fetch-on-scroll — inside a portalled surface
   the reader cannot reach the top of a day without triggering a request they did not ask for.
   `useStickyScroll.anchorTop` holds their line in place while the page grows above it; Safari
   implements no scroll anchoring of its own.

**Exit.** An open conversation transfers a handful of rows per poll instead of its whole
history, and older history is reachable without losing the reader's place.
`backend/messaging` tests + `lib/conversationWindow.test.ts` cover the windowing arithmetic.

## Stage 8 — the compact page header

A `size="compact"` variant on the shared `PageHeader`: below `md` the title and its one action
share a row, the eyebrow and its rule step aside (the nav dock's active tab already names the
section), and the title drops one step of the scale. From `md` up it IS `standard` — a page
must not read as two different pages across a breakpoint. Additive and opt-in; the other ~20
callers are untouched. ~155 px of a 844 px phone becomes ~45 px.

**Exit.** The inbox header is one row under a thumb and unchanged on a desktop.

## Stage 9 — reading size

**Why.** In a standalone PWA there is no browser chrome, so no page zoom and no `aA` menu, and
iOS Dynamic Type does not reach web content. On the one screen in the panel that is pure
prose, the member has no way at all to make the text bigger. Stage 4 set it at 16 px on touch;
that is a good default, not an answer for everyone.

1. **Reading size is writing size.** The composer scales with the bubbles. Stage 4's rule —
   never read a message smaller than you were allowed to type it — is the whole reason this
   feature has a type scale of its own.
2. **Three steps, not a slider, with the default in the MIDDLE.** 14 / 16 / 18 px on touch,
   12 / 14 / 16 with a mouse. A slider on a 390 px screen spends a drag target inside a
   scrolling stream on six distinguishable positions. (This points the opposite way to the
   annotations pen, where a slider replaced four steps — pen width is a continuous physical
   quantity, type size is a scale.) The steps first shipped as 16 / 18 / 20, i.e. the default
   AT THE FLOOR, and the reader who finds 16 px too large — the developer, on their own
   phone — had no move to make. A scale that only corrects upwards is half a control.
3. **Set where the problem is felt**, i.e. the conversation's own `⋯` menu — which means that
   menu stops being manager-only in `ThreadView` and gains an equivalent in `ChannelView`.
   Not app settings: you adjust reading size while reading. The menu holds a radio group and
   **stays open** on a pick (`DropdownMenuRadioItem keepOpen`) — a size is chosen by
   comparing — and each entry is drawn at the size it sets.
4. **Mechanism**: `lib/messageTextScale.ts` — one custom property on the conversation root,
   persisted per device. Per device and not per account on purpose: it answers a screen and an
   eye, and the same person wants 14 px on a laptop and 18 px on a phone.
5. **Scope is the conversation only.** Scaling `html { font-size }` would move every
   viewport-locked box in the panel, which is a shell-wide change bought for one screen.

**Exit.** A member can raise the conversation's type in three steps from inside it, the
composer follows, and the choice survives a reload on that device.

Three things came out differently from the proposal above, each for a reason worth keeping:

- **The variable carries the STEP, not the size.** `--message-text-step` is an offset
  (`0px / 2px / 4px`) and `MESSAGE_BODY_TEXT` stays a pair:
  `text-[length:calc(1rem_+_var(…))] fine-pointer:text-[length:calc(0.875rem_+_var(…))]`.
  An absolute `--message-text` would have had to carry the touch/pointer split in JS, where
  stage 4 deliberately put it in CSS. As an offset, the split stays a fact about the device and
  the step stays a choice about the reader, and an unset variable renders exactly stage 4's
  default.
- **The 16 px iOS floor lives on the COMPOSER, not on the scale.** iOS magnifies the page when
  a focused field is under 16 px and, in a standalone PWA, never zooms back out
  (`FIELD_TEXT_SCALE` in `fieldShell.ts` says why). While the smallest step was the default,
  the floor and the scale were the same thing; once the scale reaches below the default they
  part, so `MESSAGE_COMPOSER_TEXT` is `MESSAGE_BODY_TEXT` with `max(0px, …)` around the step
  on the touch branch alone. "Reading size is writing size" survives in the direction it was
  written for — nobody reads a message smaller than they were allowed to type it.
- **The store is external (`useSyncExternalStore`), not a hook's state.** `MessageComposer`
  measures its own height and has to re-measure when the scale moves; a prop whose only job is
  to say "re-measure" is a prop the next call site forgets. `useStickyScroll` gained a second
  argument for the same reason — the browser keeps `scrollTop` through a reflow, so a reader
  sitting at the newest message is quietly left behind it unless the pin decision is made again.
- **`messages.thread.actions` became `messages.conversation.actions`** ("Opcje rozmowy"). The
  trigger is no longer a manager's triage button a chorister never sees; it is the one overflow
  menu a conversation has, and a channel mounts it too.

**The trap, for whoever writes the next `text-[length:…]`.** tailwind-merge resolves a
font-size as owning the line-height — `Typography.tsx` already says so about cva's compound
variants. Replacing the field shell's `text-base` in the composer therefore deleted its
line-height too, and a `leading-normal` written BEFORE the size class in the same `cn()` is
deleted by it in turn. The leading has to be unitless (so it follows the step) and has to come
after the size.

---

## Verification of stages 7–9

Run at 390 × 844 with a coarse pointer, against fixtures (140 messages, `has_older` true,
a 46-character project name) since the API windowing is the thing under test and a stubbed
one answers `?before=` and `?since=` exactly as the real one does. Both defects below were
invisible to typecheck, lint and the suites, and neither was in the code the stages changed.

**Green as specified.** "Wcześniejsze wiadomości" holds the reader's line to within 1 px
(the message being read sat at y=173, and at y=172 after 50 messages landed above it);
`useStickyScroll.anchorTop` measures distance-from-the-END, so nothing that changes height
above the reader can move them. The reading size moves the bubbles and the composer together,
the menu stays open on a pick, each entry is drawn at the size it sets, the reader keeps their
place at the newest message across the reflow, and the choice survives a reload.

**Defect 1 — the channel header spent its width on a monogram.** At 390 px the project name
had 146 px of a 390 px row: back arrow 36 + avatar 48 + bell 44 + `⋯` 44 + four gaps + padding
left that and no more, so "Koncert Bożonarodzeniowy w Bazylice św. Krzyża" read as "Koncert
Bożonarod…". The avatar is a monogram GENERATED FROM the string standing next to it — unlike
a thread's, which is a person's face — so on the phone surface it was 60 px spent restating
the one line the header exists for. `hidden md:inline-flex`: gone exactly where
`ConversationSurface` is mounted, kept in the desktop pane. The title goes 146 → 206 px.

**Defect 2 — the composer measured itself at the size the reader had just left.** The field
sets its own height from `scrollHeight` in a layout effect, but `fieldShellVariants` carries
`transition-all duration-300`, so the new font-size arrived over 300 ms while the measurement
was taken at commit: raising the reading size left the composer at its old height (50 px
against a 54 px line box) until the next keystroke, and lowering it left the field 6 px too
tall. Fixed where the scale is already overridden, not in the shared shell — the composer
narrows its own `transition-property` to what the shell actually animates plus the height it
sets itself, so the type metrics land instantly and the effect reads the truth.

---

## Rejected

- **An infinite query on the client for the windowed history.** It would have rebuilt the
  optimistic send, the sticky scroll and the persister contract around `{ pages, pageParams }`
  to express one cursor the cache already holds. Folding each window into a flat cached list
  (stage 7.4) keeps every component that reads `messages` untouched.
- **Hiding the nav dock from the shell on the messages route.** The portal already covers it
  and needs no new shell rule. A route-aware dock is a shell-wide mechanism bought for one
  screen.
- **A focus trap on the conversation surface.** It is a route, not a dialog, and the inbox
  behind it is `display: none` — there is nothing left to trap focus away from.
