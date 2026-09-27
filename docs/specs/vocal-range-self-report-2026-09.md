# Vocal range — self-reported by singers

Status: **Stage 1 (backend) built, audited and committed 2026-09-27: model, service, endpoint,
serializer exclusions, rollout flag, GDPR export and erasure, tests. Migration `roster/0065` not
yet run on prod (`make migrate`). Stages 2 and 3 (shared foundations, the singer's screen) built
2026-09-27 and audited the same day; every audit item fixed 2026-09-27 (see "Audit of Stages 2–3"
under Stage 3); typecheck, lint, tests and build green; committed 2026-09-27. The developer has
seen the first pass on dev (desktop and phone width, dark theme); the second pass is not yet seen.
Stage 4 (the conductor's view) and Stage 5 (microphone) built 2026-09-27 in parallel, audited the
same day ("Audit of Stages 4–5" under Stage 5). Items 1–5 (the microphone stops on every path)
fixed 2026-09-27 and pinned by `usePitchDetection.test.tsx`; typecheck, lint, tests and build
green; committed 2026-09-27 with both stages. Items 6–9 and 11–13 fixed and committed 2026-09-27
(97889e00), not seen; 14 decided (kept as is); 10 waits on the developer. Nothing tried on an
iPhone yet. The developer's look at the prompt on dev (2026-09-27, desktop, dark) asked for the
"Polish pass" below: committed 2026-09-27 (9d7e7273) and seen on desktop. His one remark, that
the mic button ended the capture on its own a moment after the tap, led to "Sing" / "Done"
(under Stage 5): built 2026-09-27, typecheck, lint and tests green, not committed, not seen.
Next: his look at the mic on the laptop, commit, then decide 10, then the iPhone dry run (list
under the audit).**
One stage per session. When a stage lands, update this line and say whether it is committed,
migrated and seen in the browser.

## Why

The conductor wants every singer to propose their own range. New accounts see the prompt at first
login. Existing accounts see it the next time they open the panel. A PWA session lasts weeks, so
the trigger is the panel open, never the login. The conductor's brief, in the conductor's own
notation:

    a (g) – a² (c³)
    a – a²      tessitura: where the voice works freely and naturally IN THE ENSEMBLE
    (g) (c³)    optional extremes: reachable, but only loud; piano impossible, sound forced

High notes matter most for sopranos and tenors, low notes for altos and basses (for those, both
ends).

## Thesis

The singer writes their range in the conductor's notation, `a (g) – a² (c³)`. They write it by
touching keys that sound, not by typing note names, because typed names are where the errors
happen:
- "A1" is 55 Hz in international notation, but a¹ is 440 Hz in Polish notation;
- tenors read a treble-8 clef an octave above the pitch they sing;
- some digital pianos label middle C as "C3".

A key that sounds settles all three. The conductor's definitions head the screen. Their criterion
for the extremes (piano impossible, sound forced) is how the singer sorts a note into the
tessitura or into the parentheses.

## Facts the design rests on (binding)

- `Artist.vocal_range_bottom/top` (`backend/roster/models.py`) is the **conductor's own
  assessment**: free text, max 5 characters, SPN placeholders. It is under a hard privacy rule: it
  never reaches any chorister, whether about themselves or about anyone else. The singer's proposal
  lives in **separate fields** and never overwrites these.
- `ArtistBasicSerializer` and `ArtistMeSerializer` are built with `exclude`, so **every new Artist
  field reaches every chorister through Basic unless it is excluded explicitly.**
- Only `user_is_manager` gets `ArtistDetailedSerializer` (`ArtistViewSet.get_serializer_class`).
  Rehearsal delegates do not. The on-screen promise "other choristers will not see it" depends on
  this. A test must hold it.
- Phone speakers do not reproduce a pure sine below about 200 Hz. The existing kamerton tones are
  sines, so a bass's E2 would be inaudible. The keyboard needs a tone rich in harmonics.
- On iOS an active microphone ducks playback. Listening and playing never overlap.
- `shared/lib/audio/toneContext.ts` is the only tone context. Open it synchronously in the gesture
  and pair it with `releaseToneSession`. See the context's header for the iOS reasons.

## Data model

On `Artist` (roster). All pitches are **MIDI numbers**; notation is presentation only.

| Field | Type | Meaning |
|---|---|---|
| `proposed_tessitura_low` / `_high` | `PositiveSmallIntegerField(null)` | required pair when submitting |
| `proposed_extreme_low` / `_high` | `PositiveSmallIntegerField(null)` | optional; null = nothing beyond the tessitura |
| `vocal_range_comment` | `TextField(blank)` | singer's note to the conductor, max 500 (DTO) |
| `vocal_range_proposed_at` | `DateTimeField(null)` | set on every submit; null = prompt pending |

Validation (`VocalRangeProposalDTO`, `extra="forbid"`):
- every value is in 21–108;
- `tessitura_low < tessitura_high`;
- `extreme_low ≤ tessitura_low` and `extreme_high ≥ tessitura_high` when set.

Only singing voice types (`SINGING_VOICE_TYPES`) may submit.

## Stage 1 — backend (roster, core)

- The fields above, created via `makemigrations` (roster).
- `VocalRangeService.submit_proposal(artist, dto)` in `roster/services.py`. Resubmission
  overwrites and restamps.
- `PUT /api/artists/me/vocal-range/` as an `ArtistViewSet` action beside `me`. It is for the
  authenticated artist only.
- Serializers:
  - **Basic**: add all six fields to `exclude`.
  - **Me**: keeps them, because it is the singer's own proposal. `vocal_range_bottom/top` stay
    excluded.
  - **Detailed**: lists them in `fields` and `read_only_fields`, so a manager cannot rewrite the
    singer's words.
- GDPR export (`core/services.py`, user data export) includes the proposal and comment. GDPR
  erasure (`roster/signals.py`) clears all six fields; the conductor's `vocal_range_bottom/top`
  stay.
- `PUT me/vocal-range` answers in the shape `me` answers for the same reader: Me for a singer,
  Detailed for a manager.
- **Rollout flag.** The setting `VOCAL_RANGE_PROMPT` is read from the environment (root `.env`,
  which reaches the `web` container through `env_file`). It takes three forms:
  - `off` is the default;
  - `all`;
  - a comma-separated list of user IDs.

  It is exposed as a read-only computed `vocal_range_prompt_enabled` on the user's own profile
  payload, next to `welcome_seen_at` (`UserProfileSerializer`). It gates only the frontend
  surfaces; the endpoint stays open, because only an artist can write their own proposal anyway.
  Tests cover `off`, `all`, a list, whitespace, and a malformed entry, which is ignored rather
  than crashing.
- Tests:
  - validation matrix;
  - non-singer rejected;
  - Basic and the documents my-ensemble payload carry none of the fields (extend the existing
    `sight_reading`/`vocal_range` assertion in `documents/tests.py`);
  - a non-manager rehearsal delegate cannot read another singer's proposal;
  - Me carries the proposal and never `vocal_range_bottom/top`.

## Stage 2 — shared foundations (frontend, domain-free)

- `shared/lib/music/pitchNotation.ts`:
  - `midiToScientific`: `A4`, sharps, consistent with `PitchPipe`;
  - `midiToPolish`: Helmholtz `C₁ C c c¹ c²`, with `h` = B, `b` = B♭, `cis/dis/fis/gis`;
  - `midiToFrench`: `la3` = A4, `do3` = middle C;
  - `midiToHz`;
  - `notationForLanguage` (pl → Polish, en → international, fr → French);
  - `formatVocalRange(range, notation)` → `a (g) – a² (c³)`, omitting null parts.

  A vitest suite pins the conductor's example in all three notations: `a (g) – a² (c³)`,
  `A3 (G3) – A5 (C6)`, `la2 (sol2) – la4 (do5)`. It also pins the traps: A1 = A₁ = 55 Hz, and
  middle C = C4 = c¹ = do3.
- `shared/lib/audio/voicedTone.ts`:
  - additive tone, harmonics 1–8 at amplitude ~1/n;
  - envelope: ~20 ms attack, ~300 ms release, ~1.4 s;
  - `playArpeggio(midis)` and `playVoicedTone(midi)`; both return null when nothing was
    scheduled (no Web Audio, or no pitches), and then `onEnded` never fires;
  - runs on `toneContext`.
- `shared/ui/instruments/VerticalKeyboard.tsx`:
  - vertical piano (high at top) that scrolls inside a height the caller gives it. Every key is
    rendered, not windowed: the file header says why;
  - props `low/high`, `notation`, `label` (accessible name), `bands` (tint on the keys: tessitura
    stronger, extremes fainter), `emphasis` (keys outside it dimmed), `activeKey`, `liveCursor`,
    `centerRequest` (`{ midi, seq }`, scrolled to the middle: instantly the first time, smoothly
    after), `onKeyPress` (fired inside the click, so a scroll never sounds a note);
  - every white key carries its name in the reader's notation, faint, each C stronger; a key's
    aria-label is the spoken form (`spokenPitch`: `a razkreślne`, `C sharp 4`);
  - keys in `piano-ivory` / `piano-ebony`, which dim on dark but never invert; motion on
    transform/opacity.

## Stage 3 — the singer's screen (`features/vocal-range/`)

**When it shows:**
- `profile.vocal_range_prompt_enabled` (the rollout flag);
- singing voice type;
- `vocal_range_proposed_at` is null;
- `welcome_seen_at` is set;
- not in preview (`?artist=`);
- not snoozed this session.

For a new account it follows `WelcomeMoment` directly: dismissal → `refreshUser()` → this screen,
in the same nave scenography. "Later" snoozes for the session through a small module store, and
the screen returns at the next app open. It never blocks the panel.

**Takeover coordination:** `features/dashboard/hooks/useFirstRunTakeover()` returns
`"welcome" | "vocal-range" | null`. `DashboardLayout` (install prompt) and
`ProjectInvitationToasts` read it instead of `welcome_seen_at`, so two takeovers never stack.

**The screen — the line is the form:**
- Head copy (Polish primary; the conductor approves it in the dry run):
  > Jaka jest Twoja tessitura w śpiewie zespołowym?
  > To informacja dla dyrygenta. Pozostali chórzyści jej nie zobaczą. Dźwięki skrajne w nawiasach
  > są opcjonalne.

  The first draft explained what a tessitura is and what the parentheses hold. The developer
  struck it: the readers are trained singers, and explaining their own craft to them reads as
  condescending. The copy states the purpose, the privacy, and the one rule of the form.
- Four tappable slots, set large in the reader's notation: `[a] ([g]) – [a²] ([c³])`. The
  tessitura slots are required; the extreme slots are optional.
  Decide how the octave marks render before building the slots. `¹ ² ³` are Latin-1 and inside
  the self-hosted font subsets. `⁴ ⁵ ₁ ₂ ♯` are not: the `unicode-range` in `index.html` stops at
  U+206F, so they fall back to a system face, and a large `c³` beside `c⁴` shows it. Either extend
  the subsets or set the marks as `<sup>`/`<sub>` from plain digits.
- Tap a slot, then a key. The key sounds and fills the slot. The keyboard opens centred on the
  voice's middle:

  | SOP | MEZ | ALT | CT | TEN | BAR | BAS |
  |---|---|---|---|---|---|---|
  | a¹ | f¹ | d¹ | e¹ | a | f | d |

  It shows the voice's usual solo range and a fifth beyond it on each side (`keyboardWindow` in
  `constants/voices.ts`), widened to any note already chosen, never past G1–C7.
- **Note readout** for the touched key, on the status line under the slots, always in all three
  notations: `A4 · a¹ · la3 · 440 Hz`.
- **Range in the other notations**: a live table of the two notations the reader does not use;
  the reader's own is the slot line (polish pass, item 10). There is no British row, because
  British usage writes pitch as the international or the Helmholtz row does.
- **Comment** (optional, max 500).
- The table, the comment and the send button arrive with the first note.
- **Privacy** is in the head copy ("Pozostali chórzyści jej nie zobaczą"). It deliberately does
  not list who does see it; its truth rests on only managers getting `ArtistDetailedSerializer`.
- "Wyślij dyrygentowi" plays `playArpeggio` over the chosen notes, then sends the PUT.

**Re-entry:** a quiet "Moja skala głosu" row in `settings/components/GeneralTab.tsx` opens the
same screen with the saved values and comment. The singer sees only their own proposal. The row
exists only while the flag is on for that user.

**Dry run for non-singers:** the same Settings row appears for a user with the flag on and no
singing artist profile, such as the developer or the conductor. It opens the screen with a voice
picker (the seven singing types) in place of the singer's own voice. Everything works: keys,
sound, the table, the comment and the mic. There is no send button; one line over the voice
picker says "Tryb próbny: nic nie zostanie zapisane" (trial mode, nothing is saved). This is how the screen gets
tested on a real iPhone on prod before any singer sees it, and how the conductor approves the
copy.

**Also in this stage:**
- `AuthUser` maps the new Me fields.
- i18n in pl/en/fr.

**Decided while building (do not undo without a reason):**
- **Octave marks and ♯.** The subsets carry none of `⁴ ⁵ ₁ ₂ ♯` and no `sups`/`subs` features,
  so widening `unicode-range` would change nothing. On screen, `PitchName` sets every octave mark
  (¹²³ included) as `<sup>`/`<sub>` of plain digits and draws ♯ as an SVG; after `f`/`F` the mark
  stands off further, because Cormorant's f overhangs into it. `formatPitch` keeps the Unicode
  forms for plain text; aria-labels use `spokenPitch`. All three spell through `spellPitch`.
- **No gendered forms.** The copy is written neutrally in all three languages. `salutation` is
  documented in Settings as used only in e-mail and notification greetings, and tying UI copy to
  it would break that promise.
- **No `QUERY_CACHE_BUSTER` bump.** Only `AuthProvider` reads `/api/artists/me/`, into React
  state; no persisted query changes shape, and a bump would cost every device its offline
  snapshot for nothing.
- **Mounted in the panel shell**, not on the artist dashboard: the prompt is due on whatever route
  the panel opens at, and `useFirstRunTakeover` has to describe what is really on screen. The
  preview route is excluded by path (`ARTIST_PREVIEW_ROUTE`). `DelegationBriefingModal` yields
  to the takeover as well.
- **Send button** plays every chosen note, lowest first, not only the tessitura.
- **Keyboard window per voice.** The usual solo range ± a fifth, not the whole G1–C7. The
  developer asked for a shorter keyboard; a 10 % margin was considered and rejected, because on a
  two-octave range it is two semitones, which cuts off exactly the extremes the conductor wants
  and strands a voice filed a class off in the roster. The window also sizes the slots, so they
  are narrower than a whole-piano reservation would make them.
- **The readout lives on the status line under the slots**, not merged into the table card as S4
  proposed: item 6 needs it there on the phone, and one place on every width beats a readout that
  moves between breakpoints. The card holds the table alone and arrives with the first note, with
  the comment and the send button after it. The trial notice sits over the voice picker, since
  the trial has no footer.
- **Dimming covers the tessitura pair too.** While a tessitura bound is selected and the other is
  set, the keys on the wrong side of the other are dimmed, by the same rule as the extremes
  (`slotSpan`). Dimmed keys still sound and still fill the slot.
- **Slot sizes.** The tessitura is 36 px on a phone, 48 px from `sm`, 60 px on `lg`; the
  extremes are 22, 30 and 36 px. With four equal slots, 36 px needed ~350 px for a Polish line
  and wrapped on the developer's phone, so the phone size was 30 px until the polish pass set the
  extremes smaller. French names are the widest and may still wrap on a narrow phone, always
  before the dash.
- **The welcome is route-aware (item 13)**, not mounted in the shell: it greets by the vocative
  that only the home dashboard loads. `useFirstRunTakeover` answers "welcome" only on `/panel`.
- **The keyboard's overscroll is not contained.** At either end a swipe carries on into the page,
  since on a phone the keyboard fills the screen below the slot strip.
- **The snooze lasts 12 hours** and is rechecked when the page becomes visible
  (`lib/vocalRangeSession.ts`, which also keeps the unsent draft).

### Audit of Stages 2–3 (2026-09-27) — fixed 2026-09-27, not yet seen

Every item below is fixed in the working tree; the entries under "Decided while building" record
where a fix departs from the item's wording. Left for the developer's eyes: item 8 on a phone, the
two "Look at on dev" questions, and S1's ivory/ebony values in both themes.

Bugs:
1. `vocal_range.sent.body` names the wrong tab in all three locales ("Ogólne" / "General" /
   "Général"). The pane is `settings.sections.profile`: Profil / Profile / Profil.
2. Keyboard centring (`VocalRangeScreen.tsx`, `VerticalKeyboard.tsx`):
   - revisit opens on the voice centre, not on the selected slot's saved note;
   - selecting an empty slot leaves the keyboard where it is, so the high slot opens on the low
     register just chosen;
   - re-selecting a slot whose note equals the current `centerKey` does nothing, because the
     effect's deps do not change.

   Make the centre a request (`{ midi, seq }`). Centre an empty slot on the voice centre, shifted
   toward its side. Scroll smoothly after mount; stay instant on mount and under reduced motion.
3. No focus trap. The screen is `aria-modal`, yet Tab walks into the panel behind it. Use
   `shared/lib/dom/useFocusTrap`. `WelcomeMoment` has the same gap.
4. The draft is lost silently. Escape anywhere closes the screen, the comment field included, and
   in `prompt` mode it also snoozes. "Later" drops the chosen notes. Keep the draft for the session
   in the snooze store and restore it on the next open. Ignore Escape while the comment has focus.
5. The dark theme inverts the piano. `panel.css` `[data-theme="dark"]` swaps
   `ethereal-alabaster` and `ethereal-ink`, so the white keys go dark and the black keys go cream.
   The black keys must stay darker than the white keys in both themes.

Phone layout (the primary device):
6. The slots and the keyboard are never on screen together. On a ~390×750 viewport the header and
   the slot line end near 650 px, so the keyboard starts below the fold. Every note then costs
   tap slot → scroll down → tap key → scroll up. Below `lg`, make the slot line sticky at the top
   of the scroll container, with a one-line note readout under it, and give the keyboard the rest
   of the viewport (`dvh`). The table, the comment and the send button follow.
7. The layout shifts above the keyboard, under the finger:
   - the note card switches between a two-line hint and a one-line readout;
   - the order message (up to three lines) and the "remove extreme" button come and go in a
     `min-h-6` row;
   - long French or international names wrap the slot line.

   Reserve the heights so that nothing above the keys moves when a key is pressed.
8. On a phone the keyboard scrolls inside a scrolling page: a swipe on it moves the keys, not the
   page. Fix 6 largely removes this; confirm it on the phone.

Continuity and motion:
9. Going from the welcome to this screen flashes the dashboard. `WelcomeMoment.dismiss` fades out
   at once, and the prompt opens only after `markWelcomeSeen` and `refreshUser` return. The prompt
   then fades in and redraws the stave. When the prompt will follow, hold the welcome until the
   user is refreshed. Let the prompt enter over it with the scene already lit: no backdrop fade
   and no stave redraw.
10. State changes jump instead of moving:
    - a note snaps into its slot, the rail's bands jump, and the keyboard jumps on a slot change.
      Animate the slot value (opacity plus a short y), move the bands by transform (framer
      `layout`), and scroll smoothly (item 2);
    - add a brief press glow on a key, separate from the selected state;
    - while an extreme slot is selected, dim the keys on the wrong side of its tessitura bound, so
      the order errors become rare;
    - the rail is `w-14` for a 6 px bar, because Stage 5's markers are not used yet. Narrow it
      until they are.
11. The keyboard hides its scrollbar and gives no cue that it scrolls. Add a fade mask at the top
    and bottom edges.

Sound (`voicedTone.ts`):
12. With 1/n harmonics, only partials 3–8 of E2 survive a phone speaker. That is about 18 % of the
    tone's energy, roughly 10 dB under the pitch pipe. At the top the tone buzzes: C6 carries
    partials up to 8 kHz. Use a spectrum that depends on the register: flatter low, steeper high,
    with a few cached waves. Replace the linear decay with an exponential one
    (`setTargetAtTime`). Judge it by ear on an iPhone.

Smaller:
13. `useFirstRunTakeover` answers "welcome" on every route, but `WelcomeMoment` is mounted only on
    the artist dashboard. A new singer who opens the app elsewhere, from a push deep link for
    example, sees no welcome. The invitation modal, the install pill and now the delegation
    briefing all wait for it anyway. This predates the feature. Either make "welcome"
    route-aware, or mount the welcome in the shell.
14. The snooze lasts as long as the JavaScript page. An iOS PWA kept in memory can hide the prompt
    for days, and a desktop tab can hide it indefinitely. Bound the snooze in time and recheck it
    on `visibilitychange`.
15. Accessibility:
    - a key's `aria-label` is the Unicode `a¹`, which screen readers read inconsistently;
    - the slots use `aria-pressed` for a single choice; that is a `radiogroup`;
    - a filled slot is not announced.
16. Code placement:
    - `ALL_NOTATIONS` lives in `NoteCard.tsx`; move it to `pitchNotation.ts`;
    - the screen reads `dashboard.layout.roles.*` directly, where the welcome uses
      `artistRoleLabel`.
17. Copy and messages:
    - the trial notice uses "—" on the screen and ":" in the Settings row; pick one form;
    - "440 Hz" needs a no-break space;
    - the backend 403 `detail` is not wrapped in `_()`.

From the developer's screenshot (desktop, dark theme). These decisions take precedence over
items 5, 10 and 11:
- **S1. The piano is an object, not chrome.** Item 5 comes first: in dark the keyboard reads as a
  cream barcode. Give the keys colours that do not flip with the theme: ivory white keys and
  near-black black keys in both themes, one step dimmer in dark. New tokens go into
  `tailwindMerge.ts`.
- **S2. One axis.** The header is centred on the page, while everything under it sits in a 3/5 +
  2/5 grid, so the slot line centres about 200 px left of the title. Move the header into the left
  column, left-aligned. The keyboard then runs the full height on the right, from the eyebrow down
  to the button. Below `lg`, item 6 stands.
- **S3. The slots are the hero.** At their current size they read as punctuation: short blanks
  inside tall parentheses. Set the notes one Metric step up. Make each blank as wide as the widest
  name it can hold, so that filling a slot never reflows the line. Set the parentheses and the dash
  lighter than the notes.
- **S4. No empty furniture on first open.** Today four of the five left-column blocks carry no
  information: a hint card, a table of three "—", an empty textarea, and a disabled button with its
  hint. Instead:
  - the hint is one muted line under the slots, not a card;
  - the note readout and the range table merge into one card, which appears with the first note.
- **S5. No rail column.** Without bands it is a 56 px empty strip. Draw the range on the keys
  themselves: the tessitura tinted, the extremes fainter. The live cursor stays for Stage 5.
- **S6. Every white key carries its name,** faint, with the C's stronger. On a range picker the
  singer should know where their finger is without reading the card.

Before the dry run: an account whose artist has a singing `voice_type` gets the real prompt, not
the trial, and its send writes data. Check the developer's and the conductor's accounts.

Look at on dev (the code cannot settle these):
- the `g` descender and a `C₁` subscript against the slot underline (`leading-none`, `pb-1`);
- the 26 px black-key height under a finger.

## Stage 4 — the conductor's view

Status: **built 2026-09-27; typecheck, lint and its test green; committed 2026-09-27, not seen.** The
precedence rule lives in `features/artists/lib/vocalRangeProposal.ts` (`rangeShown`). On screen
the proposal is set with `VocalRangeText`; the cast row's meta line is plain text, so it uses
`formatVocalRange`. The editor labels the block "Propozycja chórzysty", not the bare "Propozycja",
because it sits directly under the conductor's own range fields.

- `ArtistEditorPanel`: a read-only block beside the conductor's range fields, shown only when a
  proposal exists: `Propozycja: a (g) – a² (c³) · 27.09.2026` plus the comment. Absence says
  nothing, so this stage needs no flag and can ship dark.
- `ArtistRow`, `ArtistCard`, `useCastTab.rangeOf`: show the conductor's own text when set.
  Otherwise show the formatted proposal, muted, marked "wg chórzysty".
- Proposals render in the reader's notation (`notationForLanguage`).

## Stage 5 — microphone: one held note per slot

The mic hears pitch, not ease. It names the note the singer chose to sing; it never decides a
tessitura edge.

- Dependency `pitchy` (McLeod pitch method). `shared/lib/audio/usePitchDetection.ts`:
  - `getUserMedia` with echo cancellation, noise suppression and auto gain **off**;
  - `AnalyserNode`, 2048-sample frames;
  - keep frames with clarity ≥ 0.9, inside the voice window (centre ± ~18 semitones, clamped to
    G1–C7). The window is the first defence against octave errors;
  - tracks stop on capture, cancel, unmount and `visibilitychange: hidden`.
- **Sing / Done** (a toggle; nothing depends on holding the button):
  1. Select a slot and tap "Zaśpiewaj". The mic stays open until "Gotowe".
  2. While the singer sings, the status line names the nearest note, live, and a cursor follows on
     the keyboard, which scrolls to keep it in view. Under the note, for as long as the mic is
     open, the privacy line: "Twój głos nie jest nagrywany ani nigdzie zapisywany. Nikt go nie
     usłyszy." (the developer's wording). The status line is 60 px tall on every width, which is
     that state on a phone (note plus two lines); "Usuń" steps aside while listening.
  3. A held note is ≥ 600 ms of the smoothed pitch staying within ±40 cents of the run's mean, so
     a run may span about 80 cents. It snaps to the nearest semitone and fills the slot at once,
     silently. Holding another note replaces it; a steady note is reported once.
  4. "Gotowe" **stops the mic, then plays the slot's note** inside that tap. Hearing it back
     catches octave errors by ear.
- The button is hidden where `getUserMedia` is missing. A refusal gets one line and no retry loop.
- Privacy line: nothing is recorded or sent.

**Built 2026-09-27 (committed 2026-09-27, not seen):**
- `shared/lib/audio/heldPitch.ts`: the hold rules, pure and clock-free, pinned by a vitest suite.
  `usePitchDetection.ts`: the capture. The mic button sits on the status line under the slots,
  icon-only on a phone; the listening text carries the privacy line.
- `infra/nginx/security-headers.conf` sent `microphone=()`, which refuses `getUserMedia` on prod
  before any prompt. It now sends `microphone=(self)`. The snippet is bind-mounted, so it takes
  effect when the `frontend` container is recreated (`make prod`).

**Decided while building (do not undo without a reason):**
- **The window is the keyboard's, not centre ± 18.** The mic listens in `keyboardWindow` (the
  voice's usual range ± a fifth, widened to the chosen notes). Centre ± 18 cut off a soprano's f³,
  and a note the keys cannot show would fill a slot the singer cannot see.
- **The ±40 cents apply to the pitch smoothed over 180 ms, not to raw frames.** A trained vibrato
  swings up to a semitone five or six times a second, so raw frames of a steady note never stay
  within ±40 cents; their average over one cycle does. A dropout under 150 ms does not break a hold.
- **The analysis runs on the one `toneContext`**, opened in the tap, so there is no second
  `AudioContext` on iOS.
- **The capture ends by itself** after 20 s with no voice, and after 2 minutes however much is
  sung, so a radio in the room cannot hold the mic open. If nothing was held, one line says so;
  otherwise the slot keeps its note and nothing plays, since no tap is under way. A refusal or a
  missing mic hides the button for the rest of the opening. A key press, a slot change, removing
  an extreme, a trial voice change, sending, closing the screen and hiding the page all stop it;
  of these only "Gotowe" plays the note back.
- **Toggle, not push-to-talk** (the developer's report, 2026-09-27: on a laptop the first held
  note ended the capture a moment after the tap, and "przytrzymaj" read as "hold the button").
  Holding the button while singing was rejected: on a phone a touch press does not unlock audio
  on iOS (only its release does), a long press invites the selection callout, and the first
  permission prompt lands under a held finger.
- **The playback follows the mic stop directly**, inside the "Gotowe" tap.
  `navigator.audioSession` is not touched. Whether iOS plays that note from the loudspeaker at
  full level, and not from the earpiece or ducked, is the first thing to check in the dry run.

### Audit of Stages 4–5 (2026-09-27) — all fixed or decided but 10

The invariant under audit: a microphone is never left live, on any path.

Microphone:
1. **A throw while wiring the graph leaves the mic live, with no control to stop it.** In
   `usePitchDetection.start`, the stream enters `capture` only after `createMediaStreamSource`,
   the analyser and the first frame are set up. If that block throws, `.catch` tears down the
   placeholder capture, whose `stream` is null, so the tracks are never stopped. The status becomes
   `unavailable`, which hides the button. No trigger is confirmed, and the code must not rely on
   there being none. Store the stream in `capture` first thing in `.then`, before any graph call.
2. **Closing the screen does not stop the mic.** `leave` stops the tone, not the capture, and
   `AnimatePresence` keeps the stage mounted through its 0.6 s exit fade, so the hook's unmount
   cleanup runs only after it. A hold completed in that window plays a note and changes a draft
   that `leave` has already kept. A close the parent causes (`open` turning false) skips `leave`
   altogether. Stop the capture when the exit begins (`useIsPresent()` in `VocalRangeStage`) and
   in `leave`.
3. `clearSlot` ("Usuń") does not stop listening, unlike every other control on the status line; a
   hold then refills the slot just cleared.
4. A track ended by the system (a phone call, Siri, a revoked permission) is not observed: the
   screen says "listening" until the 20 s timeout. Tear down on the track's `ended`.
5. `usePitchDetection` has no test, and it carries the invariant. Pin it with a mocked
   `getUserMedia` and `AudioContext`: the tracks stop on a hold, a cancel, an unmount,
   `visibilitychange: hidden`, a grant that arrives after a cancel, and a throw in the graph.

**Fixed 2026-09-27 (items 1–5; committed 2026-09-27, not seen):**
- 1: the stream enters the capture first thing after the grant, before any graph call, and
  `teardown` stops the tracks before anything else it does.
- 2: the stage stops the capture when its exit begins (`useIsPresent`) and in `leave`. A mic tap
  during the exit fade does nothing.
- 3: "Usuń" stops listening, like every other control on the status line.
- 4: a track's `ended` ends the capture and returns it to `idle`, with no line: the button comes
  back, and a revoked permission shows as a refusal on the next tap.
- 5: `shared/lib/audio/usePitchDetection.test.tsx` (the `flows` project, jsdom) drives each exit
  above, plus a track ended by the system and a refusal, against a stubbed `getUserMedia`, graph
  and animation frames. The pitch analysis is the real `pitchy` fed a sine, so the hold test also
  pins A3 as MIDI 57. `vitest.config.ts` names it beside the five flows.

For the dry run (the code cannot settle these):
- After "Gotowe", with the silent switch on: the note plays, from the loudspeaker, at full level.
  The playback runs in the tap, right after the tracks stop.
- After one use of the mic, a pitch pipe elsewhere in the panel is as loud as before. The
  analysis shares the never-closed `toneContext`, so an iOS route change that outlives the capture
  would reach every tone for the rest of the session. The fallbacks, if it does:
  `navigator.audioSession.type = "playback"` after the stop, or a separate context for analysis.
- The exact note, not only the octave, against a tuner or a piano. A sample-rate mismatch would
  shift every result by a fixed interval.
- A bass's lowest extreme (D2), not only the tessitura d. `clarity ≥ 0.9` against the phone mic's
  low cut is the likely failure.
- Whether the installed app asks for the mic on every tap.
- On prod after the deploy, the `Permissions-Policy` header carries `microphone=(self)`. With the
  old header the screen says "no access", as if the singer had refused.

Smaller:
6. The tolerance is measured against the run's mean, so a run may span about 80 cents, not ±40
   "of each other" as Stage 5 says. Harmless for a snap to the semitone; align the wording.
7. The keyboard does not follow the live cursor: a note sung outside the visible keys shows no
   cursor until it is held and centred.
8. The listening line is not in a live region; a screen reader says nothing when capture starts.
9. `pitchy` lands in the panel-shell chunk for every user, since `DashboardLayout` imports
   `VocalRangeScreen` statically. Import it inside `start`'s `.then`, which is already async.

Conductor's view:
10. The cast reads artists through `projectKeys.dictionaries.artists`, the same `["artists"]` key
    as the Artists list, but with a 24 h `staleTime`. A proposal sent today reaches the cast only
    after the Artists list has been opened, or a day later. Accept it (and open the Artists list
    first in rollout step 4), or give the cast a shorter freshness.
11. The cast meta line is plain text (`formatVocalRange`), so `₁`, `⁴` and `♯` fall back to a
    system face there (a bass's `G₁`; `F♯2` in en and fr). Its separator also differs from the
    conductor's own text: `A2–G4` beside `a – a²`.
12. `ArtistCard`: a proposal takes two lines in the range cell, so that card stands taller than a
    neighbour showing a conductor's range or "—". `ArtistRow` on `md`: a French range with both
    extremes widens the right-hand block. Look at on dev.
13. The editor's proposal block colours its text with raw `<span>`s inside `Text`.
14. `vocal_range_comment` is free text, and a singer may write about their health in it. It rides
    on every Artists list payload and is persisted in the query cache on every manager's device.
    Decide whether the list carries it, or only the editor.

**Fixed 2026-09-27 (items 6–9 and 11–13; committed as 97889e00, not seen):**
- 6: Stage 5's hold rule now says what `heldPitch` does.
- 7: the keyboard scrolls to keep a live cursor in view. When the cursor comes within 15 % of the
  window's height of an edge, the keys bring it back to the middle. Only a voice moves the cursor,
  and a key press ends the listening, so this never scrolls under a tap.
- 8: what the microphone is doing (listening, refused, unavailable, timed out) is said through the
  screen's existing live region; the status line itself cross-fades between elements, which a
  screen reader does not follow.
- 9: `pitchy` loads after the grant, on the first capture. The 20 s timeout starts at the grant,
  so a slow load counts against it, and a failed load ends the capture as `unavailable`.
- 11: the cast keeps the range as data (`RangeShown`) and sets a proposal with `VocalRangeText`,
  marked "wg chórzysty"; the conductor's text is joined with ` – `, like the proposal's.
  `PickerRow.meta` takes markup.
- 12: every card's range cell is two lines tall, the second holding "wg chórzysty" for a proposal
  and hidden otherwise: after the rollout most cards carry a proposal, so two lines is the norm,
  not the exception. In the row the mark goes under the range, not after it.
- 13: the editor's block uses `Text as="span"`.

**Decided 2026-09-27:** 14 stays as it is; the Artists list keeps carrying the comment.
10 is open, waiting on the developer.

## Polish pass — entrance, motion, the line

Status: **built 2026-09-27 (items 1–12); typecheck, lint, tests and build green; not committed,
not seen.** Frontend only, no migration, no flag.
From the developer's look on dev: the screen "jumps in with no reveal", filling it is "not smooth",
and the range line "looks like a draft".

Diagnosis (from the code):
- **Login.** `buildAuthUser` loads the proposal with the identity, so the prompt is due on the
  shell's first render, yet it enters as an overlay. `VocalRangeScreen` renders nothing until its
  `mounted` effect, so the panel paints first. The stage then fades in over 0.6 s while the sidebar
  and the dashboard assemble under it. What reads is the panel starting and being veiled. The
  content then rises as one block, keyboard included.
- **Welcome → prompt.** The welcome waits on `markWelcomeSeen` + `refreshUser` behind a spinner.
  The prompt then mounts later in `body` at the same `z-focus-trap`, opaque at full opacity. The
  welcome's words vanish in one frame, and its exit fade runs unseen underneath.
- **Filling.** Every change is its own short fade, and some snap:
  - a refilled slot cross-fades the old and new note in one grid cell for 180 ms, so two glyphs
    stand on each other;
  - the selection is four underlines swapping colour (Tailwind's 150 ms), not a mark that moves;
  - the readout and the table change their text without motion.
- **The line.** The four slots weigh the same: the optional extremes are as large as the
  tessitura, and each slot has a full underline and a caption. On first open the line is
  scaffolding: `(   ) –   (   )` over four rules and four captions. Below it the range is written
  twice more, in the readout and in the table's own-notation row, which repeats the line verbatim.

Entrance (`DashboardLayout.tsx`, `VocalRangeScreen.tsx`, `WelcomeMoment.tsx`, `NaveScene.tsx`):
1. `entersLit` becomes `entrance: "curtain" | "over" | "lit"`:
   - `curtain`: due on the shell's first render with a user (login, app open, reload). The stage is
     opaque from its first frame, with no stage fade. The scene lights itself: the shaft fades in
     and the stave draws. The panel is first seen when "Later" fades the stage out.
   - `over`: due later in a session (the snooze ran out), or opened from Settings. The stage fades
     in over the panel, as now.
   - `lit`: from the welcome, as now.

   The shell decides `curtain` once, on its first render that has a user. A takeover that turns
   on later is `over`.
2. The portal renders in the first commit. The `mounted` guard is SSR boilerplate in a Vite SPA,
   and under a curtain it shows the panel for one frame.
3. The content arrives in order, not as one block:
   - the eyebrow, title, intro and voice chip rise 14 px, 0.08 s apart;
   - the slot line rules itself in left to right: each blank scales in from the left, 0.07 s
     apart, echoing the stave behind;
   - the keyboard fades in and moves 16 px from the right on `lg`, or from below on a phone;
   - the status line comes last.

   Use framer variants propagated from the stage, so `RangeSlots` and the keyboard's wrapper join
   without props. The whole sequence stays under 1.1 s. Under reduced motion, opacity only.
4. Welcome → prompt: when the prompt follows, "Dalej" and "Pomiń" fade the welcome's words out at
   once (0.35 s, y −8) while the request runs. The scene stays, and there is no spinner. The prompt
   enters `lit` and runs step 3. A failed request fades the whole welcome, as now.

The line (`RangeSlots.tsx`):
5. The hierarchy follows the conductor's hand. The tessitura notes keep the hero size. The
   extremes and their parentheses drop to Metric `2xl` with `sm:text-3xl lg:text-4xl`, in
   graphite, with the parentheses hugging them. The line aligns on the baseline
   (`items-baseline`), which retires the marks' `pt-1`. The dash is set regular, in graphite, at the
   hero size.
6. One selection mark instead of four underlines: a gold 2 px rule under the selected slot that
   glides to the next (`layoutId`). An empty slot shows a faint short blank in incense. A filled,
   unselected slot shows its note and nothing else.
7. A caption shows only while it is needed: under the selected slot in gold, and under an empty
   slot, muted. A filled, unselected slot drops its caption. The caption row keeps its height, so
   nothing moves. The empty line reads as an instruction, the finished one as notation:
   `f¹ (d¹) – d² (f²)`.
8. A new note enters from the direction of the pitch change: a higher note from above, a lower one
   from below (y ±8). The old note leaves faster (0.1 s) than the new one enters (0.24 s), so two
   glyphs never stand on each other.
9. Re-check the phone slot size (30 px, under "Decided while building"). The smaller extremes free
   the width that forced it. Take 36 px if a Polish line fits 390 px. French may still wrap before
   the dash.

Below the line (`NoteReadout.tsx`, `RangeNotationTable.tsx`, `VerticalKeyboard.tsx`, locales):
10. The table drops the reader's own row, which repeats the line. It shows the other two
    notations, with no lit row, under a new title in pl/en/fr ("Ten sam zakres w innych
    zapisach").
11. The readout's and the table's values settle when they change (opacity from 0.5 over 0.2 s,
    keyed by the value), instead of snapping.
12. On the keys, the selected-state colour change runs 250 ms on the buttery ease, not Tailwind's
    150 ms.

Kept as is: the keyboard's native smooth scroll. An eased scroll of our own would fight iOS
momentum and a finger on the keys. Revisit it only if the developer names the scroll as the rough
part.

**Decided while building (do not undo without a reason):**
- **The line stays a line.** The developer offered to drop the line and parentheses for
  something freer, such as a circle with an echo inside. `a (g) – a² (c³)` is the conductor's own
  brief and the usual way a vocal range is written, with the extremes in parentheses. Four
  medallions would turn the notation into buttons and make the singer translate between them and
  what the conductor reads. The echo was kept: each note that lands in a slot sends out one gold
  ring, as the welcome's kamerton does (scale and opacity, skipped under reduced motion).
- **Captions hang under their slot** (absolute, centred, no wrap) in a row of fixed height. An
  extreme's caption ("au plus grave") is wider than its note, and in flow it would push the
  parentheses away from it.
- **Item 12 runs 300 ms `ease-out`**, the timing of the band and veil layers on the same keys.
  The buttery curve has no CSS token, and an arbitrary cubic-bezier is not allowed.
- **The blocks under the slots wait for the entrance only while it runs.** Present at the
  opening (a saved proposal, a kept draft), they start 0.6 s in; after the entrance a first note
  brings them at once.
- **The welcome keeps no spinner.** Its words are gone while the stamp and the refresh run, so a
  hung request leaves the lit scene empty until it settles. A failed stamp, or a refresh that
  brings no new user, fades the welcome out.

Verification: typecheck, lint and build. The developer then looks at the three entrances on dev:
- `lit`: reset `welcome_seen_at` and `vocal_range_proposed_at` on a seed singer;
- `curtain`: reset the proposal only, then reload;
- `over`: Settings → Profil → "Moja skala głosu".

He also looks at the line on desktop and at phone width.

## Stage 6 — optional siren (only after Stage 5 holds up on an iPhone)

One glissando, bottom to top and back, fills **only the two extreme slots**: a siren reaches the
forced edges, not the free ones. The extremes are not the raw min and max, because those are the
outliers (fry, a squeak, an octave jump). Each extreme is the turnaround dwell: the lowest and the
highest pitch held within ±50 cents for ≥ 150 ms among the filtered frames. It is played back and
filled for review, like the hold.

## Verification (once per stage)

- **Backend:** ruff and mypy on `roster` and `core`; `manage.py test roster documents core
  --settings=config.test_settings_sqlite`.
- **Frontend:** `npm run typecheck`, `npm run lint`, `npm run test`. Run `npm run build` at the
  end of Stages 3 and 5.
- **Desktop browser on dev** (seed singers): the welcome leads into this screen, "Later" returns
  on the next open, and Settings re-entry works. To replay the first-login path, reset
  `welcome_seen_at` and `vocal_range_proposed_at` on a seed user.
- **Phone:** on prod, behind the flag, as described in "Rollout" below. The phone cannot use the
  dev stack. The frontend calls `http://localhost:8000` absolutely, which on a phone points at the
  phone itself, and the mic needs HTTPS anyway.

## Rollout

Each step deploys with the flag still covering only the people named in it. On the prod server,
the flag lives in the root `.env`. After changing it, run `make prod`, which recreates the `web`
container. A plain `docker restart` does **not** reread `env_file`.

1. **Stage 1 to prod** with `VOCAL_RANGE_PROMPT=off`, then `make migrate`. Nothing is visible to
   anyone.
2. **Stages 2–5 to prod**, still `off`. Still invisible, and Stage 4 shows nothing without
   proposals.
3. **Dry run:** set the flag to the developer's and the conductor's user IDs. On their own
   iPhones, in the installed app, they check:
   - the sound, with the silent switch on and off;
   - the keyboard;
   - the mic: a held bass d and a soprano a² land in the right octave;
   - the copy, which the conductor approves.

   No data is written.
4. **Trusted singers:** add one or two singers' IDs. Real submissions follow; check that the
   conductor's views show them.
5. **Everyone:** set `all`. At the singers' next panel open, the screen follows the welcome or
   appears on its own.

## Record, not a ban

These are verdicts on one moment. A later session may overturn them with reasons.

- **No "accept proposal" button for the conductor.** Those fields are free-text SPN, and the
  conductor writes Helmholtz. Copying a proposal into them would mix notations in one column,
  which is the "A1" ambiguity again. Structuring the conductor's own assessment on the same MIDI
  model is the natural next step, once real proposals exist.
- **The guided helper was dropped.** The conductor confirmed that the singers know their
  tessitura, and the sounding keys, the note card, the table and the mic already help anyone
  slightly unsure. Uncertainty goes in the comment. The design is kept in case proposals come in
  empty or implausible:
  - a ladder from the voice's centre, walking the side that matters first (S/MEZ/T/CT up, A/BAR/B
    down), in white-key steps;
  - at each step the note plays, the singer sings it, and they answer one of three: "swobodnie,
    także cicho" (freely, quietly too) / "tylko głośno, z wysiłkiem" (only loud, with effort) /
    "nie sięgam" (can't reach);
  - the boundaries between answers give the tessitura and the extreme edges;
  - it would return with an `assisted` flag shown to the conductor.
- **No reference table of every note.** A 70-row, three-column chart is a wall. The note card and
  the range table carry the same information where it is used.
