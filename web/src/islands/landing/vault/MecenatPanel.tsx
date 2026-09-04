/**
 * @file MecenatPanel.tsx
 * @description Mecenat (patronage) section of the donation vault — a standing-order-based way to
 *  support the cycle regularly. Carries the pitch, what the foundation offers patrons, copyable
 *  bank details for the standing order, direct contact channels, and a "join" form (first name +
 *  last name + e-mail + consent) that POSTs to the Django patronage endpoint. The endpoint stores
 *  the lead and notifies the foundation; no card data is ever involved here.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/MecenatPanel
 */

import { useCallback, useMemo, useRef, useState } from "react";

import { PatronInterestError, submitPatronInterest } from "../api/patronage";
import { mecenatTransferFields, TransferFieldButton } from "./transferFields";
import { useVaultCopy } from "./copyContext";
import { Typo } from "../lib/Typo";

// `voctensemble.com` and not `voctfoundation.com`, which is what these two used to say. The
// foundation owns both domains and both deliver to the same workspace, so neither address was
// broken — but a reader who meets `patronat@voctfoundation.com` here and
// `patronat@voctensemble.com` in the footer has to work out whether those are one inbox or two
// organisations, and this panel is where someone decides to commit money. `SITE`
// (i18n/config.ts) makes voctensemble.com the canonical origin and every JSON-LD `@id` on the
// site hangs off it; the addresses follow that, and the other domains stay as redirects.
const PATRON_EMAIL = "patronat@voctensemble.com";
const FOUNDER_EMAIL = "florent.de.bazelaire@voctensemble.com";

export function MecenatPanel(): React.JSX.Element {
  const { lang, vault, t } = useVaultCopy();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [consentInvalid, setConsentInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

  const fields = useMemo(() => mecenatTransferFields(t), [t]);
  const benefits = useMemo(
    () => [
      vault.mecenat.benefit1,
      vault.mecenat.benefit2,
      vault.mecenat.benefit3,
      vault.mecenat.benefit4,
    ],
    [vault],
  );

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (loading) return;

      const fn = firstName.trim();
      const ln = lastName.trim();
      const em = email.trim();

      if (!fn || !ln) {
        setError(t.mecenatErrorName);
        firstNameRef.current?.focus();
        return;
      }
      if (!em || !emailRef.current?.checkValidity()) {
        setEmailInvalid(true);
        setError(t.mecenatErrorEmail);
        emailRef.current?.focus();
        return;
      }
      if (!consent) {
        setConsentInvalid(true);
        setError(t.mecenatErrorConsent);
        consentRef.current?.focus();
        return;
      }

      setError(null);
      setLoading(true);
      try {
        await submitPatronInterest({ firstName: fn, lastName: ln, email: em, consent });
        setSubmitted(true);
      } catch (err) {
        if (err instanceof PatronInterestError) {
          console.error("[VoctMecenat]", err);
        } else {
          console.error("[VoctMecenat] unexpected", err);
        }
        setLoading(false);
        setError(t.mecenatErrorSend(PATRON_EMAIL));
      }
    },
    [loading, firstName, lastName, email, consent, t],
  );

  return (
    <Typo locale={lang}>
      <section className="mecenat" aria-label={t.mecenatAria}>
        <article className="method mecenat-card" data-method="mecenat">
          <div className="method-head">
            <div className="method-tag">
              <span className="method-tag-dot" aria-hidden="true" />
              <span className="micro">{vault.mecenat.tag}</span>
            </div>
            <span className="method-status" data-status="ready">
              {t.statusMecenat}
            </span>
          </div>

          <h3 className="method-title">{vault.mecenat.title}</h3>
          <p className="method-note">{vault.mecenat.note}</p>

          <div className="mecenat-block">
            <span className="mecenat-sublabel">{vault.mecenat.benefitsLabel}</span>
            <ul className="mecenat-benefits">
              {benefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
          </div>

          <div className="mecenat-block">
            <span className="mecenat-sublabel">{vault.mecenat.howLabel}</span>
            <p
              className="mecenat-how"
              dangerouslySetInnerHTML={{ __html: vault.mecenat.howHtml }}
            />
            <div className="method-transfer-fields">
              {fields.map((field) => (
                <TransferFieldButton key={field.label} field={field} />
              ))}
            </div>
          </div>

          <div className="mecenat-block">
            <span className="mecenat-sublabel">{vault.mecenat.talkLabel}</span>
            <p className="mecenat-how">{vault.mecenat.talkNote}</p>
            <div className="mecenat-contact">
              <a
                className="plausible-event-name=mecenat+mail+patronat"
                href={`mailto:${PATRON_EMAIL}`}
              >
                {PATRON_EMAIL}
              </a>
              <a
                className="plausible-event-name=mecenat+mail+zalozyciel"
                href={`mailto:${FOUNDER_EMAIL}`}
              >
                {FOUNDER_EMAIL}
              </a>
            </div>
          </div>

          {submitted ? (
            <div className="mecenat-confirm" role="status">
              <span className="mecenat-confirm-mark" aria-hidden="true">
                ✦
              </span>
              {/* The patron's own name sits in a vocative slot, which is why the greeting is its
                  own field: a name must never be inside a clause a translator might reorder. */}
              <p className="mecenat-confirm-text">
                {`${vault.mecenat.confirmGreeting}, ${firstName.trim() || vault.mecenat.confirmFallbackName}! ${vault.mecenat.confirmBody} ${vault.mecenat.confirmContact} `}
                <a href={`mailto:${PATRON_EMAIL}`}>{PATRON_EMAIL}</a>.
              </p>
            </div>
          ) : (
            <form className="mecenat-form" onSubmit={onSubmit} noValidate aria-busy={loading}>
              <span className="mecenat-sublabel">{vault.mecenat.joinLabel}</span>
              <div className="mecenat-name-row">
                <div className="give-field">
                  <label className="give-label micro" htmlFor="mecenatFirstName">
                    {t.firstNameLabel}
                  </label>
                  <input
                    ref={firstNameRef}
                    id="mecenatFirstName"
                    className="give-email"
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => {
                      setFirstName(event.target.value);
                      if (event.target.value.trim()) setError(null);
                    }}
                  />
                </div>
                <div className="give-field">
                  <label className="give-label micro" htmlFor="mecenatLastName">
                    {t.lastNameLabel}
                  </label>
                  <input
                    id="mecenatLastName"
                    className="give-email"
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) => {
                      setLastName(event.target.value);
                      if (event.target.value.trim()) setError(null);
                    }}
                  />
                </div>
              </div>
              <div className="give-field">
                <label className="give-label micro" htmlFor="mecenatEmail">
                  {t.mecenatEmailLabel}
                </label>
                <input
                  ref={emailRef}
                  id="mecenatEmail"
                  className="give-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={t.emailPlaceholder}
                  aria-invalid={emailInvalid || undefined}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setEmailInvalid(false);
                    if (event.target.value.trim()) setError(null);
                  }}
                />
              </div>

              <label className="give-consent">
                <input
                  ref={consentRef}
                  type="checkbox"
                  className="give-consent-input"
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
                <span className="give-consent-box" aria-hidden="true">
                  <svg
                    className="give-consent-check"
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
                <span
                  className="give-consent-text"
                  dangerouslySetInnerHTML={{ __html: vault.mecenat.consentHtml }}
                />
              </label>

              {error ? (
                <p className="give-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="method-cta plausible-event-name=mecenat+dolaczam"
                disabled={loading}
              >
                <span className="method-cta-text">
                  {loading ? t.mecenatSubmitting : t.mecenatSubmit}
                </span>
                <span className="method-cta-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </form>
          )}
        </article>
      </section>
    </Typo>
  );
}
