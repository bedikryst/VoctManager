# Plausible goals on the public site — 2026-09

Status: code DONE 2026-09-21 (uncommitted). Dashboard configuration PENDING — see "Left open".

## Why the set was cut from ~60 tags to 10 goals

The plan is Plausible Starter (9 $): goals and custom events only — **no custom properties, no
funnels** — and every custom event counts against the same 10 k/month quota as a pageview. The
trial month (site unlinked, still in build) measured 231 visits / 543 pageviews, so the quota is
not the constraint; **signal is**. At this traffic a question split across ten button names
("which CTA opened the vault") lands at one or two clicks per name and says nothing. Meanwhile
the three conversions the site exists for were not counted at all: the donation's return from the
gateway, the notice-list address, the patron form.

The rule, now in `web/src/lib/plausible.ts` (the registry — the only place a goal name is spelled):

- A goal is a **conversion** the site exists for, or **one step of the money path** at the
  coarseness needed to see where it leaks.
- A click that navigates to a page of this site is never a goal — the pageview records it. Where
  a goal fires on several pages, the page path in the goal's breakdown tells them apart.
- UI toggles, legal links, social links and one-time design questions are not goals.

## The goals (configure each in Plausible as a custom event, name verbatim)

| Goal | Fires | Where in code |
|---|---|---|
| `darowizna` | return `?donated=success` consumed | `vault/GratitudeModal.tsx` (`track`) |
| `zawiadomienia+zapis` | notice sign-up POST accepted (double opt-in not yet confirmed) | `NoticeForm.tsx` (`track`); page path = landing / nuntius / newsletter / koncerty |
| `mecenat+zgloszenie` | patron-interest POST accepted | `PatronInterestForm.tsx` (`track`) |
| `mail+booking` | `mailto:booking@` clicked | footer (tag) |
| `mail+patronat` | `mailto:patronat@` clicked | footer, landing final section, /fundacja (tag) |
| `mail+florent` | Florent's address clicked | footer, landing final section (tag) |
| `skarbiec+otwarty` | vault opened, closed→open edge only, every entry route | `providers/VaultContext.tsx` `open()` (`track`) |
| `wesprzyj+Axepta` | submit clicked (rides the click on purpose — a call before the redirect would race the unload) | `vault/GiveForm.tsx` (tag) |
| `zrzutka+otworz` | Zrzutka link clicked | `vault/ZrzutkaPanel.tsx` (tag) |
| `przelew+copy+konto` | an account number copied (PLN or EUR, any surface) | landing bank card, vault transfer fields, /fundacja (tag) |

Pageview goals, no code: `Visit /koncerty/*`, `Visit /fundacja`, `Visit /nuntius`, `Visit /newsletter`.

`BaseLayout.astro` now carries Plausible's queue stub before the deferred script, so a `track()`
fired on mount (the gateway return, a `?donate` deep link) is buffered rather than lost.

## Decided against

- Per-entry vault names (`skarbiec+menu`, `transza+N`, `wesprzyj+dol`, `fundacja+wplata`…): one
  edge-counted event, page path for the surface.
- `vault+mecenat` (the vault's link to `/fundacja#mecenat`): it is a pageview.
- `enterSilence`/`enterVoice`, `przycisk+cisza`, `hero+wideo`, the landing-section→concert links:
  one-time design questions, not goals; at this traffic they would not stabilise for months.
- 404 goal: on Starter, without properties, it would count without naming the path. The 404 page's
  own pageview already lands in Top pages under the missing path.
- `outbound-links` / `file-downloads` extensions: social and statute clicks decide nothing.
- Revenue goals and funnels: Business plan only; the backend's Donation table is the ledger anyway.

## Left open

- Plausible → voctensemble.com → Settings → Goals: add the 10 custom events above and the 4
  pageview goals; delete any old goal names still configured from the trial (they will never fire
  again).
- After deploy, confirm one `skarbiec+otwarty` and one `zawiadomienia+zapis` arrive in the
  dashboard's realtime view.
