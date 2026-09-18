# VoctFoundation — foundation and support page

Date: 2026-09-18.
Status: stage 1 (the page itself) built and accepted 2026-09-18; stage 2 (site migration) built 2026-09-18, unreviewed in a browser and uncommitted — see §9. Left open: the EN/FR prose overlays for `/fundacja` (a desk run), and `make copy-sync` after this stage's hand-edited overlay rows.
User-confirmed scope: launch with VoctEnsemble and its concerts only. Other foundation activities are early ideas and must remain off production, including teasers.

Hero design follow-up (2026-09-18): [hero-only implementation plan](web-foundation-hero-2026-09.md). The user requested a more contemporary, visually distinct foundation opening. That plan supersedes this brief's visual direction only for the hero and its adjacent photograph; it does not expand the current task to the rest of this page or the site migration.

This brief develops [the first outreach review, §3](web-outreach-review-2026-09.md) and [the independent review](web-outreach-second-review-2026-09.md). It recommends a broader institutional destination than the original patronage page. The design, routing and offer below are recommendations, not previously accepted board decisions. Handing this brief to an implementer is the starting point for that stage; unavailable facts must never be invented.

## 1. The decision

**The page explains what allows VoctEnsemble's music to continue, and gives an individual or an organisation a practical way to help.**

Use `/fundacja` as its canonical address, inside the existing VoctEnsemble site. Name the navigation entry **„Fundacja i wsparcie”**. Preserve the useful spoken address `/mecenat` as an alias leading to `/fundacja#mecenat`; it must not contain a duplicate page. Localised counterparts follow the existing `/en/…` and `/fr/…` scheme.

Keep the present visual identity. The ensemble and its resident foundation should feel like the same undertaking seen from two positions: the concert and the work that makes it possible. A separate brand would make a supporter learn an unnecessary distinction just before trusting the recipient of a transfer.

The page serves three journeys:

| Visitor | Question the page answers | Destination |
| --- | --- | --- |
| Someone personally invited to help | What would my support sustain, and how do I give? | Costs, then `#wsparcie` or `#mecenat` |
| A company, institution or potential host | What can we help produce, and who will discuss it? | `#partnerstwo` |
| Someone verifying the foundation | Who receives the money and answers for the work? | `#fundacja-i-dokumenty` |

Personal requests are an important entry point, not evidence that all visitors already know the ensemble. The opening must explain the two names without requiring a visit to `/o-nas`.

## 2. What is specific to Voct

- The public artistic identity is VoctEnsemble; VoctFoundation is its organisational and legal support. The current site calls the ensemble the foundation's resident ensemble. The published statute, §6.3, permits that operating form.
- The real subject is carefully prepared vocal programmes, especially the Concerts Spirituels cycle: sacred music, repertoire spanning centuries, and programmes shaped for a place and a listening experience. Explain what support sustains through this actual practice.
- Current landing copy names singers' fees as the largest concert expense, followed by scores, sound, lighting and travel. These are existing editorial facts, not a completed budget or permission to invent proportions.
- The concert archive contains both free and paid admission. Do not claim that all performances are free. `pochwala-stworzenia` currently has free admission and a published Warsaw performance on 2026-10-11; fetch its public details from the concert corpus, not from this document.
- Earlier performances establish the ensemble's artistic record. They do not establish who paid for them. Do not relabel the archive as projects financed by the foundation or by donors without evidence for each claim.
- The existing recurring mechanism is a standing order in the donor's bank. The patronage form records interest and contact details; it neither creates that order nor proves a payment.

## 3. Visual direction: the same paper, closer to the work

The composition should resemble the practical pages accompanying a concert programme: a human opening, a clear account of preparation, and readable particulars. The visual argument is **music has both an audible result and material conditions**. Express that relationship through the layout, not a new decorative metaphor.

| Keep from the site | Give this page its own emphasis |
| --- | --- |
| Shared navigation, footer, page width, gutters, rules and spacing rhythm | A compact opening; the next section begins within reach without a full-screen ceremony |
| `--paper`, `--paper-soft`, `--ink` and the existing restrained accents | A broad paper-soft band for costs; a second quiet administrative ending |
| Cormorant for display, IBM Plex Sans for reading, Cinzel for existing rubric conventions | Concrete Polish headings and short paragraphs; functional labels remain immediately understandable |
| IBM Plex Mono for data where alignment matters | Selectable bank and registry numbers, orderly cost rows, clear dates and units |
| Existing photographic treatment and motion vocabulary | One substantial documentary photograph of rehearsal/preparation if a suitable approved image exists; otherwise an accurately captioned concert photograph |

Desktop: in the costs band, put the current artistic undertaking on the left and its material needs on the right, separated by the site's existing rule language. Use the same alignment later for partnership possibilities and contact. Other sections use the established reading measure, not a grid of identical cards.

Mobile: keep the same document order, place costs below the project explanation, and let figures and IBANs wrap safely. Use normal page scrolling and the existing navigation. All main actions must work without discovering an animation or opening an introductory audio choice.

One hero, one major photograph, one cost composition. No full-screen donation appeal. The proof section can use small existing concert images only if they add identification. Use existing components such as `BleedImage` where appropriate; no new image generator or stock imagery. Amounts, forms and legal particulars remain fully legible throughout motion. Respect reduced motion and preserve useful static content without JavaScript.

## 4. The six sections, in order

Target roughly 650–950 words of visible Polish editorial text before optional form/help details. This is an editing guide, not a reason to remove necessary payment information. The following Polish text is proposed product copy; factual dependencies are named alongside it.

### A. Opening — identity and immediate routes

Eyebrow: **„Fundacja VoctFoundation”**.

H1: **„Żeby muzyka miała ciąg dalszy.”**

Lead: **„VoctFoundation tworzy zaplecze organizacyjne i finansowe VoctEnsemble. Pomagamy przygotowywać kolejne koncerty cyklu Concerts Spirituels — od pracy nad programem i prób po spotkanie z publicznością.”**

Primary action: **„Chcę wesprzeć”** → `#wsparcie`. Secondary text link: **„Dla firm i instytucji”** → `#partnerstwo`. Add a compact section index using the existing page-index pattern: **„Na co idą środki”**, **„Mecenat”**, **„Partnerstwo”**, **„Fundacja i dokumenty”**. Do not make the reader traverse the story to find transfer details.

### B. Current work and costs — `#na-co-ida-srodki`

Heading: **„Z czego powstaje koncert”**.

Explain that the public hears the finished programme, while support sustains preparation and the people delivering it. Example: **„Zanim spotkamy się na koncercie, trzeba przygotować program, zdobyć partytury i przepracować go na próbach. Potem dochodzą dojazdy oraz realizacja dźwięku i światła. Wsparcie pomaga pokryć tę pracę — przede wszystkim honoraria śpiewaków.”** Adapt the list to the actual undertaking; not every concert needs every production element.

Use one editorially selected current project, initially `pochwala-stworzenia` if it remains current at implementation. Give its title, short purpose, published performance facts and a link to its existing programme. It is an example of current work, not automatically a restricted fundraising campaign. The board must confirm any claim that this particular concert has a funding shortfall.

Render one of two complete states:

| Available information | Public presentation |
| --- | --- |
| No approved budget | Concrete cost categories and what they enable, with no totals, percentages, progress bar or empty numeric cells. This is a valid launch state. |
| Approved budget | A short table of genuine cost lines, total cost, secured cash, remaining cash need and an “as of” date. Explain the time scope: one performance, preparation of a programme, or the season. List support in kind separately. |

Budget input must define the project/period, currency, consistent gross/net basis, line items, secured funding, remaining need, owner, review date and treatment of surpluses or changed plans when collecting for a restricted purpose. Avoid double counting donated services and cash costs. Do not reuse the vault's 20,000 PLN goal as the concert budget. Do not use gateway-only totals as the total raised across transfers, companies and other channels.

Keep any dated appeal under an explicit expiry/update policy: its owner reviews it after the final relevant occurrence and before the next build. After the date, the page must switch to factual past tense or a general support state; it must not silently pick the next concert as a funding appeal. General support stays available. The eventual implementation must cover expiry on a static site, not assume every visit triggers a rebuild.

### C. Artistic evidence — `#dorobek`

Heading: **„Muzyka, która już wybrzmiała”**.

Two compact examples are enough: `wcielenie` and `9-kart`. Pull titles, real occurrences, images and programme links from the existing corpus. Explain in one sentence each what was made: an authored programme, its repertoire and the setting. Multiple performances of one programme are not multiple invented projects.

This is the ensemble's record. Use **„Dorobek VoctEnsemble”**, not **„Dzięki Waszym wpłatom”**, unless the latter has financial evidence. Do not turn programmes concerning war or suffering into claims that a music donation funds humanitarian relief. End with **„Poznaj pozostałe koncerty”** → `/koncerty`.

### D. Individual support — `#wsparcie`, with `#mecenat` and `#przelew`

Heading: **„Pomóż przygotować kolejne koncerty”**.

Provide two plain, visible choices, with regular support first because it answers the continuity argument. Do not introduce membership ranks.

- **„Wspieraj co miesiąc”** (`#mecenat`): **„Regularne wsparcie pomaga planować próby i kolejne programy z wyprzedzeniem. Zlecenie stałe ustawiasz w swoim banku; tam też zmieniasz kwotę lub je odwołujesz.”** Suggested examples may remain 50, 100 and 200 PLN, with any other amount welcome. They are examples, not minimums, purchase prices or promises that a sum buys a rehearsal.
- **„Wesprzyj jednorazowo”**: open the existing donation vault in place. Also offer a direct transfer. Preserve the payment gateway and return flow; this page does not build a new checkout.

One shared, statically rendered transfer block (`#przelew`) supplies recipient, PLN account, copy controls and the existing statutory-purpose transfer title from the appropriate source. Use `FOUNDATION` for identity and accounts. EUR may be available as an explicit alternative; never infer currency from language or invent a bank/BIC. A QR code, if retained, creates a one-off transfer, not a standing order. Copying is convenient; selectable text is essential on the same phone used for banking.

Make the scope explicit: **„Darowizny wspierają działalność statutową VoctFoundation, w tym przygotowanie koncertów VoctEnsemble.”** A featured concert does not change that designation. A future restricted campaign requires an explicit operational decision, consistent payment references and published handling of surplus/cancellation.

After the bank instructions, optionally expand **„Daj nam znać, że dołączasz”**. Move the existing patron-interest form here: first name, last name, email and the existing purpose-specific consent. Keep the endpoint and validation contract. The entire form is optional to the donor; its required fields still apply when submitted. Explain that submitting does not transfer money or start a standing order.

Success copy: **„Dziękujemy za zgłoszenie. Przekazaliśmy je fundacji. Jeśli chcesz wspierać nas regularnie, ustaw zlecenie stałe w swoim banku.”** Display success only after an accepted API response. Preserve recoverable error feedback and entered values. Provide `patronat@voctensemble.com` as visible text and mail link, including a no-JavaScript alternative. Do not treat the lead as a confirmed donor or add it to concert mailings.

Review the existing four patron benefits before migrating their copy. For launch, offer the actual contact channel; publish named thanks only with permission and a real place to fulfil them. Priority invitations, scheduled updates, open rehearsals and annual donation summaries require a named operational owner before becoming promises. There is no multi-year commitment merely because support is regular.

### E. Companies and institutions — `#partnerstwo`

Heading: **„Współtwórz z nami koncert”**.

Three short rows should name useful forms of involvement:

| Form | What a reader can discuss |
| --- | --- |
| Support a particular production | Contribute to an agreed concert or an identified production expense. |
| Support continuity | Discuss a defined period of cooperation around the ensemble's concert activity. |
| Provide practical resources | Offer a performance/rehearsal space, transport, printing or production services where they match an actual need. These are possibilities to discuss, not claims of current shortages. |

Explain the next step: **„Napisz, jaki projekt lub rodzaj współpracy Cię interesuje. Ustalimy zakres wsparcia, sposób podziękowania i podsumowanie realizacji.”** Contact: `FOUNDATION.mail.patronage`, with a prefilled subject **„Współpraca z VoctFoundation”**, a copy action and the visible address. No new contact form.

Possible agreed acknowledgements include a project-page/programme credit or logo, where the venue and organiser permit it. Present these as matters for agreement, not guaranteed inventory. Do not promise audience reach, sponsor influence over repertoire, exclusivity, private concerts or advertising exposure without terms. Keep sponsorship with agreed reciprocal deliverables distinct from a donation. A company seeking to book a performance goes to `FOUNDATION.mail.booking` through a secondary **„Chcesz zaprosić zespół na koncert?”** link.

No generic Bronze/Silver/Gold packages. No empty partner-logo strip. A short existing-partners line can appear once names, actual roles, project scope and publication permissions are supplied. A venue or past collaborator is not automatically a financial sponsor.

### F. Responsibility and documents — `#fundacja-i-dokumenty`

Heading: **„Kto za tym stoi”**.

Use a short foundation/ensemble relationship statement and the board's published names and practical responsibilities: Florent de Bazelaire — artistic direction; Anna Marcisz — organisation and communication; Krystian Bugalski — technology and tools. Confirm current roles before publication. Do not fabricate formal offices from these descriptions or copy three full biographies from `/o-nas`.

Show the legal name, seat and registry identifiers from `FOUNDATION`, the existing statute at `/docs/Statut-VoctFoundation.pdf`, the privacy policy, and access to donation terms through the existing working mechanism. Add only actual approved activity/financial reports, named by type and year. No disabled downloads, invented reports, “coming soon” shelf or unsupported OPP/1.5%/tax-deduction claims.

One concise help block answers: whether a standing order can be changed; whether the optional form is needed to transfer money; who to contact about support; and where to find the foundation's documents. Keep answers beside the relevant action where possible rather than repeating an entire FAQ. Close with the patronage contact, not another large manifesto or an additional newsletter form.

## 5. Discovery and migration

- Shared desktop and mobile navigation: replace the generic **„Wesprzyj”** destination with **„Fundacja i wsparcie”** → `/fundacja`. Remove its vault trigger. Explicit one-off donation buttons and amount choices keep opening the vault directly; do not send a payment-ready reader through the whole page.
- Shared and landing footers: add the canonical foundation destination. Contact-page institutional links lead to `#fundacja-i-dokumenty`; patronage links lead to `#mecenat`. Keep `/o-nas#fundacja` and the existing board anchor useful with a concise summary and onward link. Do not move the founder's artistic letter.
- Once this page is usable, remove the duplicate patronage tab/prose from the vault and leave a visible link **„Wolisz wspierać regularnie?”** → the localised `#mecenat`. The recurring explanation also present in the QR method must point to this owner rather than become another copy of the full offer.
- Preserve legacy `?donate` URLs and payment returns. A link from the completed newsletter-confirmation state may point to `#mecenat`; leave the pending-confirmation flow focused on confirmation.
- Foundation routes and their aliases must open without the audio/intro gate, including a fresh session and navigation through Astro transitions. Use the shared gate owner; do not add competing page-level gate logic.
- One canonical page per locale, correct language links, metadata and sitemap entries. Aliases redirect; they must not generate duplicate indexed content. Preserve the ensemble/foundation distinction in structured data rather than representing one as the other's alternate legal name.

## 6. Implementation map and stage boundary

Work in the existing `web/` Astro application on the Windows development machine, repository `C:\Users\kryst\Moje aplikacje\VoctManager`. No separate Sites project, new frontend framework, backend model, payment provider or donor portal is required. This session produces only the brief. Start implementation in a fresh session from this file.

| Files / location | Intended work |
| --- | --- |
| New `web/src/components/pages/FoundationPage.astro`; `web/src/pages/fundacja.astro`, `web/src/pages/en/fundacja.astro`, `web/src/pages/fr/fundacja.astro`; `web/src/styles/foundation.css` | One shared page, thin locale routes and scoped page composition using existing tokens/layout. |
| New `web/src/content/pages/fundacja.yaml`, `web/src/i18n/content/fundacja.ts`; existing `web/src/content/pages.en.yaml`, `web/src/content/pages.fr.yaml`, `web/copydesk/extractPages.mjs` | Polish copy, typed schema/chrome, EN/FR overlays and copy-desk registration. Follow `ContactPage` / `KONTAKT_PAGE` / `pageCopy`; do not put editorial prose in component literals. |
| New `web/src/islands/PatronInterestIsland.tsx`; existing `web/src/islands/landing/vault/MecenatPanel.tsx` and `web/src/islands/landing/api/patronage.ts` | Extract the functioning interest form for the page; reuse the API client. Static content and transfer details stay in Astro. Retire the obsolete panel after the vault migration. |
| Existing `web/src/data/foundation.ts` and concert loaders/corpus; optional new `web/src/data/foundationSupport.ts` | Reuse identity and programme facts. Add a small typed support record only for genuinely needed selection/budget metadata; omit unapproved optional data rather than insert fake values. No CMS or duplicate concert record. |
| Existing `web/src/islands/landing/vault/VaultModal.tsx`, `web/src/content/pages/skarbiec.yaml`, `web/src/i18n/content/skarbiec.ts`, `web/src/i18n/content/skarbiecChrome.ts`, `web/src/styles/vault.css` | Remove the patronage tab and migrate its editorial ownership; keep one-off payment behavior and replace recurring prose with the page link. Inspect related imports/styles before deleting. |
| Existing `web/src/components/SiteChrome.astro`, `web/src/components/SiteFooter.astro`, `web/src/islands/landing/SiteFooter.tsx`, `web/src/i18n/ui.ts`, `web/src/i18n/config.ts` | Both navigation forms, both footer implementations, labels and translated-route registration. |
| Existing `web/src/components/pages/AboutPage.astro`, `web/src/components/pages/ContactPage.astro`, their matching content/chrome files and EN/FR overlays | Concise institutional summaries and contextual links; retain functioning old anchors. |
| Existing `web/src/components/DocumentGates.astro`, `web/astro.config.mjs`, `infra/nginx/nginx.conf`; new locale `/mecenat` alias routes if needed for local preview | Verify the actual gate and redirect mechanism, then make narrowly scoped changes. Ensure permanent production redirects and useful local behavior agree. Avoid a JavaScript-only redirect. |

Complete the foundation page and migration as one coherent release; a temporarily duplicated patronage surface is an internal development state, not the delivered design. The optional `/nuntius` link is a follow-up, not a prerequisite. Check its current source before touching it; outreach work is changing independently.

Verification once at the end of implementation: on the Windows development machine, run `npm run check` and `npm run build` from `C:\Users\kryst\Moje aplikacje\VoctManager\web`. Run `npm run test:copydesk` there if changing the copy extraction contract. The developer verifies UI in their own browser; do not inspect built output or automate screenshots unless asked.

Acceptance: PL/EN/FR coverage; static readable identity/transfer details; fresh-session and deep-link access; no expired appeal; optional form validation, accepted/error states and no double submit; copy success/failure with selectable fallback; keyboard access and reduced motion; unchanged one-off payment flow; working aliases, documents and old anchors; no empty sections or invented facts. Any backend change discovered to be necessary is a separately scoped step with the project's backend checks.

## 7. Content readiness and later work

| Material | Owner / next decision | Does absence block the page? |
| --- | --- | --- |
| Approved concert budget and funding scope | Florent + board: supply the fields in §4B | No; publish the qualitative cost state. Blocks financial claims and a numerical appeal. |
| Current project selection, funding need and expiry behavior | Board + implementer | No; use general concert support if no current appeal is approved. |
| Rehearsal photograph and caption/rights | Ensemble / image owner | No; use an existing approved concert image or a typographic opening. |
| New patron benefits and public acknowledgements | Board: assign fulfilment and permissions | No; publish the actual contact route and omit unapproved benefits/names. |
| Partner recognition, specific in-kind needs | Board / cooperation lead | No; invite a conversation without pretending terms or shortages are settled. |
| Existing reports and current legal/board details | Board | Verified identity and recipient details are required. A nonexistent historical report is not a missing UI section. |

Later, when supported by real work: add project results with a short financial account, an actual partner list, a one-page sponsor proposal tied to a budget, and approved foundation activities beyond the ensemble. Keep these items in planning only until they exist. A broad statutory permission is not a public programme announcement.

Use existing analytics only to distinguish page visits, transfers-details/copy actions, one-off checkout starts, accepted patron-interest submissions and partnership mail clicks. These are signals of intent, not proof of received money. Reconcile bank/gateway records operationally; do not publish a partial fundraising counter. The original review's approximate vault-opening percentage is not a validated baseline for targets.

## 8. References and adaptation

Sources checked on 2026-09-18. These inform the structure; none establishes facts about Voct or supplies a visual template.

- [Monteverdi Choir & Orchestras — Why Support Us?](https://monteverdi.co.uk/support-us): explains the gap between earned income and expenditure before presenting support routes. Adapt the explanation of material needs; use only Voct's own verified numbers.
- [Tenebrae — Become a Member](https://www.tenebrae-choir.com/support/join): connects regular giving to a continuing relationship. Adapt continuity, not its tier system or labour-intensive benefits.
- [Tenebrae — Corporate Partnerships](https://www.tenebrae-choir.com/support/corporate-partnerships): gives companies a distinct route, named areas of support and a discussion about benefits. Adapt that separation and concrete project scope, not its scale or reach promises.
- [Fundacja MEAKULTURA — Kontakt](https://fundacjameakultura.pl/kontakt/): groups legal identity, statute and actual yearly reports in an accessible place. Adapt findability; publish only documents Voct actually has.

Local factual anchors: `web/src/data/foundation.ts`; `web/public/docs/Statut-VoctFoundation.pdf`; `web/src/content/concerts.yaml`; `web/src/content/pages/{landing,o-nas,kontakt,skarbiec}.yaml`; the patronage API client and current vault. The visual canon is `.ai/07_marketing_public_site.md` and the current `web/src/styles/tokens.css`, not the panel's design system. Recheck only the specific source needed for implementation; do not repeat the entire survey.

## 9. Implementation log

### Stage 1 — the page (done 2026-09-18, not yet reviewed in a browser, not committed)

Built as one shared component with three thin routes, on the `ContactPage` / `KONTAKT_PAGE` /
`pageCopy` pattern. Files: `web/src/components/pages/FoundationPage.astro` (composition and
scoped styles — no separate `foundation.css`, because no page on the site keeps one),
`web/src/pages/{,en/,fr/}fundacja.astro`, `web/src/content/pages/fundacja.yaml` (Polish prose),
`web/src/i18n/content/fundacja.ts` (schema, desk contract, chrome ×3),
`web/src/data/foundationSupport.ts` (the chosen concert ids, amount examples, statute path),
`web/src/islands/landing/PatronInterestForm.tsx` (the interest form, under `islands/landing/`
where every island lives), `web/copydesk/drafts/{en,fr}/fundacja.yaml` (translations as desk
drafts — the overlays are machine-written, so EN/FR land through `make copy-draft` →
`copy-check` → `copy-apply`, not by hand). Registered in `copydesk/extractPages.mjs`
(`PAGE_SPECS`), `i18n/config.ts` (`TRANSLATED_ROUTES`), and `i18n/ui.ts` (`nav.foundation`,
used by the breadcrumb now and by the nav in stage 2).

Decisions taken against or beyond the brief, and why:

- **No gate work.** `data-rite` is set per page by `BaseLayout` and only the landing asks for
  it; `/fundacja` never meets the audio rite. §5's gate requirement was a non-issue.
- **Board roles and the mission sentence are read from `/o-nas` and `/kontakt` copy**, not
  duplicated — one home each. The board line prints exactly what /o-nas prints; confirm there.
- **Record items carry no new copy**: title, place, moment and `essence` come from the corpus
  and its overlays, so EN/FR already exist for them.
- **The current work is a chosen id, never `upcomingStation`'s pick.** Build-time tense switch
  on the same concert (present while ahead, past after) — the site's existing standing
  obligation: a deploy after 2026-10-11 is what changes the sentence.
- **EUR account shown as a labelled second row**, as the landing's bank card already does.
  Transfer title is `VAULT_CONFIG.recipient.title` (one title, not the "Mecenat —" variant).
- **Donation terms link opens the vault** (`data-vault-open`) because the terms exist only there.
- **No coda section**; the page ends on the patronage address, per §4F.
- **Qualitative cost state only** (§4B, no approved budget). Nothing numeric, no progress.

### Stage 2 — migration (done 2026-09-18, not yet reviewed in a browser, not committed)

Two decisions taken by the developer during this stage, both overriding §5's first bullet:

- **„Wesprzyj” keeps opening the vault everywhere** — the landing's own header
  (`islands/landing/StickyHeader.tsx`) and the shared `SiteChrome.astro`, desktop and mobile. The
  vault is the one-off sheet and it now ends on the link to `/fundacja#mecenat`. `nav.support`,
  the `.nav-support` / `.nave-cta` markup and the privacy policy's „Po kliknięciu „Wesprzyj”…”
  sentence are unchanged. `/fundacja` gets its **own** nav entry instead: `nav.foundation`,
  shortened to one word („Fundacja” / „Foundation” / „Fondation”) because it stands next to
  the vault's „Wesprzyj” in the bar; the fuller name lives in `footer.foundationPage`.
- **On the mobile "Vitta" card the entry is fine print beside Kolofon**, not a fifth voice: the
  card's band geometry is solved for four voices (`nave-menu.css` GEOMETRY) and a fifth would
  cost every line ~9% of its size. The phone has three roads to `/fundacja`: that line, the
  vault's closing link, and the footer.

What was built:

- Navigation: `SiteChrome.astro` (desktop item after Kontakt; mobile `.nave-fine` line) and
  `StickyHeader.tsx` (the same two places on the landing).
- Footers: `SiteFooter.astro` — `/fundacja` first in the Index column, a keyed `#mecenat` link
  beside `patronat@` (`footer.patronage`); `islands/landing/SiteFooter.tsx` — `/fundacja` first
  in the Corpus stanza. Both labels are `ui.ts` chrome.
- Vault: the segmented toggle and `MecenatPanel.tsx` are gone; the sheet renders the one-off
  content directly and closes on `t.recurringLink` („Wolisz wspierać regularnie? Mecenat →”,
  `skarbiecChrome.ts`). The QR card's `qr.recurringNoteHtml` is a two-sentence pointer with the
  link in it (PL yaml; EN/FR overlays AND `copydesk/drafts/{en,fr}/skarbiec.yaml` edited by
  hand in the same pass; 18 `page.skarbiec.mecenat.*` rows removed from both overlays and both
  drafts; the zod sub-schema and the desk contract entries removed from `skarbiec.ts`).
  `vault/useLeaveVault.ts` is the one exit from the open sheet to another page: `close()` then
  `navigateFromOverlay` — a bare `<a>` would strand the entry the sheet pushed on open, and on
  `/fundacja` itself (a same-page hash, no swap) would leave the sheet open over the anchor. The
  QR note's link reaches it through a delegated click. `mecenatTransferFields` and the
  `fieldRecurringTitle` / `tab*` / `mecenat*` chrome keys are gone with the panel.
- Aliases: `infra/nginx/prod.conf` and `local.conf` — `location = /mecenat`, `/en/mecenat`,
  `/fr/mecenat` → 301 to the localised `/fundacja#mecenat`. No Astro page, no JS.
- `/kontakt`: the locus link → `/fundacja#fundacja-i-dokumenty`. The `patronat` channel hint is
  plain text (`kontakt.ts` has no html field for it) and was left alone — a schema change for one
  link is not worth the desk round-trip. `/o-nas`: the `#fundacja` band keeps its summary and
  gains a second `.btn` beside the statute (`ABOUT_CHROME.foundationLink`); its JSON-LD NGO
  `url` is now `/fundacja`.
- Landing `FinalSupportSection`: third `.secondary-link` → `/fundacja#mecenat`
  (`LandingChrome.foundationLink`, no arrow in the word — the link style draws it).
- Foundation page: the two `/?donate` fallbacks are now this locale's landing.
- `.ai/07_marketing_public_site.md` page list names `fundacja`.

### Review after stage 2 (2026-09-18, committed with stages 1–2)

The developer's browser pass found one defect: the vault ended on two links to `/fundacja#mecenat`
stacked under each other — the QR card's recurring note and the sheet's closing line. The closing
line is the designed exit, so the note lost its second sentence and its link: one practical
sentence ("the same details work as a standing order — the QR above is one-off"), no question,
because the closing line asks it right below. PL yaml, both overlays, both desk drafts and the
desk contract note in `skarbiec.ts` changed in the same pass; the QR panel's click delegate and
the `.transfer-recurring-note a` rules went with the link. `useLeaveVault` keeps the delegate
helper — the sheet's closing link now uses it too, so a modified click opens a new tab instead of
being eaten.

**The page ships hidden.** The developer wants to commit and deploy while reviewing the page
section by section, with nothing on the site announcing it yet. `FOUNDATION_PAGE_LINKED = false`
in `data/foundationSupport.ts` is the one switch: while false, the nav bar and the mobile card's
fine print (`SiteChrome`, `StickyHeader`), the second button on /o-nas's band and that band's NGO
`url`, /kontakt's locus link (back to `/o-nas#fundacja`) and the landing's third door in
`FinalSupportSection` are all silent, and the page itself is `noindex,follow` with a matching
hand-written `/fundacja$` clause in the sitemap filter (`astro.config.mjs`, which is JS and cannot
read the flag). Two doors stay open on purpose: the vault's closing line and both footers — the
developer's call, "nobody will find it there". The nginx `/mecenat` aliases stay: an old URL must
not 404 while the page exists. Stage 3 is: flip the flag, drop the sitemap clause.

Also fixed in this pass: `SiteFooter.astro`'s `.foot-rodo a` rule carries `.foot-col` now, so the
RODO address prints at 11px / dimmer as intended; the `nave-menu.css` comment over `.nave-fine`
describes the two-page line.

Left open after this stage:

- **Stage 3 — announce.** After the section-by-section review: `FOUNDATION_PAGE_LINKED = true`
  and remove the `/fundacja$` clause from the sitemap filter. Nothing else — every door is
  already wired behind the flag.
- `/fundacja` EN/FR prose overlays — the drafts are complete (97 rows each); after the commit
  (`copy-sync` refuses a dirty `web/src/content/`, and `copy-draft` proposes only keys the desk
  knows): `make copy-sync` → `copy-draft` → `copy-check` → `copy-apply`, second commit. Until then
  EN/FR print Polish prose under EN/FR chrome — tolerable while the page is noindex.
- The featured concert's tense is decided at build only (accepted): a deploy after 2026-10-11
  is what changes the sentence.
