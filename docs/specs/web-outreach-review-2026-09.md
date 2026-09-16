# Public site — outreach review: the notice list and the mecenat (2026-09)

Record of the September review that started as Ania's UX critique of the concert-invitation
sign-up and ended somewhere else: the sign-up is not the surface that matters, and the one that
does — the mecenat — has no address anyone can say out loud.

Two subjects, one session, kept in one file because the second came out of the first and they
share a decision (where the confirmed sign-up sends a reader next).

## How to read this file

- **§1 The reframing** — what the review was asked to fix and what it turned out to be. Read this
  first; it is why the order of work is not the order the conversation ran in.
- **§2 Notice list** — accepted changes, each with the reason. Read this to build them.
- **§3 Mecenat** — the diagnosis, the measured facts, and the spec for the new page.
- **§4 Rejected** — with reasons, so nothing here gets re-proposed in three months.
- **§5 Open** — what nobody can answer yet, and who owns each question.
- **§6 Order of work.**

Companion to `docs/web-notice-list-2026-09.md` (the list's own spec — the consent model,
retention, the six surfaces) and `.ai/04_design_system.md`. Neither is overridden here.

---

## §1 The reframing

Ania (board) reviewed the sign-up band and filed five complaints, all variations on one thesis:
*"język marki przejął rolę języka interfejsu"* — the brand's voice took over the interface's job.
The thesis is right as a principle and lands on the wrong element. The band's largest sentence
(`notice.h2`, "Damy znać o nadchodzących koncertach.") is the plainest Polish on the page; what
is actually heavy is the **consent clause**, 70 words of legal copy standing at first level.

Three of her five points are cheap and correct (§2). Two are rejected (§4). But the finding that
reordered the whole plan came from the developer, not from the review:

**The sign-up is not a bottleneck.** The list will be seeded by friends and family who already
receive printed invitations by post. Twenty people, most of whom would attend anyway. Meanwhile
the **mecenat** — the only surface on this site that decides whether there is money — converts
near zero, and Plausible says why: almost nobody opens the vault (~5% of visits), and the mecenat
is a tab inside it.

So: do Ania's cheap fixes, then stop working on the list and go where the money is.

A second finding, unrelated to either — **and stated too strongly twice before being corrected.**
This review first called `states.confirmed` a lie: it says *"Napiszemy, gdy następny Koncert
Duchowy dostanie datę"* while a date exists (*Pochwała Stworzenia*, Kościół Wszystkich Świętych,
Warszawa, X.2026). **That reading is wrong.** The sentence is about a future event, and "następny"
naturally means the evening after the one that already has its date — so it is true as written.
The prediction in `docs/web-notice-list-2026-09.md` about a sentence rotting on announcement day
concerned `notice.h2`, which used to read "Damy znać, gdy pojawi się data" and has since been
fixed to "Damy znać o nadchodzących koncertach". The warning was mapped onto the wrong field.

What survives is a **gap, not a falsehood**, and the developer named it first: someone who
confirms a month before the concert is told what happens *after* it, and never learns that the
nearest evening exists at all. Worth fixing — as an improvement to `confirmed` alongside the
mecenat link (§2.5), not as an urgent defect.

---

## §2 Notice list — accepted

### 2.1 The promise counts evenings, not concerts — and carries a ceiling

**The defect nobody had noticed.** The current promise is *"Jeden krótki list przed każdym
koncertem. Nic poza tym."* One programme is played in several cities: *9 Kart* ran Rybnik, Łódź,
Kraków; *Aeternam* ran Mistrzejowice, Niedzica. So "one letter per concert" already means **three
letters about one programme** — the sentence reads modest and counts wrong.

Ania's own request (a save-the-date early, a reminder days before, room for a change of plan)
compounds it: two letters per concert × three cities = six letters about one programme.

**The unit is the evening.** Proposed Polish:

> Piszemy tylko o naszych koncertach: gdy wieczór dostaje datę, na kilka dni przed, i gdyby coś
> się zmieniło. Kilka listów w roku, nie więcej.

It covers her three cases, does not multiply by cities, and keeps a **countable ceiling** —
see §4.2 for why the ceiling is not negotiable.

**Cost: copy only, no clause bump.** `consentHtml` states no frequency (it says only "zaproszeń na
koncerty"), so two letters per evening are already within what subscribers agreed to. The promise
lives in five places:

| Where | Field |
|---|---|
| [`koncerty.yaml`](../web/src/content/pages/koncerty.yaml) | `notice.lede` (+ two locale overlays) |
| [`nuntius.ts`](../web/src/i18n/content/nuntius.ts) | `states.confirmed` (×3 locales) |
| [`nuntius.ts`](../web/src/i18n/content/nuntius.ts) | `signup.meta.description` (×3 locales) |
| [`copy.py`](../backend/outreach/copy.py) | `promise` (×3 locales) |
| [`models.py`](../backend/outreach/models.py) | `ConcertNoticeSubscription` docstring |

`NOTICE_CLAUSE_VERSION` in `outreach/consent.py` does **not** move. Verify that before writing:
if any wording touching purpose, controller or withdrawal changes, it does.

### 2.2 The clause goes into `<details>`, and nothing is cut

70 words at first level is the real weight in the band. Layered notice is accepted practice, but
the layering must keep in layer one what makes consent informed: purpose, controller, the right to
withdraw.

**The successor clause may not be demoted.** *"gdyby zakończyła działalność, listę może przejąć
osoba prowadząca zespół VoctEnsemble"* is not decoration — it is variant B, chosen deliberately
instead of joint controllership under art. 26 (the reasoning is in `web-notice-list-2026-09.md`).
Moved to the privacy policy, consent to that transfer stops having been given.

So: `<details>`, collapsed to one sentence, **full text still in the DOM and still under one
clause version**. Visual relief without touching the record.

### 2.3 Field chrome

- **Remove both placeholders.** `imie@przyklad.pl` and `Ania` (3 locales). The label sits *above*
  the field, so the placeholder carries no information, vanishes on typing and is mistaken for a
  value. Ania's stated reason (a reader whose address has no first name in it) is weak; the
  pattern is wrong regardless.
- **`Imię — nieobowiązkowe` → `Imię (opcjonalnie)`.** "Nieobowiązkowe" is a negation, and the site
  runs a one-negation-per-passage rule. `/nuntius` preferences already say "(nieobowiązkowe)" —
  pick one wording for both.
- **Consent checkbox before the submit button.** Today the DOM order is name → email → **submit**
  → consent, and `.notice-row` wraps, so on the narrower `band` variant the button also sits
  visually above the clause. First attempt therefore ends in a red error for anyone who did not
  read downward. Small, real, cheap — but *not* the heart of the complaint, which is how it was
  first presented here.

### 2.4 The band gets air, and a ribbon

**Air.** The landing's placement is `variant="strip"` — deliberately "the same ask laid on its
side" to open the footer. Side effect: it is the only section on the landing without breathing
room, because it was designed as a transition rather than a station. Ania's *"za bardzo pędzimy"*
names this correctly. One `padding-block` value in `.notice-inner-strip`.

**Ribbon, not blur.** Ania sent a soft-gradient reference and said it reminded her of "the blur
from the concerts" — that is [`.vplayer-glow`](../web/src/styles/vplayer.css#L57), a blurred
low-res mirror of the frame, commented *"projection light in the room"*. The developer's read is
better: what she is pointing at is the **breviary** language of the concert menu, not the blur.

The ribbon in [`nave-menu.css`](../web/src/styles/nave-menu.css) is **meaningful** — on the
desktop register each concert's ribbon carries that evening's accent, and on mobile per-concert
dye was tried and rejected (line 110: *"DYE — crimson, always"*). So it cannot simply be copied
onto a band that marks no concert.

**Resolution: the sign-up's ribbon is the one without colour, permanently.** A first draft had it
waiting to be dyed when the evening got a date; the developer killed that — someone signing up a
week before a concert, after all the letters have gone, would wait for a colour that never comes.
The ribbon encodes **the state of the relation** (your bookmark is placed), never the state of the
world. It gains a natural gesture for `sent`: the ribbon settles. One `transform`, no new words.

**Why a meaningful ornament is allowed here and 70 words of clause are not** — Ania's own test:
*"warstwa znaczeniowa może być nieoczywista i odkrywana stopniowo — ale funkcja musi być oczywista
natychmiast."* Nobody has to understand the ribbon to leave an address.

### 2.5 The confirmation page names the nearest concert, and gains an exit

Not a correction of a falsehood — see §1. `states.confirmed` is true as written; it is simply
silent about the evening the reader is most likely to want. When a dated concert stands, name it
there, so a reader confirming a month before *Pochwała Stworzenia* learns it exists instead of
only hearing about the one after it.

The same edit adds the **link to the mecenat** — see §3.4 for why it goes here and not on the
"check your inbox" screen.

---

## §3 Mecenat

### 3.1 What is actually broken (corrected twice during the review)

Two claims made here were wrong and are recorded so they are not repeated:

- ~~"The vault only opens on the landing."~~ **False.** `SiteChrome.astro` carries the support
  button on every page and [`vault-triggers.ts`](../web/src/scripts/vault-triggers.ts) opens the
  vault in place via `voct:open-vault`; `href="/?donate"` is only the no-JS fallback.
- ~~"The mecenat has no address."~~ **False.** `voctensemble.com/?donate` auto-opens the vault
  ([`VaultIsland.tsx:57`](../web/src/islands/landing/VaultIsland.tsx#L57)) **and skips the audio
  gate** ([`DocumentGates.astro:82`](../web/src/components/DocumentGates.astro#L82):
  `params.has("donate") → return true`).

What survives, and it is enough:

1. **`?donate` cannot be said out loud.** "Slash question-mark donate" is not something you tell
   someone after a concert. `/#wesprzyj` — the thing a person would guess — does neither of the
   two useful things above.
2. **Google has nothing to index.** The vault is an overlay with no sitemap entry.
3. **`?donate` lands on the one-off donation** (`open(100)`). The mecenat is still a tab away, so
   even knowing the address you cannot send anyone straight to it.

Add the measured funnel: landing → section → vault (~5% of visits) → second tab. Each level is a
filter, and the product is ~0. Goal is 20 000 PLN
([`vaultConfig.ts:43`](../web/src/islands/landing/constants/vaultConfig.ts#L43)).

This is the same disease the notice list was already cured of — *"widoczność ≠ głośność:
niewidzialne przy skanowaniu, nieuchronne przy szukaniu"* — and the cure (`/newsletter`) is in the
repo. It was never given to the second patient.

### 3.2 The mecenat leaves the vault

Not a prettier second surface — a move. Two different things share one surface today only because
both involve money:

| | Vault | Mecenat |
|---|---|---|
| What it is | a transaction | a commitment |
| Mechanism | payment gateway | standing order in the donor's own bank |
| Horizon | one minute | years |
| Amount | one-off | 50–200 PLN monthly |
| Form | overlay, dismissed with Escape | a page you return to |

The mecenat does not even touch the gateway: it is an account number plus *"daj nam znać, że
dołączasz"*. **Nobody commits for years inside a modal over the homepage.** The page is the correct
form for that decision, not an ornament — and the vault gets simpler, one thing instead of two
competing tabs.

This also closes the identity question the review opened. The site is VoctEnsemble's, plainly. The
foundation appears where it takes something on: where it asks for money, where it answers for data,
and where it speaks as an institution. **The mecenat page is therefore the foundation's home on the
ensemble's site** — which is a better answer than adding paragraphs about the foundation to
`/o-nas`, where they would earn nothing.

### 3.3 What the page must contain, or it is a prettier void

The mecenat already received a surface nobody returned to. A page with three paragraphs and an
empty "plans" section is worse than a good tab, because emptiness shows at page scale.

| # | Section | Status |
|---|---|---|
| 1 | **What a concrete thing costs** — one evening = X, a recording = Y, scores = Z. Not "cele statutowe": this is the only way 100 PLN/month has an imaginable effect. | **in preparation** — the founder is costing the next concert now |
| 2 | **What already exists because of support** — proof, not promise. Five realised evenings are the material. | writable today |
| 3 | **Who already gives** — the offer promises *"imienne podziękowanie wśród mecenasów cyklu"*. | **BLOCKED — see below** |
| 4 | **Plans for the coming year** | board's |
| 5 | The transfer facts, the form, the contact | exists, moves as-is |

**§3 is blocked and must not ship as a stub.** There are patrons, but none came through the site —
they are family (the founder's mother among them). A named list of one or two relatives under a
heading that says "mecenasi cyklu" reads worse than no list. Either the section waits for its
first non-family patron, or the promise of naming is quietly kept as something that happens
privately rather than displayed. **Do not build the empty shelf.**

### 3.4 The page's real job: an attachment to a personal ask

Decisive context, and it simplifies much: the founder is about to send people a **personal request
for support** for the next concert, by hand. The page is a companion to that letter, not a net for
passing traffic.

Consequences:
- **The address is the deliverable.** `/mecenat` must be sayable and pasteable. Everything else is
  secondary to that.
- Optimising for cold visitors is wasted effort right now. The reader arrives already asked.
- The page must read well **as the second thing** someone opens after a personal message — which
  argues for the cost breakdown (§3.3/1) over persuasion prose.

**Where the notice list sends people:** the `confirmed` state on `/nuntius`, not the "check your
inbox" screen. That screen carries the only live instruction on a double opt-in list, and an unread
confirmation is an address that expires in seven days; a competing call to action there costs
confirmations. On `confirmed` the instruction is already spent and the page is otherwise empty.
Same reasoning rejects putting a preference choice into the confirmation mail.

### 3.5 Creative licence, and its limit

Ania has just criticised over-design, so the difference has to be named or this looks like exactly
what she warned against. **On the sign-up, narrative was a cost — the action is obvious. On the
mecenat page, narrative is the content** — you are asking for a multi-year commitment and have to
explain what for. Invention is legitimate here precisely where it was not there.

The ending stays boring: account number, transfer title, form. Brand voice governs meaning, never
function.

---

## §4 Rejected

### 4.1 Three content streams with checkboxes on the form

Ania proposed splitting into public / patrons / professional, chosen by checkboxes at sign-up.

- **It contradicts her own opening thesis.** She objected that a reader "should not have to
  interpret how to sign up"; two or three boxes put a *decision* in front of a trivial act. Today's
  form has one field and one checkbox; this makes four choices.
- **Only one of the three is a mailing list.** Patrons already exist as a set with recorded consent
  to be contacted (`PatronLead`, [`payments/models.py:111`](../backend/payments/models.py#L111)) —
  what is missing is a sending channel, not a form, and that relation starts with a donation, not a
  checkbox. Professional (festivals, curators, press) is not a newsletter and Ania says so herself:
  **a curator is found and written to by name, not signed up.** That is an address book, and its
  surface already exists at `/press`.
- **Nothing to send.** Three streams mean three texts before every event, written by the person who
  has not yet written one.

**What survives: the structure must anticipate the split.** The consent record knows `surface`,
`clause_version` and `locale` but has **no purpose column** — one implied purpose. Adding it while
the table is effectively empty is free; splitting one consent into three after the first send
requires re-consent from everyone. Do that before any send.

### 4.2 "Promise quality and restraint, not a number of messages"

Rejected, and the reason strengthened over two rounds:

- "Restraint" is an adjective, not a promise: it cannot be kept or broken, so it says nothing.
- The number is the only thing separating this list from every other newsletter, and the reason a
  hesitant reader leaves an address at all.
- It inverts her own opening complaint. "Too much information raises suspicion" — removing the
  count raises more, because "quality and restraint" is what everyone writes before they start
  filling your inbox.
- Legally weaker: consent must be specific, and "the most important information" names no purpose.

The ceiling (§2.1) is the settlement: countable, therefore checkable, without binding anyone to an
exact count. **"Coś dodatkowego" stays out of scope** — anything additional is either a concert
(already covered) or not, and then it is a second list and a second consent.

### 4.3 A button that copies all addresses for pasting into Gmail

Understandable, and more expensive than what it avoids:

- One mis-click between "Do"/"DW" and "UDW" exposes the whole list to every recipient — among the
  most common incidents reported to UODO.
- It would break our own clause on the first send: the clause promises *"linkiem w każdej
  wiadomości"*, and Gmail adds neither the link nor RFC 8058 headers, which we already have built.
- Sending dozens of messages from an unauthenticated domain (no SPF/DKIM/DMARC alignment) lands in
  spam and leaves no record.

**Instead:** a `manage.py` command that takes hand-written, per-concert text and sends it over the
existing channel to `status=CONFIRMED`. The public sender and the unsubscribe headers already
exist. It gives exactly the hand-personalised letter the founder wants, and it is less work than
the button. **The absence of a send deadline makes this more urgent, not less** — "if people sign
up, why not" is precisely how fifteen addresses end up in a CC field one evening.

### 4.4 Smaller rejections

- **Dropping the Latin from the sign-up rubric** (Ania, unsure herself). The Latin rubrics are a
  system — *FUNDATIO*, *CONSILIUM*, *CORPUS*, *VOX*, *INSCRIPTIO FINALIS* stand on the same screen.
  Removing it from one section yields not simplicity but one rubric that looks like a mistake. And
  *NUNTIUS · zaproszenia* carries its meaning in the Polish half. If the Latin goes, it goes from
  the whole site — an identity decision, not a band-level one.
- **Replacing `notice.h2`.** Her alternatives ("Otrzymuj wiadomości o naszych koncertach",
  "NEWSLETTER VOCTENSEMBLE") are interchangeable with any site on the internet: identity lost, no
  legibility gained. Her own best line — *"Zostaw e-mail — wyślemy Ci zaproszenie"* — says what the
  current two sentences already say. Worth noting: *"Zaprosimy Cię na kolejne koncerty"* **is**
  better than the current heading (second person, and the verb names the list); it is a small
  improvement available if the desk wants it, not a reason to open the copy.
- **"Zapisz mnie" → "Zapisz się".** First person rhymes with the first-person clause
  ("Zgadzam się…"). Keep.
- **Chasing Awwwards trends.** 2026 winners split into 3D/immersive (which would make the site
  *more* over-designed — the exact complaint) and typographic restraint, which this site already
  practises. The only thing award-winning editorial sites do that we do not is **pacing** — which
  is Ania's "air", already accepted in §2.4.
- **A "more or less" content choice in the confirmation mail.** Every extra element in the one mail
  that must produce a click lowers confirmations. The developer's own revision — put it on
  `confirmed` instead — is correct.

---

## §5 Open

| # | Question | Owner |
|---|---|---|
| 1 | Cost of the next concert, and of a recording / scores — §3.3/1 cannot be written without it | founder, in preparation |
| 2 | Plans for the coming year (§3.3/4) | board |
| 3 | Does the named-patrons section wait for a first non-family patron, or does the naming promise become private? (§3.3/3) | board |
| 4 | Will the list ever speak about anything other than concerts? If yes it is a second list — better known before the first send than after | board |
| 5 | The gap: someone who does not give but wants more than concert invitations. **Treated as a hypothesis, not an observation** — nobody has asked yet, and a stream with no content is worse than no stream, because someone will choose it and receive nothing. The purpose column (§4.1) keeps the option free. Revisit when the first person asks. | — |
| 6 | Does `/mecenat` become a real page with the vault's mecenat tab removed, or does the tab stay and duplicate it? **Recommendation: remove the tab.** Two surfaces with the same prose drift; the facts are already single-sourced through `data/foundation.ts`, the prose is not. | developer |

---

## §6 Order of work

**Now — independent of every open question:**

1. `/nuntius` `states.confirmed`: name the nearest dated concert, and add the exit to the mecenat
   (3 locales). One edit, two improvements — neither is a live defect (§1).
2. The cheap band fixes: promise by evening with a ceiling (5 places), clause in `<details>`,
   placeholders out, "(opcjonalnie)" unified, checkbox before submit, air + colourless ribbon.

**Next — this is where the money is:**

3. `/mecenat` as a real page, the mecenat out of the vault (§3.2), with §3.3 filled in as far as
   the answers allow and **no empty patron shelf**.
4. The review of the mecenat that never happened — starting with the two contact addresses standing
   side by side, one of them personal, on a page that otherwise speaks as an institution.

**Before any send, however spontaneous:**

5. The `manage.py` send command (§4.3).
6. The purpose column on the consent record (§4.1).

**Deferred until someone asks:** streams, content choice, anything for "those who want more".
