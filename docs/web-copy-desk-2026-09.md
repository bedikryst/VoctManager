# Copy desk — the site's editorial surface (2026-09)

Spec for what `docs/web-board-feedback-2026-09.md` called "Etap 2 — translation review surface".
The stage changed shape during design and is now a different object; this file is the authority
for it, and §1 of the board-feedback file points here.

## How to read this file

- **§1 What changed and why** — the reframe. Read this before questioning any decision below.
- **§2 The two-iteration rule** — a hard constraint on the whole stage.
- **§3 Architecture** — where it lives, who is source of truth, how someone gets in.
- **§4 The segment** — the unit everything else is built on.
- **§5 `concerts.yaml`** — the measured corpus and the `*Pl` trap that blocks three locales.
- **§6 Order of work** — stages, and what each one delivers.
- **§7 Traps** — things that look correct and ship wrong.
- **§8 Open decisions.**

Companion to `.ai/07_marketing_public_site.md` (rules) and `docs/web-landing-guardrails.md` (the
negative space). Nothing here overrides those two.

---

## §1 What changed and why

The board-feedback roadmap specified a **read-only noindex route** rendering PL | EN | FR side by
side, so Florent could *check* translations of copy whose Polish was finished. Two facts from the
developer changed that:

1. **Florent wants to edit the Polish**, especially on the concert pages, where his musical
   authority is the reason the text exists at all. The Polish is not frozen source — it is copy he
   is expected to improve.
2. **He will not do this in rounds.** He wants all three locales in front of him at once.

A read-only page cannot serve either. If he can only annotate, he has to describe locations in
prose ("Contact page, second paragraph"), the developer hunts for the string, ambiguities become
e-mails, and the stage costs the exact three sittings he refused.

So the object is not a translation review surface. It is a **copy desk**: a permanent editorial
surface over the site's whole text, in every locale, where Florent is editor-in-chief and
translation is one of the operations performed on a segment rather than the point of the exercise.

Two consequences that are easy to miss:

- **It is a route, not a handover.** A document mailed to a reviewer is a snapshot; the desk
  renders whatever the modules currently hold. When Etap 3 (`/press`) and Etap 4 (liturgies) add
  copy, the same link shows the new segments flagged as new since his last visit — he returns to a
  handful of rows, not to a re-read. This is the strongest argument for the route, stronger than
  "a spreadsheet loses the inline `<em>`".
- **Concert detail pages come first, not last.** The roadmap excluded them from *translation* on
  value grounds and that judgment still holds for the reader-facing question. But for *editing*
  they are first, and three independent reasons converge: they are the text Florent cares about
  most, they are two thirds of the corpus, and they are the cheapest to make editable because
  `concerts.yaml` is already a separate structured data file — nothing to extract from templates.
  Highest value and lowest cost are the same object.

The developer's correction, recorded because it moderates the above: the Polish is **not** a throwaway
AI draft. It comes either from Florent's own PDFs or from the developer's redaction of them, and is
already at a usable level. Expect nuance, word choice and clause order — not rewriting. That is why
translating now, against the current Polish, is not wasted work.

## §2 The two-iteration rule

**Translations go in at least two iterations. Always. This is not a schedule risk to manage, it is
the shape of the work.**

Iteration one translates the Polish as it stands today. Florent then edits the Polish. Every Polish
edit — even a single word — puts the two translations built on it out of date, because a translator
renders a *sense*, and the sense is what he is adjusting. So:

1. **Pass 1** — all three locales are drafted and handed over together (what Florent asked for).
2. He edits, in any locale, in any order.
3. **Pass 2** — every segment whose Polish changed is retranslated against the new Polish and goes
   back to him marked *source changed since your translation*.

The desk must make pass 2 cheap, which is what §4's source hash is for. A build that cannot tell
which translations are stale has not implemented this rule, whatever the UI looks like.

Do not promise anyone a single pass. Do not size the stage as if pass 2 were an exception.

## §3 Architecture

### Git stays source of truth

The database holds **proposals**. Git holds the site. Never the other way round.

An editor's change is a proposal until the developer accepts it; accepted proposals are written into
`concerts.yaml` and the content modules by a script, reviewed as an ordinary `git diff`, committed
and deployed. Nothing reaches the public site without passing through a diff.

The alternative — database as source of truth, Astro building from an API — is a real CMS and was
rejected on three grounds. It removes the site's copy from git (losing blame, diff and review,
including on the legal texts, which must never change silently); it makes the static build depend on
a live backend; and it flattens copy that is deliberately interwoven with composition and the
guardrails. The proposal model uses the same data shape a CMS would need, so it is not a dead end: a
later "trusted editor publishes directly" mode is an addition, not a rewrite.

### Where it lives

**A mode inside the VoctManager panel**, not a second application. Accounts, roles, notifications,
the design system and i18n all already exist there; a standalone app on a subdomain rebuilds every
one of them.

- **Layout takeover.** The desk is not a tab competing for chrome. Entering it replaces the whole
  app shell — no nav dock, no sidebar, full bleed for the text — with a single `← Panel` affordance
  in a corner. Route tree of its own (`/redakcja/*`), its own shell component; the panel's shell is
  not rendered at all.
- **`translate.voctensemble.com`** is the address editors are given: a DNS-level redirect into that
  route tree. It is a convenience, not an architecture — no code lives at that host.

### Who gets in

**Do not add a fourth `AppRole`.** Measured: ~180 occurrences of `is_manager` across 28 backend
files and ~100 of `isManager` in the frontend, and the decisive ones are **negative** —
`ManagerRoute` (`if (!isManager(user))`), `ConductorDeck`, `useCommandItems`. The codebase splits
the world binarily into manager and not-manager, so an `EDITOR` role would land in the not-manager
branch everywhere and be served as an artist: schedule, materials, personal file. That is ~280 call
sites to audit for a permission that is orthogonal to what a role means here.

Instead: **a capability flag on `UserProfile`** (`can_edit_site_copy`), independent of `role`. It
disturbs nothing. Florent and Ania already have accounts; the flag is set from Django admin — no
frontend UI for editor management in this stage, deliberately.

**Token links are deferred, not rejected.** When a genuinely external reviewer appears (a translator
who is not in the ensemble), the right door is a per-person signed link, not an account: it keeps a
stranger out of the identity model entirely — no acceptance of a choir application's terms they will
never use, no RODO footprint, and revocation is deleting a row. Build it then. What must **not** be
built is an anonymous public picker ("I am working as Florent"): proposals are harmless because the
developer gates them, but an unattributed edit destroys the one fact the two-iteration rule depends
on — who wrote this, and against which source.

## §4 The segment

The unit of everything: one editable field of one page or concert.

| part | purpose |
|---|---|
| `key` | stable dotted id — `concert.wcielenie.program.3.note`, `page.kontakt.hero.lede` |
| `kind` | `text` (plain) or `html` (inline `<em>/<strong>/<a>` allowed) — decides the editor and the sanitizer |
| `locale` | which column this value belongs to |
| `value` | the proposed text |
| `source_hash` | hash of the **Polish** value this translation was made against |
| `status` | `draft` / `proposed` / `accepted` / `rejected` |
| `author`, `updated_at` | attribution; the reason anonymous access is refused |

Two derived states drive the whole UI and both come free from the fields above:

- **stale** — a non-Polish segment whose `source_hash` no longer matches the current Polish. This is
  the two-iteration rule made mechanical.
- **new since last visit** — a segment created after the editor's last session. This is what keeps
  later stages from reading as a fresh wall of text.

The key must be derivable from the content module or YAML path in **both** directions: the extractor
produces it, and the apply script writes back through it. A key that can only be generated one way
turns acceptance into manual patching, which at ~500 segments is a guaranteed error.

### What the editor sees

Reading order, in the site's typography — not a table. Section headings, then paragraphs, each one
clickable into an inline editor. A locale switch above the text (PL / PL+EN / PL+FR / all three;
three columns are too tight on a laptop for a long paragraph). Per-segment: the original under a
toggle, a one-line comment field, and the status chip. Per page: a contents list with counts —
segments, touched, accepted, new — so an editor can see what they have already done, which was an
explicit request.

### What the developer sees

A notification when an editor proposes changes. The same view in reviewer mode: old → new per
segment, accept / reject / edit further. Accepted segments accumulate into a patch that
`npm run apply-copy` writes into the repo. Then: `git diff`, commit, deploy.

## §5 `concerts.yaml` — the measured corpus and the blocking defect

### Measured

12 143 words total (the roadmap's "15.9k" counted YAML syntax).

| category | words | disposition |
|---|---|---|
| Polish prose (`note` 2904, `gallery[].alt` 621, `verbum` 557, `movements[].line`, `about` 485, `programArc` 388, `essence`, `prologue`, `pullQuote`, `reflection`, `programNote`, `facts`, `meta`, `video.caption`…) | **~6 500** | translate |
| vernacular glosses of foreign originals (`textPl` 1565, `inscriptioPl` 422, `claspTextPl` 243, `movements[].pl`) | **~2 200** | translate — but see below, this is verse |
| foreign originals (`text` 1698, `inscriptio` 191, `claspText` 227) | ~2 100 | **never translated** |
| proper names & structure (`composer`, `work`, `roster.groups[].names`, `credits[].name`, years, voicing, file stems) | ~1 300 | never translated |

So roughly **8 700 words per locale**, ~17 400 words of output for EN + FR.

### The `*Pl` suffix means two different things

This blocks three locales and would have shipped as silent nonsense.

```yaml
text:    "Es ist ein Ros' entsprungen…"    # the German original — content, not a locale
textPl:  "Wyrosła różdżka…"                # NOT the Polish variant of the page
inscriptio:   "Et egredietur virga…"       # Latin — present in every locale
inscriptioPl: "I wyrośnie różdżka…"        # a gloss
movements:
  - lat: "Prophetia"
    pl:  "Zapowiedź"                       # same shape again
    line: "Zanim padnie słowo o Dziecku…"  # ordinary prose
```

`textPl` is **not** the Polish rendering of `text` in the i18n sense. It is *the translation of a
foreign original into the reader's language*, and on the English page that slot must hold an English
translation. Adding `textEn` beside `textPl` creates two incompatible meanings of the same suffix in
one file, and nobody would later be able to tell which `Pl` is a locale and which is content.

**The rename, before any EN/FR data exists:**

```yaml
text: "Es ist ein Ros' entsprungen…"
textGloss: { pl: "Wyrosła różdżka…", en: "…", fr: "…" }
inscriptio: "Et egredietur virga…"
inscriptioGloss: { pl: "…", en: "…", fr: "…" }
movements:
  - lat: "Prophetia"
    gloss: { pl: "Zapowiedź", en: "Prophecy", fr: "Prophétie" }
    line:  { pl: "…", en: "…", fr: "…" }
```

This is a mechanical migration of the existing file plus the components that read it, and it must
land **before** translation starts, not alongside it.

### Sung texts are translated in full (decided)

Every locale gets the original **and** a gloss in the reader's language. This is the layer that
carries the site's meaning; a French reader looking at an untranslated 16th-century German stanza is
being handed the wrong object.

Where a canonical published translation of a hymn exists, **use it and credit it** rather than
inventing one — "Lo, how a rose e'er blooming" is the English of this text, and an invented
alternative reads as an error to anyone who knows the repertoire. For anything whose author died
less than 70 years ago, the canonical translation is under copyright: flag it rather than pasting
it, and treat the rights question the way `docs/…` already treats ZAiKS.

### Biblical references are locale-dependent

`inscriptioRef: "Iz 11, 1"` — the book abbreviation and the separator differ per language
(`Is 11:1` in English, `Is 11, 1` in French). Either localize the string per locale or store the
reference structurally (book id + chapter + verse) and format it. The second is correct and cheap
at this size; do it during the rename.

### Dates baked into prose

`meta: "Bazylika NSPJ, Kraków · 20 stycznia 2024"` and `verbum.speaker: "o. Jarek Naliwajko SJ ·
20 stycznia 2024"` embed a Polish-formatted date inside a translatable string. Translating the
string by hand carries the date along and it will drift from the structured `date` field. Split the
date out and format it from the existing date value per locale. Note the known trap: Polish and
French month/day capitalization does not survive naive formatting (see the project's
`reference_polish_interpolation_dates`).

## §6 Order of work

| # | stage | delivers |
|---|---|---|
| A | `concerts.yaml` locale-map migration (§5) + components that read it | the file can hold three locales at all |
| B | backend: segment model, proposals API, `can_edit_site_copy`, notification | proposals can exist |
| C | extractor + `apply-copy` script, both directions through `key` | proposals can reach git |
| D | panel: `/redakcja/*` shell, contents list, editor, reviewer mode | the desk |
| E | EN + FR draft for all six concerts (~8 700 words × 2), pass 1 | Florent's first sitting |
| F | `/en/koncerty/[id]`, `/fr/koncerty/[id]` routes, per-concert `TRANSLATED_ROUTES`, hreflang | the pages exist |
| G | static pages extracted into content modules (`kontakt`, `koncerty` index, `obrazy`, `kolofon`, chrome), then landing | the rest of the corpus enters the desk |

A–D are infrastructure and can be verified without any translation existing. E is the long pole and
is where pass 1 of §2 happens. G's last item — the landing — is deliberately last: the guardrails
forbid restructuring its composition, and its copy is the most tightly bound to it.

`/press` is **not** in this list. It is rewritten in Etap 3 (897 → ~300 lines); translating it first
is the one piece of work in this plan that would genuinely be thrown away. It joins the desk after
the recut, and Florent is told up front that a small second batch is coming — a stated expectation
costs nothing, a surprise costs his goodwill.

## §7 Traps

- **`contenteditable` injects markup.** The browser will produce `<div>`, `<br>` and styled `<span>`
  inside an edited `html` segment. The export path must whitelist `<em> <strong> <a>` and flatten
  everything else, and `text` segments must be edited as plain text with no HTML path at all. This
  is the same failure mode as the annotation payload sanitizer: a serializer that rebuilds its
  payload silently drops whatever is not on the list.
- **Do not let editors type French punctuation spacing.** `lib/typo.ts` inserts the narrow no-break
  spaces before `? ! : ;` and pins orphans at build time. Hand-typed hard spaces double up. Say so
  on the desk, in French, in one sentence.
- **Source drift is silent without the hash.** §4 exists for this. A translation whose Polish moved
  looks perfectly fine on screen.
- **`TRANSLATED_ROUTES` is a manual ordering contract.** `i18n/config.ts` states it: add the path
  only *after* both route files exist, or every localized link starts pointing at a 404. With six
  concerts this becomes six entries, each flipped independently — do not flip the set for the whole
  concert section at once.
- **Astro scoped styles do not reach injected DOM**, and delegated clicks must capture, not bubble,
  because of the ClientRouter. Both are recorded project traps and both apply to any preview the
  desk renders using site markup.
- **Alt text is translatable copy.** `gallery[].alt` is 621 words. It is not decoration; leaving it
  Polish on the English page is an accessibility regression, not a cosmetic one.

## §8 Open decisions

- **Notification shape.** `NotificationType` has ~8 layers to touch. Decide whether an editor's
  session produces one digest ("Florent proposed 12 changes on Kontemplacja Wcielenia") or one per
  segment. Digest is almost certainly right; confirm before building.
- **Whether accepted proposals auto-commit.** Currently manual (`apply-copy` → developer commits).
  A bot commit is a later convenience and needs no model change.
- **Copyright on canonical hymn translations** (§5). Needs the same treatment the site already gives
  ZAiKS: identify, then decide, rather than paste.
