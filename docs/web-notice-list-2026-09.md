# The concert notice list — Etap 2b (2026-09)

What `docs/web-board-feedback-2026-09.md` §1 lists as "2b — concert notification list". Built
2026-09-05. This file is the authority for it; the roadmap's paragraph points here.

## How to read this file

- **§1 What it is, and what it refused to become** — read this before questioning any decision.
- **§2 The shape** — the two surfaces, the three invitations that are not surfaces, the two
  secrets, the evidence. Read this to change it.
- **§3 Decisions that will look odd** — each with the reason it beat the obvious alternative.
- **§4 Traps** — things that look correct and ship wrong. Four of them are new.
- **§5 What is deliberately absent** — sending. It is a decision, not an omission.
- **§6 Runbook** — what the developer has to do, in order, and what was verified here.

Companion to `.ai/07_marketing_public_site.md` (rules) and `docs/web-landing-guardrails.md`
(the negative space). Nothing here overrides those two.

---

## §1 What it is, and what it refused to become

**One mail per evening, and nothing else.** The board asked for a "newsletter"; the roadmap had
already reduced that to a concert notification list, which is the only version that survives the
site's own no-fabrication rule and its *kairos not chronos* direction. Nothing here schedules,
segments, tracks opens or measures anything.

**Its reader already exists on the site.** /koncerty ends its night stretch with the *Nondum*
station — "Koncert bez daty. Termin i przestrzeń wyznaczą darczyńcy." A person who has just read
that has an unmet need with exactly one honest answer that is not money: *we will write to you
when there is a date.* The band sits directly under it, still on the night ground, as the last
thing the dark stretch says before the page steps into parchment.

**The blocker was documents, and the documents were ours.** The roadmap's table said "blocked by
RODO documents", which reads like an external dependency and is not one: nobody else writes
`docs/legal/rodo-ropa.md` or the privacy policy. That is why this stage went before Etapy 3 and 4,
whose blockers (a technical rider from the ensemble; a board decision on the legal form of paid
activity) genuinely are external.

---

## §2 The shape

### The two surfaces

| | where | what it does |
|---|---|---|
| the band | `/koncerty`, between the *Nondum* station and the rite map | takes an address and a consent |
| `/nuntius` | its own route, in three locales, `noindex` | spends the token a mail's link carries |

`Nuntius` is Latin for the message and the messenger. It is a route name rather than a translated
slug so that one word serves all three locales and the backend's link table
(`outreach/services.NOTICE_PATH`) has one shape per locale and no vocabulary to keep in step.

### The three invitations, which are not surfaces

Added 2026-09-05, after the question "where else should the sign-up be offered". **One form, three
doors.** The landing's open card (`PathSection`, under the gold CTA), the closing rail of the
newest concert (`ConcertPage`, the forward slot that stood empty), and `/kontakt` after the three
channels each name the list and link to `/koncerty#nuntius`. None of them takes an address.

A second form was the obvious answer and is the wrong one for a reason that is not aesthetic:
`surface` is a field on the consent record, so a second form means a second value describing a
second screen on which a clause was read — the clause, its version, and the policy would then have
to move in three places instead of two. The click path a reader took to reach the band is not
evidence of anything and does not belong in that column; Plausible already measures it.

Three consequences worth keeping:

- **The invitation is CHROME** (`i18n/content/nuntius.invitation`), not desk copy, on the file's own
  rule — a link label repeated on three pages that printed Polish under English prose is a control
  the reader cannot read. It also says nothing about whether a date exists, so the day the sixth
  evening is announced only the band's own heading changes.
- **`/kontakt` gets a route, not a channel.** The list there stands outside `dl.channels`, because
  that list's head is `Tres ianuae` and counts its doors — a fourth row makes the Latin false.
- **The clearance is `scroll-margin-top` on `.notice-band`**, not an offset in a scroll handler:
  three different mechanisms deliver a reader to that hash (a native jump on a cold load, Astro's
  own hash scroll after a swap, Lenis on a fine pointer) and only one of them can be given an
  offset by hand.

### The backend: a new app, `outreach`

The tenth Django app, and the name is the domain: **people who are not members and asked to hear
from us**. `payments` holds `PatronLead` only because the donation vault happened to be where the
first public form lived; `notifications` is user-scoped machinery for people who have accounts.
Etap 3's press contacts, if they are ever stored, belong here too.

- `ConcertNoticeSubscription` — one row per address, holding the CURRENT state.
- `NoticeConsentEvent` — an append-only log of every consent granted and withdrawn.
- `POST /api/outreach/notices/{subscribe,confirm,unsubscribe}/` — public, unauthenticated,
  throttled, and cookie-less, exactly like the payments endpoints beside them.
- `POST /api/outreach/notices/unsubscribe/<token>/` — the same withdrawal with the token in the
  path, for mail clients rather than for the page (see §3, one-click unsubscribe).

### The two secrets, and why they are two

`confirm_token` grants a consent. `unsubscribe_token` travels in every mail this list will ever
send. One shared secret would mean a link printed in a dozen future notices could re-establish a
consent that had been withdrawn.

The confirmation token is **not cleared when it is spent**. Clicking twice — or a mail client that
prefetched the page before the reader clicked — has to read as "already confirmed", not "invalid
link". What stops an old link from resurrecting a withdrawn consent is the status check, not the
absence of a secret.

### The evidence, which is the whole point

`PatronLead` validates a consent and never stores it. That is fine for a donation: the transaction
that follows is the corroboration. **A notice list leaves no other trace**, so if the consent is
ever questioned this data is the entire answer. Hence:

- `confirmed_at` — the moment the double opt-in closed. This *is* the consent.
- `clause_version` — which wording was on screen (`outreach/consent.py`, server-owned).
- `surface` — where it was given, from an allowlist, because a public endpoint writes it.
- `NoticeConsentEvent` — see below.

**What is deliberately not collected:** no name (a notice needs no salutation), no IP, no user
agent. Double opt-in already proves control of the mailbox, which is the fact in dispute; an IP
would only add a second identifier to defend.

**Why the log exists at all.** The subscription row alone cannot be the evidence. An address that
consents, withdraws, and later signs up again RESETS that row — `confirmed_at` and the clause
version come to describe the new cycle, and the record of the consent under which mail had already
gone out is overwritten. This was found while writing the retention paragraph of the privacy
policy, in a design that had otherwise been reviewed twice. The log is one small append-only table
and it makes the claim in §7 of the policy true.

### Retention, and the sweep that enforces it

`outreach.purge_notice_records`, daily on Celery beat, in two sweeps:

1. A sign-up nobody confirmed, whose link has expired (7 days), is an address held with **no
   consent**. It is hard-deleted — unless the row also carries consent events, meaning this
   address did consent once and abandoned a later re-subscription.
2. Any row that is **not a live consent** and whose whole history is older than 3 years —
   withdrawn, and equally the abandoned re-subscription sweep 1 hands over. The accountability duty
   outlives the consent; it does not outlive the limitation period for a claim about the mail it
   licensed.

**The two sweeps must meet, and reading sweep 2 as "the withdrawn ones" leaves a gap they both
step over:** a PENDING row carrying consent events is skipped by sweep 1 for having a history and
by a status-filtered sweep 2 for not being UNSUBSCRIBED, so it is deleted by neither — an address
held forever with no consent behind it. Sweep 2 therefore names what it keeps (a CONFIRMED row)
rather than what it takes, and tests `MAX(consent_events.at)`, which is also the period the RoPA
publishes: 3 years *from the last event*. A row with no events at all yields NULL there, and NULL
is never `< cutoff` — which is what keeps a sign-up still inside its seven days out of sweep 2.

Both periods are what the privacy policy publishes in § 7. **They move together or the document
starts lying.**

### The documents

- **Privacy policy → 1.3** (`web/src/content/pages/polityka-prywatnosci.yaml`, all three locales):
  § 3 gains the processing, § 4 the purpose and basis, § 5 discloses **Resend** as a processor,
  § 6 gains the transfer to the USA on SCCs, § 7 the two retention periods, plus a history entry.
- **`docs/legal/rodo-ropa.md`** — processing activity 11.
- **`docs/legal/klauzula-informacyjna.md`** — section C: where the clause lives and what binds it.
- **`docs/legal/podprocesorzy.md`** — Resend's row now says it carries addresses of people outside
  the ensemble, which is a new category of data subject rather than a new kind of message.

---

## §3 Decisions that will look odd

**The sign-up endpoint answers 202 for every outcome, including an address already on the list.**
Any other shape turns a public form into a membership oracle: type an address, read the status,
learn whether that person subscribed. Nothing is sent to an already-confirmed address either — a
"you are already subscribed" mail is an unsolicited mail to whoever really owns it.

**The confirmation link opens a page that then asks, rather than confirming on arrival.** Link
scanners (Outlook Safe Links, antivirus proxies, preview cards) fetch the URLs in a mail. A
GET-triggered confirmation would be spent by the scanner before the reader ever clicked, forging
the one fact double opt-in exists to prove. A scanner fetches HTML; it does not hydrate an island.
This is why `/nuntius` needs JavaScript, and the trade is deliberate.

**The clause version is server-owned, not submitted by the form.** A client that could name the
wording it agreed to could name any wording. The cost is that the clause text, the constant and
the policy's version move in one commit — which is stated in three places.

**The consent clause is chrome, not copy on the desk.** The site's rule is completeness: a field
that may print Polish beside English is copy; one that would be BROKEN in Polish on an English
page is chrome (copy-desk spec §6r). A per-field fallback here would let an English reader tick a
Polish sentence while the database recorded a clause version as if they had read it. That is the
one fallback on this site that would make a record untrue. The band's own voice — heading, lede,
and what it says once the mail is on its way — IS on the desk, under `notice.*` in
`koncerty.yaml`, because that is the ensemble's language and Florent should edit it.

**The confirmation mail is not in the gettext catalogue.** gettext makes the English msgid the
source and every other language a translation of it. That is right for the panel, whose UI is
authored in English, and backwards for a mail in VoctEnsemble's voice on a site where **Polish is
canonical**. The three locales stand side by side in `outreach/copy.py`, Polish first.

**`surface`, not `source`.** DRF's `Field` already owns an attribute called `source`, so a
serializer field of that name shadows its binding machinery. The column is named after the word
the API can safely use, so the two never drift.

**One-click unsubscribe points at the API, not at `/nuntius`.** `List-Unsubscribe` +
`List-Unsubscribe-Post` (RFC 8058) is what Gmail and Yahoo have required of bulk senders since
2024, and what the RoPA already promised: withdrawal in one click, in every message. But the
client POSTs to the URI itself and reads the status code, and `/nuntius` is a static document
whose island only works once a browser has run it — a header aimed there advertises a withdrawal
nginx answers with 405 while the reader is told it succeeded. Hence a route with the token in the
path. It answers a GET with a redirect to the page rather than acting, which is the RFC's rule and
also this app's own: the scanners that fetch every URL in a mail must not end consents.

**A spam complaint from a public subscriber ends the consent; from a member it only sets a flag.**
Anymail's tracking webhook reports on both, and until it looked past `UserProfile` it did nothing
at all for an address with no account. For a member the relationship survives a dead mailbox —
`email_undeliverable` stops the sending and the account stands. On this list the mailbox *is* the
relationship, and a complaint is a person telling a third party they never agreed: the row goes to
UNSUBSCRIBED and the log records a WITHDRAWN event, so what we did is provable too.

---

## §4 Traps

- **A page-scoped Astro rule cannot reach inside an island.** Astro appends `[data-astro-cid-…]`
  to every compound of a page's `<style>`, and an element React rendered carries no such attribute
  — so `.notice-form { … }` written in `KoncertyPage.astro` would compile to a selector matching
  nothing, silently. Everything the form and the receipt page wear lives in `styles/notice.css`, a
  global sheet, which is the same arrangement `styles/vault.css` already is and for the same
  reason. The `.pill` affordance the band sits next to is restated there rather than reused.
- **HTML injected into an island never meets the build's typography or link passes.**
  `lib/typoHtml` copies `<astro-island>` subtrees through byte for byte (rewriting text React is
  about to hydrate is a hydration mismatch), and `Typo` finds no string leaf inside a
  `dangerouslySetInnerHTML` fragment. So the consent clause is prepared at build by
  `lib/islandCopy.chromeHtmlForIsland` — localize hrefs, typeset, open links in a new tab. Without
  it the clause would have been the one sentence on the site that never met `lib/typo`, and in
  English its "privacy policy" link would have pointed at the Polish page.
  `externalizeLinks` moved out of `lib/vaultCopy` into that new module so there is one
  implementation, not two.
- **`SoftDeleteQuerySet.delete()` is a soft delete, and a retention sweep must never do that.** A
  flagged row still holds the address. The sweep uses `hard_delete()`, and a test asserts the row
  count rather than the manager's view of it — the assertion `all_objects.count() == 0` is the one
  that would have caught it.
- **The resend cooldown had to learn which state it guards.** It exists for one case: an address
  being asked to confirm over and over by somebody who does not own it — always a PENDING row,
  because reaching UNSUBSCRIBED needs a token that only ever arrives in the mailbox itself.
  Applied to every state, it silently swallowed the sign-up of a reader who withdrew and changed
  their mind, while the form told them to check a mailbox nothing was coming to. Found by a test
  that had been written to assert the opposite.
- **`emails/base.html` says "VoctManager" and "you are a member of the VoctEnsemble artist
  network", and loads a Google font.** All three are true and fine for a member's transactional
  mail and none of them is true of a public subscriber — the third is an IP disclosure to a third
  party they never consented to. Three `{% block %}` wrappers were added (`webfont`,
  `footer_brand`, `outer_note`) with no change to what any existing template renders.
- **And so does the `From:` line, which is read before any of that.** `DEFAULT_FROM_EMAIL` is
  `VoctManager <…>`; a person who asked a choir about its next concert has never heard of the
  panel. `PUBLIC_FROM_EMAIL` is the sender for mail to non-members, and `dispatch()` grew an
  optional `from_email` for it. Its default keeps `DEFAULT_FROM_EMAIL`'s ADDRESS and changes only
  the display name — that domain is the one with SPF/DKIM, and a prettier address nothing
  authenticates would send public mail to spam, which is worse than a wrong name.
- **`/nuntius` stays OUT of `TRANSLATED_ROUTES`**, for the reason the /404 leaf records: that
  ledger lights up links, a switcher and an hreflang graph, and nothing on this site links here —
  only a mail does. Its canonical is composed from `lang`. It IS in the sitemap filter, because
  the integration discovers real route files and the page ships `noindex`.

---

## §5 What is deliberately absent: sending

There is no way to send the concert notice, and that is a decision.

**Its premise expired on 2026-09-05**, the day it was written: the developer says the next
concert's date is known and a letter would go out shortly. Nothing below is wrong yet — the send
path still does not exist — but the reasoning is now a countdown rather than a principle, and two
things move with it. The band's own heading (`koncerty.yaml` → `notice.h2`, "Damy znać o nadchodzących
koncertach.") becomes false the moment the evening is published, and the *Nondum* station the band
stands under is replaced by that evening, which takes the band's context with it. The three
invitations added the same day were written to survive that: they name the list, never the pause.

The argument it was built on, kept because it is why the shape is what it is: the evening it
would announce **did not exist** — the whole premise of the *Nondum* station the band stands
under — so a dispatch pipeline built then would have been built against an imagined message, for
a list with no members, and rewritten the day a real concert had a real date. The roadmap says the
same thing in one line: "Sending can use anything afterwards."

What exists is the part that cannot be improvised later: a consent that is provable, withdrawable
and time-bounded. Sending is a management command over `status=CONFIRMED`, grouped by `locale`,
with `outreach/services.unsubscribe_url(...)` in every message — the function is already written
and tested, precisely so that day is small — as are `unsubscribe_headers()` (the RFC 8058 pair,
already carried by the confirmation mail) and the public sender and mail shell §4 records. **That
day is now the next piece of work on this list**, and what it still needs is the notice's own
template in three locales, the command, and a first live send through Resend, which nothing here
has ever done.

No CSV export from the admin, deliberately: a spreadsheet of subscriber addresses on a laptop is
the failure mode this stage exists to avoid, and the ROPA would have to say so.

---

## §6 Runbook

**What the developer does, in this order.** Environment: production server, repo root.

1. `git pull`
2. **`make migrate`** — nothing applies migrations automatically in any environment
   (`outreach/0001_initial`). Forgetting this leaves the new code on an older schema.
3. `docker restart voct_celery` **and the beat container** — the purge task is new, and beat does
   not pick up a schedule change without a restart.
4. Rebuild and deploy `web/` as usual.
5. Optional env, both safe to leave unset today: `PUBLIC_SITE_URL` (defaults to `FRONTEND_URL`;
   needed only if the public site ever moves off the panel's origin) and `PUBLIC_FROM_EMAIL`
   (defaults to `DEFAULT_FROM_EMAIL`'s address under the name "VoctEnsemble" — set a real
   VoctEnsemble mailbox here **only after** its domain has SPF/DKIM).
6. `cd web && npm run copy:sync` — the band's four new Polish fields and the policy's new
   paragraphs are on the desk only after this runs, and it needs a clean `src/content/` and the
   `COPYDESK_*` credentials. Until it runs, Florent sees the old segment list.

**What I did not do, and someone must:** accept and archive Resend's DPA
(`docs/legal/podprocesorzy.md` checklist). The policy now names Resend publicly as a processor for
data belonging to people outside the ensemble, so that checkbox stopped being paperwork.

**Verified here.** Backend: `outreach` 26 tests green, ruff and mypy clean, and the full suite
(1225 tests) unchanged — its one error is a pre-existing SQLite-only JSONField `contains` lookup in
`documents`, which Postgres supports. Web: `npm run build` clean, 43 pages, register audit 2684
nodes with its one pre-existing note, typography 44/44; `npm run test:copydesk` 29 green and the
extractor now emits 924 keys. `npm run check` reports 13 errors, all of them pre-existing in
`rite/render.mjs` (the video harness), none in the files touched here. The developer reviews the
rendering.

**Not verified, because it cannot be from here:** a real mail through Resend. The confirmation
message has only ever been rendered into `locmem`. First live sign-up on production is the test —
check that the link's host is right, that the mail does not land in spam, and that the footer says
VoctEnsemble rather than VoctManager.
