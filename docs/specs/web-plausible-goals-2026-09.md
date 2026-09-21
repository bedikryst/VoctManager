# Plausible goals on the public site — 2026-09

Status: code DONE 2026-09-21 (uncommitted). Dashboard configuration PENDING — see "Left open".

## Why the set was cut from ~60 tags to 8 goals

The plan is Plausible Starter (9 $): goals and custom events only — **no custom properties, no
funnels** — and every custom event counts against the same 10 k/month quota as a pageview. The
trial month (site unlinked, still in build) measured 231 visits / 543 pageviews, so the quota is
not the constraint; **signal is**. At this traffic a question split across ten button names
("which CTA opened the vault") lands at one or two clicks per name and says nothing. Meanwhile
the three conversions the site exists for were not counted at all: the donation's return from the
gateway, the notice-list address, the patron form.

**What a goal adds over the backend.** The backend already records every conversion (who, how
much, from which surface, confirmed or not). What only Plausible holds is the **source** the
visitor came from and the **visitor count** the conversion is a fraction of. A goal is the
numerator that makes a UTM on a poster or a bio link answer "did it bring anyone". A moment the
backend records at the same instant (the Axepta submit creates the Donation row) is therefore not
a goal.

The rule, now in `web/src/lib/plausible.ts` (the registry — the only place a goal name is spelled):

- A goal is a **conversion** the site exists for, or a **moment on the money path the backend
  never sees**.
- A click that navigates to a page of this site is never a goal — the pageview records it. Where
  a goal fires on several pages, the page path in the goal's breakdown tells them apart.
- UI toggles, legal links, social links and one-time design questions are not goals.
- Scroll depth and time on page come with the tracking script itself (all variants since 2025)
  and need no event; a scroll-depth goal is a pageview goal with a threshold.

## Dashboard configuration (Settings → Goals → Add goal)

Custom events — **Event name** verbatim, Display name is a free label:

| Event name | Display name | Fires | Where in code |
|---|---|---|---|
| `darowizna` | Darowizna zakończona | return `?donated=success` consumed | `vault/GratitudeModal.tsx` (`track`) |
| `zawiadomienia+zapis` | Zapis na zawiadomienia | sign-up POST accepted (before double opt-in) | `NoticeForm.tsx` (`track`); page path = surface |
| `mecenat+zgloszenie` | Zgłoszenie mecenasa | patron-interest POST accepted | `PatronInterestForm.tsx` (`track`) |
| `mail+booking` | Mail: booking | `mailto:booking@` clicked | footer (tag) |
| `mail+patronat` | Mail: patronat | any patronage address clicked (patronat@, Florent's card on the landing) | footer, landing final section, /fundacja (tag) |
| `skarbiec+otwarty` | Skarbiec otwarty | vault opened, closed→open edge, every entry route | `providers/VaultContext.tsx` `open()` (`track`) |
| `zrzutka+otworz` | Zrzutka otwarta | Zrzutka link clicked | `vault/ZrzutkaPanel.tsx` (tag) |
| `przelew+copy+konto` | Numer konta skopiowany | an account number copied (PLN or EUR, any surface) | landing bank card, vault transfer fields, /fundacja (tag) |

Pageview goals — **Page path**. Wildcards: `*` matches anything but `/`, `**` matches across
`/`. Paths carry no trailing slash (`build.format: "file"`), so the EN landing is `/en`, which
`/en/*` would miss.

| Page path | Display name | Why |
|---|---|---|
| `**/koncerty/*` | Strona koncertu | one number for every concert page, every locale |
| `/fundacja` | Fundacja | filter the dashboard by who reached it |
| `/en**` | Strony EN | share of visitors who open a translated page — decides whether the EN/FR desk keeps its budget |
| `/fr**` | Strony FR | as above |

Scroll-depth goal — page `/`, threshold **85 %**, display name „Doszedł do prośby": the support
section and the footer are roughly the last 15 % of the landing, so this is the middle of the
money funnel — reached the ask → `skarbiec+otwarty` → Donation initiated (backend) → `darowizna`.
The threshold is an estimate (page height varies by viewport); adjust after a month of data.

`BaseLayout.astro` carries Plausible's queue stub before the deferred script, so a `track()`
fired on mount (the gateway return, a `?donate` deep link) is buffered rather than lost.

Bounce rate will rise after this change and be truer: Plausible un-bounces a visit on any custom
event, and the old tags fired on the audio toggle and every nav click.

## Decided against

- `wesprzyj+Axepta` (the submit click): the backend creates the Donation row at that instant.
- Per-entry vault names (`skarbiec+menu`, `transza+N`, `wesprzyj+dol`, `fundacja+wplata`…): one
  edge-counted event, page path for the surface.
- `vault+mecenat` (the vault's link to `/fundacja#mecenat`): it is a pageview.
- `mail+florent` as its own goal: the landing card's subject is "Patronat", so it is `mail+patronat`;
  the footer's "dyrekcja" address carries no goal.
- `Visit /nuntius`, `Visit /newsletter`: single pages readable in Top Pages; the sign-up goal holds
  the outcome.
- `enterSilence`/`enterVoice`, `przycisk+cisza`, `hero+wideo`, the landing-section→concert links:
  one-time design questions, not goals; at this traffic they would not stabilise for months.
- Per-section dwell time on the landing: needs an IntersectionObserver event with a property —
  properties are Business-only, and it is the instrument type cut above. Scroll depth is the proxy.
- 404 goal: on Starter, without properties, it would count without naming the path. The 404 page's
  own pageview already lands in Top pages under the missing path.
- `outbound-links` / `file-downloads` extensions: social and statute clicks decide nothing.
- Revenue goals and funnels: Business plan only; the backend's Donation table is the ledger anyway.

## Left open

- Plausible → voctensemble.com → Settings → Goals: add the 8 custom events, 4 pageview goals and
  the scroll-depth goal above; delete any old goal names still configured from the trial (they
  will never fire again).
- Confirm Top Pages shows "Scroll depth" and "Time on page" columns for the trial month — proof the
  current script variant already sends engagement data. If empty, switch to Plausible's current
  snippet.
- After deploy, confirm one `skarbiec+otwarty` and one `zawiadomienia+zapis` arrive in Realtime.
- Put `?utm_source=…` on every off-site entry that is a decision (poster QR, programme QR,
  Instagram bio, the notice mails) — without it the goals count but cannot attribute.
