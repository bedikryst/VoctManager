# Vocal range — self-reported by singers

Status: **Stage 1 (backend) built, audited and committed 2026-09-27: model, service, endpoint,
serializer exclusions, rollout flag, GDPR export and erasure, tests. Migration `roster/0065` not
yet run on prod (`make migrate`). Next: Stage 2 (frontend shared foundations).**
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
  - `playArpeggio(midis)`;
  - runs on `toneContext`.
- `shared/ui/instruments/VerticalKeyboard.tsx`:
  - vertical piano (high at top), virtualised to the visible window;
  - props `low/high`, `bands` (bright tessitura, thin extremes), `markers`, `activeKey`,
    `liveCursor`, `onKeyPress`;
  - every C carries its label in the reader's notation;
  - Ethereal tokens only; motion on transform/opacity.

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
- Head copy (draft, Polish primary):
  > Jaka jest Twoja tessitura w śpiewie zespołowym? Podaj zakres, w którym Twój głos swobodnie i
  > naturalnie funkcjonuje w zespole. W nawiasie możesz dodatkowo podać skrajne dźwięki, które
  > jesteś w stanie zaśpiewać, choć tylko głośniej i z wysiłkiem.
- Four tappable slots, set large in the reader's notation: `[a] ([g]) – [a²] ([c³])`. The
  tessitura slots are required; the extreme slots are optional.
- Tap a slot, then a key. The key sounds and fills the slot. The keyboard opens centred on the
  voice's middle:

  | SOP | MEZ | ALT | CT | TEN | BAR | BAS |
  |---|---|---|---|---|---|---|
  | a¹ | f¹ | d¹ | e¹ | a | f | d |

  Its bounds are G1–C7.
- **Note card** for the touched key, always in all three notations: `A4 · a¹ · la3 · 440 Hz`.
- **Range in every notation**: a live three-row table under the slots, with the reader's row
  highlighted. There is no British row, because British usage writes pitch as the international
  or the Helmholtz row does.
- **Comment** (optional, max 500).
- **Privacy line**, plain and just above the button: "Twój zakres zobaczy tylko dyrygent i osoby
  prowadzące zespół. Pozostali chórzyści go nie zobaczą."
- "Wyślij dyrygentowi" plays `playArpeggio` over the tessitura, then sends the PUT.

**Re-entry:** a quiet "Moja skala głosu" row in `settings/components/GeneralTab.tsx` opens the
same screen with the saved values and comment. The singer sees only their own proposal. The row
exists only while the flag is on for that user.

**Dry run for non-singers:** the same Settings row appears for a user with the flag on and no
singing artist profile, such as the developer or the conductor. It opens the screen with a voice
picker (the seven singing types) in place of the singer's own voice. Everything works: keys,
sound, the table, the comment and the mic. The send button is replaced by one line, "Tryb
próbny — nic nie zostanie zapisane" (trial mode, nothing is saved). This is how the screen gets
tested on a real iPhone on prod before any singer sees it, and how the conductor approves the
copy.

**Also in this stage:**
- `AuthUser` maps the new Me fields.
- Bump `QUERY_CACHE_BUSTER`.
- i18n in pl/en/fr, with gendered forms following `salutation`.

## Stage 4 — the conductor's view

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
- **Hold:**
  1. Select a slot and tap "Zaśpiewaj i przytrzymaj".
  2. A held note is ≥ 600 ms of frames within ±40 cents of each other. A live cursor follows on
     the keyboard while the singer sings.
  3. The result snaps to the nearest semitone.
  4. The **mic stops, then the detected note plays back** and fills the slot. Hearing it back
     catches octave errors by ear.
- The button is hidden where `getUserMedia` is missing. A refusal gets one line and no retry loop.
- Privacy line: nothing is recorded or sent.

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
