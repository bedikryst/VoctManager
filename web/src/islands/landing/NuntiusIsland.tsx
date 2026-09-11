/**
 * @file NuntiusIsland.tsx
 * @description The receipt page: what a reader sees after following a link from one of our
 *  mails. It spends the token the URL carries and prints one of eight states.
 *
 *  THE WORK HAPPENS IN AN EFFECT, NOT ON ARRIVAL AT THE SERVER, and that is the design rather
 *  than an implementation detail. A confirmation that fired on a GET would be spent by every
 *  link scanner between us and the reader — Outlook Safe Links, antivirus proxies, a preview
 *  card — forging the one fact double opt-in exists to prove. A scanner fetches HTML; it does
 *  not run this. So the link opens a page, and the page (in a real browser, once) asks.
 *
 *  The guard ref is not a StrictMode workaround dressed up: confirming is idempotent server-side,
 *  so a second call would be harmless, but it would also be a second request nobody asked for.
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
import { NoticeError, resolveNoticeToken, type NoticeAction } from "./api/notices";
import { Typo } from "./lib/Typo";

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
}

/**
 * The three states in which a reader is holding no working link and the honest next move is to
 * sign up again — one never had a token, two spent or malformed ones. On these the sign-up leads
 * the row; everywhere else it would be an offer made to someone who just accepted or declined.
 *
 * `missing` is the one this page was reshaped for: it is what a person sees who was TOLD about the
 * list and typed the address from the mail's links, and it used to answer them with a wall.
 */
const NEEDS_SIGNUP: ReadonlySet<NoticeState> = new Set(["missing", "expired", "invalid"]);

/** The query parameter each action arrives under. They are English in every locale: a mail's URL
    is machinery, and one spelling keeps the backend's link builder to a single table. */
const ACTION_PARAM: Readonly<Record<NoticeAction, string>> = {
  confirm: "confirm",
  unsubscribe: "unsubscribe",
};

/** What the URL is asking for, or `null` when it asks for nothing (a bookmarked page). */
function readRequest(search: string): { action: NoticeAction; token: string } | null {
  const params = new URLSearchParams(search);
  for (const action of Object.keys(ACTION_PARAM) as NoticeAction[]) {
    const token = params.get(ACTION_PARAM[action]);
    if (token) return { action, token };
  }
  return null;
}

export function NuntiusIsland({
  lang,
  chrome,
  concertsHref,
  homeHref,
  signupHref,
  signupLabel,
}: NuntiusIslandProps): React.JSX.Element {
  const [state, setState] = useState<NoticeState>("checking");
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;

    const request = readRequest(window.location.search);
    if (!request) {
      setState("missing");
      return;
    }

    void resolveNoticeToken(request.action, request.token)
      .then((status) => {
        // Every status the backend returns is also a `NoticeState` — the client refuses an
        // unknown one at the API boundary rather than letting it reach a lookup with no entry.
        setState(status);
      })
      .catch((err: unknown) => {
        if (!(err instanceof NoticeError)) console.error("[VoctNuntius] unexpected", err);
        else console.error("[VoctNuntius]", err);
        setState("error");
      });
  }, []);

  const copy = chrome.states[state];
  const working = state === "checking";

  return (
    <Typo locale={lang}>
      <div className="nuntius-panel" data-state={state}>
        <p className="nuntius-eyebrow eyebrow">
          <span className="lat" lang="la">
            Nuntius
          </span>
          &nbsp;&nbsp;·&nbsp;&nbsp;{chrome.eyebrow}
        </p>
        {/* `aria-live` so the outcome is announced when it replaces "checking", which is the
            only content change on this page and the whole reason a reader opened it. */}
        <div aria-live="polite">
          <h1 className="nuntius-title">{copy.title}</h1>
          <p className="nuntius-body">{copy.body}</p>
        </div>
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
    </Typo>
  );
}
