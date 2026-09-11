/**
 * @file NoticeForm.tsx
 * @description The concert notice list's sign-up — an address, a consent, and nothing else.
 *  Stands at the foot of /koncerty, under the station that says there is no next date yet, which
 *  is the one place on this site where a reader has just been told something they might want to
 *  be told again later.
 *
 *  IT ASKS FOR NO NAME. A notice needs no salutation, so a name would be data collected because
 *  a form usually has one. The consent it takes licenses exactly one thing — one letter per
 *  evening — and the field list is the honest statement of that.
 *
 *  THE SUCCESS STATE IS NOT "YOU ARE SUBSCRIBED". Nothing is stored as a consent until the link
 *  in the confirmation mail is clicked, so the form says a mail is on its way and says why. It
 *  reads the same whether the address was new or already on the list: the endpoint answers
 *  identically on purpose (a public form must not be usable as a membership oracle), and a
 *  message that distinguished the two would leak what the endpoint refuses to.
 * @architecture Astro islands 2026
 * @module islands/landing/NoticeForm
 */

import { useCallback, useRef, useState } from "react";

import type { Locale } from "../../i18n/config";
import type { NoticeFormChrome } from "../../i18n/content/nuntius";
import { NoticeError, subscribeToNotices, type NoticeSurface } from "./api/notices";
import { Typo } from "./lib/Typo";

export interface NoticeFormCopy {
  /** What the band says once the confirmation mail is on its way. From the copy desk. */
  readonly sentTitle: string;
  readonly sentBody: string;
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
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [consentInvalid, setConsentInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

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
        await subscribeToNotices({ email: address, locale: lang, surface });
        setSent(true);
      } catch (err) {
        if (!(err instanceof NoticeError)) console.error("[VoctNotice] unexpected", err);
        else console.error("[VoctNotice]", err);
        setLoading(false);
        setError(chrome.errorSend);
      }
    },
    [loading, email, consent, chrome, lang, surface],
  );

  if (sent) {
    return (
      <Typo locale={lang}>
        <div className="notice-done" role="status">
          <span className="notice-done-mark" aria-hidden="true">
            ✦
          </span>
          <p className="notice-done-title">{copy.sentTitle}</p>
          <p className="notice-done-body">{copy.sentBody}</p>
        </div>
      </Typo>
    );
  }

  return (
    <Typo locale={lang}>
      <form className="notice-form" onSubmit={onSubmit} noValidate aria-busy={loading}>
        <div className="notice-row">
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
