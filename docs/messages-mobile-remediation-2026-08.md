# Wiadomości — audit and remediation (2026-08)

Status: **open** — audited 2026-08-29; stages 1–6 shipped the same day, `typecheck` + `build`
green, **not yet verified on a real phone**. Stage 7 (backend) is not started, and one item is
parked under Rejected (the compact `PageHeader`). · Surface: `frontend/src/features/messages/`
plus two shell seams (`index.html` viewport meta, `shared/lib/dom/`).

Reported symptom, from the developer's own phone: "za dużo, jak się wejdzie w wiadomość",
"kontenery zabierają szerokość", and — named as the worst of the three — "nie mieści się na
jednym ekranie".

## How to read this file

Seven stages. Stages 1–2 are one unit (the chassis and the keyboard it has to yield to);
3–6 are independent and can be taken in any order; 7 is backend and can wait indefinitely.
A stage is done when its **Exit** line is true.

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
  catches the *failed* query (`isLoading || !thread`), so a dead request holds it forever.
  `ConversationLoading` renders the back band above the loader, from the markup the loaded
  header uses, so the chrome does not jump when the data lands.
  **Still open:** that branch conflates "loading" with "failed". A conversation whose fetch
  errors should say so and offer a retry, not spin. `checking` is its own state — the design
  system's own rule, and this is the same defect it names on the activation screen.
- **Dropping the per-bubble sender name is only safe when there is one other person.** A 1:1
  thread left in the management queue can be answered by several conductors, and a
  `counterpart` of `null` renders as "Zarząd" — so the header names nobody and the bubbles
  would have named nobody either. `lib/messageRuns.ts` holds both predicates:
  `hasSeveralCounterparts` decides whether a thread borrows the channel's identity treatment,
  `startsSenderRun` decides which message inside a run carries it.

## Stage 7 — backend (not started)

`ThreadDetailSerializer` and `ChannelDetailSerializer` return the **entire** message list, and
`CONVERSATION_FRESHNESS` refetches it every 10 s. A project channel accumulates across a
season, so this is a monotonically growing payload on a phone's mobile data, re-fetched six
times a minute while the conversation is open. Wants a `?before=` page plus an incremental
`?since=` poll, and an infinite query on the client. Nothing in stages 1–6 depends on it.

---

## Rejected

- **A hand-rolled compact page header for the inbox.** The mobile `PageHeader` is ~155 px
  (21% of the screen) for a title the nav dock's active tab already states, because
  `rightContent` drops to its own row below `md`. The fix is a `size="compact"` variant on the
  shared `PageHeader` — additive, opt-in, no effect on the other ~20 callers — not a private
  copy in `features/messages`. Left open deliberately; it is the smallest remaining win and
  the one with blast radius outside this feature.
- **Hiding the nav dock from the shell on the messages route.** The portal already covers it
  and needs no new shell rule. A route-aware dock is a shell-wide mechanism bought for one
  screen.
- **A focus trap on the conversation surface.** It is a route, not a dialog, and the inbox
  behind it is `display: none` — there is nothing left to trap focus away from.
