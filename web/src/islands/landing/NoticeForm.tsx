/**
 * @file NoticeForm.tsx
 * @description The concert notice list's sign-up — an address, a consent, and nothing else.
 *  Stands at the foot of /koncerty, under the station that says there is no next date yet, which
 *  is the one place on this site where a reader has just been told something they might want to
 *  be told again later.
 *
 *  THE NAME IS OPTIONAL AND HAS ONE USE — the greeting of the invitation itself. That single use
 *  is what makes asking for it proportionate; a field collected because a form usually has one is
 *  what data minimisation names, and it is the reason this form asks for nothing else. Leaving it
 *  empty costs the reader nothing and the form no branch: the backend trims, stores `''`, and the
 *  letter is written for both cases.
 *
 *  THE SUCCESS STATE IS NOT "YOU ARE SUBSCRIBED". Nothing is stored as a consent until the link
 *  in the confirmation mail is clicked, so the form says a mail is on its way and says why. It
 *  reads the same whether the address was new or already on the list: the endpoint answers
 *  identically on purpose (a public form must not be usable as a membership oracle), and a
 *  message that distinguished the two would leak what the endpoint refuses to.
 *
 *  AND IT TAKES THE WHOLE BAND, not just this island's own subtree. The heading and the lede above
 *  belong to `components/NoticeSignup.astro`; left standing, the band's largest words went on
 *  promising "we will let you know" while the one instruction that still matters — open your
 *  inbox, click the link — sat smaller and below them. On a double opt-in list that is not a
 *  cosmetic loss: an unread receipt is an address that expires in seven days having consented to
 *  nothing. So the island freezes the band's height, marks it `data-sent`, and the sheet hides
 *  what the band was saying before.
 * @architecture Astro islands 2026
 * @module islands/landing/NoticeForm
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { Locale } from "../../i18n/config";
import type { NoticeFormChrome } from "../../i18n/content/nuntius";
import { NoticeError, subscribeToNotices, type NoticeSurface } from "./api/notices";
import { Typo } from "./lib/Typo";

export interface NoticeFormCopy {
  /** What the band says once the confirmation mail is on its way. From the copy desk. */
  readonly sentTitle: string;
  readonly sentBody: string;
  /** Where to look for the letter: the sender it arrives from, and the folders it can be filed
      under. "Check your mailbox" is untrue advice for a mail sitting in Promotions. */
  readonly sentHint: string;
}

/**
 * The shared smooth-scroll instance the landing publishes on `window` (`scripts/landing.ts`).
 * Anchors on this site route through it rather than through the browser's own smooth scroll,
 * which fights its rAF loop; absent on a page that never started it, hence the fallback.
 */
interface LenisLike {
  scrollTo(target: Element, options?: { offset?: number }): void;
}

interface NoticeFormProps {
  readonly lang: Locale;
  /** Labels, errors and the consent clause. `consentHtml` arrives typeset and localized. */
  readonly chrome: NoticeFormChrome;
  readonly copy: NoticeFormCopy;
  readonly surface: NoticeSurface;
}

export function NoticeForm({ lang, chrome, copy, surface }: NoticeFormProps): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [consentInvalid, setConsentInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  /** The band this island stands in, held from the moment it is marked so the receipt can be
      found afterwards without reaching through the document a second time. */
  const bandRef = useRef<HTMLElement | null>(null);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (loading) return;

      const address = email.trim();
      // `noValidate` on the form, so the browser never shows its own bubble in its own
      // language beside prose in the reader's — but `checkValidity()` still gives us the
      // engine's own idea of a well-formed address, which is the same one the backend uses.
      if (!address || !emailRef.current?.checkValidity()) {
        setEmailInvalid(true);
        setError(chrome.errorEmail);
        emailRef.current?.focus();
        return;
      }
      if (!consent) {
        setConsentInvalid(true);
        setError(chrome.errorConsent);
        consentRef.current?.focus();
        return;
      }

      setError(null);
      setLoading(true);
      try {
        await subscribeToNotices({ email: address, name: name.trim(), locale: lang, surface });
        // Freeze the band before it loses its heading, so nothing below it moves while the
        // reader is looking straight at it. `offsetHeight` is a NUMBER read now — a computed
        // style would be a live handle and would report the collapsed band a tick later.
        const band = formRef.current?.closest<HTMLElement>(".notice-inner") ?? null;
        if (band) {
          band.style.minHeight = `${band.offsetHeight}px`;
          band.dataset.sent = "true";
          bandRef.current = band;
        }
        setSent(true);
      } catch (err) {
        if (!(err instanceof NoticeError)) console.error("[VoctNotice] unexpected", err);
        else console.error("[VoctNotice]", err);
        setLoading(false);
        setError(chrome.errorSend);
      }
    },
    [loading, email, name, consent, chrome, lang, surface],
  );

  // The receipt carries the only instruction left on screen, so focus moves to it — a screen
  // reader and the keyboard follow the eye. The page scrolls only when the receipt is not
  // already whole in view, which on a phone is the ordinary case: the keyboard closes as the
  // form submits and hands back some 300px of viewport, moving everything under the reader.
  useEffect(() => {
    if (!sent) return;
    const done = bandRef.current?.querySelector<HTMLElement>(".notice-done");
    if (!done) return;

    done.focus({ preventScroll: true });

    const view = window.innerHeight || document.documentElement.clientHeight;
    const box = done.getBoundingClientRect();
    if (box.top >= 0 && box.bottom <= view) return;

    const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
    if (lenis) {
      lenis.scrollTo(done, { offset: -Math.max(0, (view - box.height) / 2) });
      return;
    }
    done.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [sent]);

  if (sent) {
    return (
      <Typo locale={lang}>
        {/* `tabIndex` is what lets focus land here; it is not a control and wears no ring. */}
        <div className="notice-done" role="status" tabIndex={-1}>
          <span className="notice-done-mark" aria-hidden="true">
            ✦
          </span>
          <p className="notice-done-title">{copy.sentTitle}</p>
          <p className="notice-done-body">{copy.sentBody}</p>
          <p className="notice-done-hint">{copy.sentHint}</p>
        </div>
      </Typo>
    );
  }

  return (
    <Typo locale={lang}>
      <form ref={formRef} className="notice-form" onSubmit={onSubmit} noValidate aria-busy={loading}>
        <div className="notice-row">
          {/* Optional, and nothing here enforces it beyond that: no validation, no trimming
              the reader can see, no asterisk on the one beside it. The backend trims and the
              service stores `''` for anything blank, so a reader who would rather stay a
              stranger costs the form no branch. */}
          <div className="notice-field notice-field-name">
            <label className="notice-label eyebrow" htmlFor="noticeName">
              {chrome.nameLabel}
            </label>
            <input
              id="noticeName"
              className="notice-email"
              type="text"
              autoComplete="given-name"
              placeholder={chrome.namePlaceholder}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="notice-field">
            <label className="notice-label eyebrow" htmlFor="noticeEmail">
              {chrome.emailLabel}
            </label>
            <input
              ref={emailRef}
              id="noticeEmail"
              className="notice-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={chrome.emailPlaceholder}
              aria-invalid={emailInvalid || undefined}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailInvalid(false);
                if (event.target.value.trim()) setError(null);
              }}
            />
          </div>
          {/* Its own class, not the page's `.pill`: that rule is SCOPED to KoncertyPage, and
              Astro appends the scope attribute to every compound — an element React rendered
              carries none, so the page's own affordance styles never reach inside an island.
              Everything this form and the receipt page wear lives in `styles/notice.css`. */}
          <button type="submit" className="notice-submit" disabled={loading}>
            {loading ? chrome.submitting : chrome.submit}
          </button>
        </div>

        <label className="notice-consent">
          <input
            ref={consentRef}
            type="checkbox"
            className="notice-consent-input"
            aria-invalid={consentInvalid || undefined}
            checked={consent}
            onChange={(event) => {
              setConsent(event.target.checked);
              if (event.target.checked) {
                setConsentInvalid(false);
                setError(null);
              }
            }}
          />
          <span className="notice-consent-box" aria-hidden="true">
            <svg
              className="notice-consent-check"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8.4 L6.4 11.8 L13 4.6" />
            </svg>
          </span>
          {/* Typeset and localized at build (lib/islandCopy) — the build's own HTML pass skips
              island subtrees, and `Typo` sees no string leaf inside an injected fragment. */}
          <span
            className="notice-consent-text"
            dangerouslySetInnerHTML={{ __html: chrome.consentHtml }}
          />
        </label>

        {error ? (
          <p className="notice-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Typo>
  );
}
