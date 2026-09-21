/**
 * @file plausible.ts
 * @description The registry of Plausible goals the public site reports, and the two ways a goal is
 *  fired: `track()` from island code at the moment something succeeds, `goalClass()` on an anchor
 *  for the `tagged-events` script to pick up on click. Every name the dashboard is configured with
 *  is spelled here and nowhere else, so this file IS the list to keep the Plausible settings in
 *  step with.
 *
 *  WHAT QUALIFIES AS A GOAL. The site's Plausible plan has no custom properties and no funnels, and
 *  every custom event counts against the same monthly quota as a pageview. A goal is one of:
 *   - a conversion the site exists for (a donation completed, an address on the notice list, a
 *     patron interest sent). The backend records each of these too; what only Plausible holds is
 *     the source the visitor came from and the visitor count it is a fraction of — so the goal is
 *     the numerator that makes a UTM on a poster or a bio link answer "did it bring anyone";
 *   - a moment on the money path the backend never sees — the vault opened, an outbound method
 *     chosen, the account number copied, a `mailto:` clicked.
 *  A moment the backend already records at the same instant (the Axepta submit creates the Donation
 *  row) is not a goal: the ledger is the backend, Plausible adds nothing there.
 *  Where a goal fires on more than one page, the page path in the goal's own breakdown tells them
 *  apart; the name does not. A click that navigates to a page of this site is never a goal — the
 *  pageview already records it. Neither are UI toggles, legal links, social links or a
 *  "which-of-these-buttons" question: at this site's traffic those split into single digits and say
 *  nothing. Scroll depth and time on page come with the script itself and need no event.
 *
 *  Names are Polish with `+` for space (the form the `plausible-event-name=` class needs), and they
 *  are stable identifiers, not copy — renaming one orphans its history in the dashboard.
 * @architecture Astro assets 2026
 * @module lib/plausible
 */

/** Every goal the dashboard knows, grouped as the dashboard is read. */
export const GOALS = {
  /* Conversions. */
  donation: "darowizna",
  noticeSignup: "zawiadomienia+zapis",
  patronInterest: "mecenat+zgloszenie",
  /* Intents that end off-site: a mail client, an outbound checkout, a bank form. `mailPatronage`
   *  covers every address a patronage conversation is offered on — the subject, not the mailbox. */
  mailBooking: "mail+booking",
  mailPatronage: "mail+patronat",
  vaultOpened: "skarbiec+otwarty",
  zrzutkaOpened: "zrzutka+otworz",
  accountCopied: "przelew+copy+konto",
} as const;

export type Goal = (typeof GOALS)[keyof typeof GOALS];

type PlausibleFn = (event: Goal | "pageview") => void;

const plausibleOn = (): PlausibleFn | undefined =>
  typeof window === "undefined"
    ? undefined
    : (window as Window & { plausible?: PlausibleFn }).plausible;

/** Fire a goal from code — for the moments no click carries, such as a form's success branch or a
 *  return from the payment gateway. Silent in dev (no script) and for blocked-script visitors. */
export const track = (goal: Goal): void => {
  plausibleOn()?.(goal);
};

/** A manual pageview, for navigations Plausible's `pushState` hook cannot see (`replaceState`). */
export const trackPageview = (): void => {
  plausibleOn()?.("pageview");
};

/** The class the `tagged-events` script reads on an anchor: `plausible-event-name=<goal>`. Use it
 *  for links whose click is the goal (a `mailto:`, an outbound checkout); anything that resolves
 *  inside the islands fires `track()` at the moment of success instead. */
export const goalClass = (goal: Goal): string => `plausible-event-name=${goal}`;
