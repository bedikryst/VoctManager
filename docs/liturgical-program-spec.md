# The liturgical programme — spec

**Status:** stage 1 (backend) **done** 2026-08-18 · stage 2 (frontend) open
**Audience of the feature:** the singer and the conductor. Not the congregation — a
guest-facing order-of-service booklet is explicitly out of scope (see *Not doing*).

## How to read this file

`Why` states the defect. `Decisions, settled` is the part you may not re-litigate
without a reason written down here. `The vocabulary` is the canon. `Stages` is the
work, in the order it has to happen. `Not doing` is the list of things that looked
obvious and are wrong.

## Why

A Mass is not a concert with different pieces. Every item in it answers *when in
the liturgy does this happen* — and the ensemble's first real engagement is a
wedding Mass, where a singer holding the book has to know that the next piece is
the one at the Offertory and not the one at Communion.

The model already carries two fields for this — `ProgramItem.section_label` and
`ProgramItem.role_prefix` — and they fail on three counts:

1. **They are free text.** A prefix typed as `Ofiarowanie:` prints as `Ofiarowanie:`
   on a francophone conductor's book. This is the identical failure the typed
   `warmup_start` / `soundcheck_start` columns were introduced to fix (see the
   comment on `roster/models.py`, `Project`): a run-sheet row carries a title
   somebody wrote in Polish, so it printed in Polish for every reader. Free text
   also walks around the project rule that every user-facing string exists in all
   three locales.
2. **They are editable in one place only** — the score-book cockpit, inside a
   collapsed "Treść i etykiety" disclosure, inside an expandable row, in a work
   area about generating a PDF. That is why the feature reads as missing.
3. **They reach one surface only** — the card printed in the score book. The
   setlist editor, the overview widget, the singer's own setlist and the printed
   day card know nothing about them. This is the same shape as the defect the
   concert-presentation audit found: the data travels and nothing renders it.

## Decisions, settled

**D1 — The slot is a typed choice on `ProgramItem`, not free text.**
`liturgical_slot`, blank for a concert item. The canonical vocabulary lives in
`roster/domain/liturgy.py` with `gettext` labels, so every surface and every
reader's language gets the same words from one table.

**D2 — Repeats are numbered at presentation time, never stored.**
The manager picks *Na Komunię* twice; the app prints *Na Komunię 1* and *Na
Komunię 2*. No `repeat_index` column, no `COMMUNION_2` enum member, and deleting
the first one renumbers the second correctly. The rule is universal — any slot
that appears more than once in one programme gets numbered.

**D3 — The section is derived from the slot; the stored fields become overrides.**
`section_label` and `role_prefix` keep working and keep winning when set. The
effective value is `override or derived`, which is the same idiom the card builder
already uses for `section_label or piece.text_source`. One rule, already in the
house.

**D4 — Only *function* slots print a prefix before the title.**
The vocabulary mixes two kinds of thing and the distinction is load-bearing:

- **Ordinary** (Kyrie, Gloria, Sanctus, Benedictus, Agnus Dei) — the piece *is*
  that part of the Mass. `Kyrie: Kyrie eleison` on a frontispiece is nonsense.
- **Proper** (responsorial psalm, gospel acclamation) — the text belongs to the
  day; the title normally already says so.
- **Function** (before Mass, entrance, offertory, communion, thanksgiving,
  recessional, and the two wedding moments) — a freely chosen piece doing a job at
  a known moment. This is exactly where the reader needs telling.

So: `role_prefix` (the line printed above/before the title in the score book) is
derived for **function** slots only. `slot_label` — always present — is what the
app surfaces and the day card show as a chip. An ordinary part is still labelled;
it just is not labelled *twice*.

**D5 — `order` stays the single source of truth for the running order.**
The canonical rank orders the *vocabulary*, not the programme. The programme may
contradict the canon on purpose. The app offers a one-click "order by liturgy" and
may point out a contradiction; it never silently sorts.

**D6 — `Project.event_kind` is the SSOT for what kind of event this is.**
`ScorePackage.density_mode` already carries a CONCERT/MASS distinction. It stays,
because it is a *print-layout* decision that a conductor may legitimately take
against the grain of the event — but it now defaults from `event_kind` when the
package row is created, so the two cannot disagree by accident on day one.

**D8 — Every label in this vocabulary carries a gettext context.**
`pgettext` with `"liturgical slot"` / `"liturgy part"` / `"event kind"`, never a
bare msgid. The reason is not hygiene: the bare msgid `Entrance` already exists
in this catalogue as the day card's word for the **door** the ensemble comes in
by (`Wejście`), and the liturgical slot means `Na wejście`. `Concert` is likewise
already taken. A test asserts the two do not collide.

The corollary for the frontend: **it never translates a slot name.** The label
arrives resolved from the server, from the one table, in the reader's language.
A second copy in `translation.json` is a singer reading two names for one moment.

**D7 — Wedding-specific slots are the two that are genuinely their own moment**
— the vows and the blessing of the rings. There is deliberately no "entrance of
the couple" or "recessional of the couple": at a wedding those *are* the entrance
and the recessional, and a second name for one moment is how a singer ends up
reading two names for one moment. A house that wants those exact words has
`role_prefix`, which is what the override exists for.

## The vocabulary

`roster/domain/liturgy.py`. Canonical rank ascending; `part` drives the derived
section; `kind` drives D4.

| code | rank | part | kind | pl |
|---|---|---|---|---|
| `prelude` | 10 | before Mass | function | Przed Mszą |
| `entrance` | 20 | introductory rites | function | Na wejście |
| `kyrie` | 30 | introductory rites | ordinary | Kyrie |
| `gloria` | 40 | introductory rites | ordinary | Gloria |
| `psalm` | 50 | liturgy of the word | proper | Psalm responsoryjny |
| `acclamation` | 60 | liturgy of the word | proper | Aklamacja |
| `vows` | 70 | liturgy of the word | function | Przysięga małżeńska |
| `rings` | 80 | liturgy of the word | function | Błogosławieństwo obrączek |
| `intercessions` | 90 | liturgy of the word | proper | Modlitwa powszechna |
| `offertory` | 100 | liturgy of the eucharist | function | Na ofiarowanie |
| `sanctus` | 110 | liturgy of the eucharist | ordinary | Sanctus |
| `benedictus` | 120 | liturgy of the eucharist | ordinary | Benedictus |
| `agnus_dei` | 130 | liturgy of the eucharist | ordinary | Agnus Dei |
| `communion` | 140 | liturgy of the eucharist | function | Na Komunię |
| `thanksgiving` | 150 | concluding rites | function | Na uwielbienie |
| `recessional` | 160 | concluding rites | function | Na wyjście |

Ranks step by ten so a slot can be inserted later without rewriting the table or
touching stored data.

`Project.EventKind`: `CONCERT` (default) · `MASS` · `WEDDING` · `OTHER`.
`WEDDING` differs from `MASS` only in which slots the picker suggests first.

## Stages

### Stage 1 — backend (this session)

- [x] `roster/domain/liturgy.py`: vocabulary, `build_program_presentation`,
      `liturgy_order_problems`, suggested slot templates per event kind.
- [x] `ProgramItem.liturgical_slot`, `Project.event_kind` + migration, with a data
      migration setting `event_kind=MASS` where the score package already says the
      book is a Mass.
- [x] `ScorePackage` creation defaults `density_mode` from `event_kind` (D6).
- [x] Read surfaces: `ProgramItemSerializer`, `ProjectSerializer.get_program`,
      `ProgramItemMaterialsSerializer`, score-package cockpit payload.
- [x] Write surface: the cockpit patch accepts `liturgical_slot`; the setlist
      write path (`ProgramItemViewSet`) accepts it through the model serializer.
- [x] The slot participates in `ScorePackageService._item_signature`, so changing
      it marks the built book stale.
- [x] Score-book card: derived eyebrow + role (`score_package_builder`), and the
      readiness traffic light counts a derived section as present.
- [x] Printed day card / call sheet: the slot chip on every programme row.
- [x] `seed_db` uses slots instead of the free-text Mass overrides.
- [x] Django catalogs pl/en/fr (`polib`; `makemessages` cannot run here).
- [x] Tests: `roster/test_liturgy.py`.
- [x] One pass of ruff + mypy + the roster suite at the end.

Also landed, beyond the original list:

- `GET /api/program-items/slots/` — the vocabulary in the reader's language.
- `Project.event_kind` is a surfaceable change key, so a concert that becomes a
  Mass reaches the cast as "Rodzaj wydarzenia: Koncert → Msza" rather than
  landing silently (`_PROJECT_CHANGE_KEYS`, `_event_kind_label`).
- `Project.is_liturgical`, the one definition of "this programme is an order of
  service".

**Verified:** ruff + mypy clean on `roster` and `notifications`; `roster` 529
tests and `notifications` 110 tests green; `makemigrations --check` clean.

### The API contract stage 2 builds on

| where | writable | read-only, derived |
|---|---|---|
| `/api/program-items/` | `liturgical_slot` | `slot_label`, `section`, `role_prefix_effective` |
| `/api/program-items/slots/` | — | `{slots:[{value,label,part,part_label,kind}], templates:{MASS:[…],WEDDING:[…]}}` |
| project payload | `event_kind` | — |
| `project.program[]` snippet | — | `liturgical_slot`, `slot_label`, `section` |
| materials dashboard `program[]` | — | `liturgical_slot`, `slot_label`, `section`; `project.event_kind` |
| score-package cockpit item | `liturgical_slot` | `slot_label`, `section_effective`, `role_prefix_effective` |

`slot_label` is already numbered ("Na Komunię 2"). Nothing on the client
re-derives, re-numbers or re-translates it (D8).

### Stage 2 — frontend (next session)

- [ ] Types + service: `liturgical_slot` on the program item, `event_kind` on the
      project, the derived `slot_label` / `section` / `role_prefix` read fields.
- [ ] `ProjectDetailsTab` (or wherever the project's own facts are edited): the
      event-kind select.
- [ ] `SetlistRow` in `ProgramTab`: the slot select, the slot shown on the row,
      and the "order by liturgy" action committed through the existing
      `EditorActionBar` (deferred edit — never an auto-sort, D5).
- [ ] `ProgramWidget` (overview) shows the slot.
- [ ] The singer's setlist (`TimelineProjectCard`, SETLIST sub-tab) shows the slot
      — this is the surface the whole feature exists for.
- [ ] `ScorePackageItemRow`: the two override fields now say what they override,
      with the derived value as the placeholder.
- [ ] i18n: pl/en/fr `translation.json`, Polish first and native.
- [ ] One `npm run typecheck` + `npm run build` at the end.

## Not doing

- **No guest-facing order-of-service booklet.** It is a different artefact for a
  different reader, and no generator for it exists (`dtp_export.txt` is the roster
  list for the printer, nothing more). If it is ever wanted, it is its own spec.
- **No separate `MassPart` / `Liturgy` model.** One typed column on the row that
  already exists.
- **No auto-sorting of the programme by canonical rank** (D5).
- **No liturgy parts on the day timeline.** The Mass is one anchor on the day's
  axis; the programme is the order *inside* it. Merging them breaks
  `buildDayTimeline`, which merges four day anchors and nothing else.
- **No `repeat_index` column** (D2).

## Tooling note

`Read`/`Grep` render a forward slash in file content as a backslash in some
contexts (`Liturgical/role` shows as `Liturgical\role`, `// comment` as
`\ comment`). A "stray escape sequence" seen only through those tools is an
artefact — check the bytes before believing it.
