/**
 * @file NuntiusIsland.tsx
 * @description The receipt page: what a reader sees after following a link from one of our
 *  mails. It holds the token the URL carries, spends it when a person presses the button, and
 *  prints the outcome.
 *
 *  NOTHING IS SPENT BY ARRIVING, AND NOTHING IS SPENT BY A SCRIPT. Two different forgeries have
 *  to be kept out of a double opt-in record, and they need two different answers:
 *
 *  - A confirmation that fired on the server's GET would be spent by every link scanner between
 *    us and the reader — Outlook Safe Links, antivirus proxies, a preview card. A scanner fetches
 *    HTML; it does not hydrate an island. So the link opens a page, and the page asks.
 *  - A confirmation that fired from this island's mount effect is not spent by a scanner, but it
 *    is still only evidence that a browser ran some JavaScript. On this list the DELIBERATE ACT
 *    is the evidence, so it is a button, and the effect below only reads the URL.
 *
 *  THE PREFERENCES LINK IS THE EXCEPTION AND STAYS AUTOMATIC, because it spends nothing: it reads
 *  the greeting a subscription already carries so the form can open with it in the field. RFC
 *  8058's rule that a GET must not act is what makes that safe.
 *
 *  The guard ref is not a StrictMode workaround dressed up: reading is idempotent, so a second
 *  call would be harmless, but it would also be a second request nobody asked for.
 *
 *  IT IS ALSO WHY THE EFFECT CANCELS NOTHING. The usual `let live = true` / cleanup pairing is
 *  what a re-running effect needs; this one runs once by construction, and under StrictMode the
 *  cleanup fires between the two development passes — on a component that is still mounted —
 *  so a flag set there would silence the only answer this page has while the second pass stops
 *  at the guard. The page would read "checking" forever, in development only. There is nothing
 *  to cancel either: the island lives as long as the document, and React no longer warns about
 *  a state update that arrives after unmount.
 * @architecture Astro islands 2026
 * @module islands/landing/NuntiusIsland
 */

import { useEffect, useRef, useState } from "react";

import type { Locale } from "../../i18n/config";
import type { NoticeState, NuntiusPageChrome } from "../../i18n/content/nuntius";
import {
  NoticeError,
  readNoticePreferences,
  resolveNoticeToken,
  updateNoticeName,
  type NoticeAction,
  type NoticePreferences,
} from "./api/notices";
import { Typo } from "./lib/Typo";

/**
 * One published evening, already typeset by the page in the reader's locale. The island holds a
 * LIST rather than the single next one, and that is what stops a confirmation page from outliving
 * its own concert: these documents are built once and then sit in mailboxes for weeks, so which
 * evening is next has to be decided by the reader's clock, not by the deploy's.
 */
export interface NoticeOccurrence {
  /** ISO `YYYY-MM-DD`. Compared as a string against today's date in the venue's own zone. */
  readonly date: string;
  readonly title: string;
  readonly place: string;
  /** Date and hour, already formatted for this locale — the island never formats a date. */
  readonly moment: string;
  readonly href: string;
}

interface NuntiusIslandProps {
  readonly lang: Locale;
  readonly chrome: NuntiusPageChrome;
  /** All localized by the page — the island never computes a URL. */
  readonly concertsHref: string;
  readonly homeHref: string;
  readonly signupHref: string;
  /** The invitation's own verb, borrowed rather than written twice: the act is the same one the
      landing card, the concert rail and /kontakt name, so it reads as one object across the site. */
  readonly signupLabel: string;
  /** Published future evenings at build time, ascending by date. May be empty, and an empty one
      prints nothing: `confirmed.body` already says what the list promises without naming a date,
      so there is no card to leave standing hollow. */
  readonly occurrences: readonly NoticeOccurrence[];
}

/**
 * Today's date in Warsaw as `YYYY-MM-DD`. `en-CA` is the one widely-supported locale whose short
 * date is already in ISO order, so the result compares as a string against a corpus date.
 *
 * The zone is the ENSEMBLE'S, not the reader's: an evening in Kraków is over when it is over
 * there, and a subscriber reading in Montreal must not be shown tonight's concert as upcoming
 * six hours after it ended.
 */
const todayInWarsaw = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

/** The states that carry the programme entry: a reader who is on the list, however they got
    there, is owed the same useful destination. */
const SHOWS_PROGRAMME: ReadonlySet<NoticeState> = new Set(["confirmed", "already_confirmed"]);

/**
 * The three states in which a reader is holding no working link and the honest next move is to
 * sign up again — one never had a token, two spent or malformed ones. On these the sign-up leads
 * the row; everywhere else it would be an offer made to someone who just accepted or declined.
 *
 * `missing` is the one this page was reshaped for: it is what a person sees who was TOLD about the
 * list and typed the address from the mail's links, and it used to answer them with a wall.
 */
const NEEDS_SIGNUP: ReadonlySet<NoticeState> = new Set([
  "missing",
  "expired",
  "invalid",
  // A live token whose consent ended: the honest next move is the same one, and the copy says so.
  "withdrawn",
]);

/** The query parameter each action arrives under. They are English in every locale: a mail's URL
    is machinery, and one spelling keeps the backend's link builder to a single table. */
const ACTION_PARAM: Readonly<Record<NoticeAction, string>> = {
  confirm: "confirm",
  unsubscribe: "unsubscribe",
};

/** The third parameter, which is NOT an action: it opens a form instead of spending anything. */
const PREFERENCES_PARAM = "preferences";

type NoticeRequest =
  | {
      readonly kind: "action";
      readonly action: NoticeAction;
      readonly token: string;
    }
  | { readonly kind: "preferences"; readonly token: string };

/**
 * What the URL is asking for, or `null` when it asks for nothing (a bookmarked page).
 *
 * The two actions are read first and in their own order, so a URL carrying both a spent action
 * and a preferences token still does the thing the reader clicked.
 */
function readRequest(search: string): NoticeRequest | null {
  const params = new URLSearchParams(search);
  for (const action of Object.keys(ACTION_PARAM) as NoticeAction[]) {
    const token = params.get(ACTION_PARAM[action]);
    if (token) return { kind: "action", action, token };
  }
  const token = params.get(PREFERENCES_PARAM);
  if (token) return { kind: "preferences", token };
  return null;
}

/** The three answers the preferences endpoint gives, as the states this page renders. */
function stateForPreferences(result: NoticePreferences, saved: boolean): NoticeState {
  if (result.status === "invalid") return "invalid";
  if (result.status === "withdrawn") return "withdrawn";
  return saved ? "preferences_saved" : "preferences";
}

export function NuntiusIsland({
  lang,
  chrome,
  concertsHref,
  homeHref,
  signupHref,
  signupLabel,
  occurrences,
}: NuntiusIslandProps): React.JSX.Element {
  const [state, setState] = useState<NoticeState>("checking");
  const asked = useRef(false);
  /** Held for the form's POST. Never rendered — it is a secret from a mailbox. */
  const preferencesToken = useRef<string | null>(null);
  /** The link's own token and act, held from the read until the reader presses. */
  const pending = useRef<{ action: NoticeAction; token: string } | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [spending, setSpending] = useState(false);

  const fail = (err: unknown): void => {
    if (!(err instanceof NoticeError)) console.error("[VoctNuntius] unexpected", err);
    else console.error("[VoctNuntius]", err);
  };

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;

    const request = readRequest(window.location.search);
    if (!request) {
      setState("missing");
      return;
    }

    if (request.kind === "preferences") {
      preferencesToken.current = request.token;
      void readNoticePreferences(request.token)
        .then((result) => {
          setName(result.name);
          setState(stateForPreferences(result, false));
        })
        .catch((err: unknown) => {
          fail(err);
          setState("error");
        });
      return;
    }

    // Read, not spent. The state the reader lands in is the question; the answer is a press.
    pending.current = { action: request.action, token: request.token };
    setState(request.action);
  }, []);

  /** The press. The button's own label reports the operation, so the panel keeps its question
      on screen instead of flashing through "checking" on the way to the outcome. */
  const spend = (): void => {
    const request = pending.current;
    if (request === null || spending) return;

    setSpending(true);
    void resolveNoticeToken(request.action, request.token)
      .then((status) => {
        // Every status the backend returns is also a `NoticeState` — the client refuses an
        // unknown one at the API boundary rather than letting it reach a lookup with no entry.
        setState(status);
      })
      .catch((err: unknown) => {
        fail(err);
        setState("error");
      })
      .finally(() => {
        setSpending(false);
      });
  };

  const submitName = (event: React.FormEvent): void => {
    event.preventDefault();
    const token = preferencesToken.current;
    if (token === null || saving) return;

    setSaving(true);
    setSaveFailed(false);
    void updateNoticeName(token, name.trim())
      .then((result) => {
        setName(result.name);
        setState(stateForPreferences(result, true));
      })
      .catch((err: unknown) => {
        fail(err);
        // The form STAYS OPEN with what was typed still in it — a transport failure is the one
        // case where replacing the control with a sentence would lose the reader's work.
        setSaveFailed(true);
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const copy = chrome.states[state];
  const working = state === "checking";
  const editing = state === "preferences";
  const awaitingPress = state === "confirm" || state === "unsubscribe";
  /* Chosen from the READER'S clock, not from the build's — see `todayInWarsaw`. Recomputed on
     every render, which costs one date format and removes the whole question of staleness. */
  const next = SHOWS_PROGRAMME.has(state)
    ? occurrences.find((evening) => evening.date >= todayInWarsaw())
    : undefined;

  return (
    <Typo locale={lang}>
      {/* The same register the sign-up stands in, without its arrival: this page opens DIRECTLY in
          whichever state the link put it in, and a reader coming from their mailbox is owed the
          answer rather than a re-enactment of signing up. The running head carries the opening
          rule and `.notice-leaf::after` closes the page, exactly as on /newsletter. */}
      <div className="notice-leaf" data-state={state}>
        <p className="notice-runhead nuntius-eyebrow eyebrow">
          <span className="lat" lang="la">
            Nuntius
          </span>
          &nbsp;&nbsp;·&nbsp;&nbsp;{chrome.eyebrow}
        </p>
        <div className="nuntius-panel">
          {/* `aria-live` so the outcome is announced when it replaces "checking", which is the
            only content change on this page and the whole reason a reader opened it. */}
          <div aria-live="polite">
            <h1 className="nuntius-title">{copy.title}</h1>
            <p className="nuntius-body">{copy.body}</p>
          </div>
          {/* The field, its label, its error and its button are the BAND'S OWN — one list, one
            field, and a second set of values would only be somewhere for the two to drift apart.
            Only the arrangement a centred panel needs is new. */}
          {editing && (
            <form className="nuntius-form" onSubmit={submitName} noValidate>
              <label className="notice-label eyebrow" htmlFor="nuntius-name">
                {chrome.preferences.nameLabel}
              </label>
              <input
                id="nuntius-name"
                className="notice-email"
                type="text"
                name="name"
                maxLength={80}
                autoComplete="given-name"
                placeholder={chrome.preferences.namePlaceholder}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
                aria-describedby="nuntius-name-hint"
              />
              <p className="nuntius-hint" id="nuntius-name-hint">
                {chrome.preferences.clearHint}
              </p>
              {saveFailed && (
                <p className="notice-error" role="alert">
                  {chrome.preferences.errorSend}
                </p>
              )}
              <button className="notice-submit" type="submit" disabled={saving}>
                {saving ? chrome.preferences.submitting : chrome.preferences.submit}
              </button>
            </form>
          )}
          {/* The programme entry, typeset as an entry rather than boxed as a card: an evening that
            exists is stated, and one that does not is simply not mentioned. */}
          {next && (
            <div className="nuntius-programme">
              <p className="nuntius-programme-eyebrow eyebrow">{chrome.programme.eyebrow}</p>
              <p className="nuntius-programme-title">{next.title}</p>
              <p className="nuntius-programme-line">
                {next.place}
                <span className="nuntius-programme-sep" aria-hidden="true">
                  &nbsp;&nbsp;·&nbsp;&nbsp;
                </span>
                <span className="nuntius-programme-moment">{next.moment}</span>
              </p>
              <a className="nuntius-link nuntius-link-lead" href={next.href}>
                {chrome.programme.action}
              </a>
            </div>
          )}
          {awaitingPress && (
            <div className="nuntius-act">
              <button className="notice-submit" type="button" onClick={spend} disabled={spending}>
                {state === "confirm"
                  ? spending
                    ? chrome.actions.confirming
                    : chrome.actions.confirm
                  : spending
                    ? chrome.actions.unsubscribing
                    : chrome.actions.unsubscribe}
              </button>
            </div>
          )}
          {working ? null : (
            <div className="nuntius-actions">
              {NEEDS_SIGNUP.has(state) && (
                <a className="nuntius-link nuntius-link-lead" href={signupHref}>
                  {signupLabel}
                </a>
              )}
              <a className="nuntius-link" href={concertsHref}>
                {chrome.backToConcerts}
              </a>
              <a className="nuntius-link" href={homeHref}>
                {chrome.backHome}
              </a>
            </div>
          )}
        </div>
      </div>
    </Typo>
  );
}
