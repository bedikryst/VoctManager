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

import { useCallback, useRef, useState } from "react";

import { PatronInterestError, submitPatronInterest } from "../api/patronage";
import { TransferFieldButton, type TransferField } from "./transferFields";

const PATRON_EMAIL = "patronat@voctfoundation.com";
const FOUNDER_EMAIL = "florent.de.bazelaire@voctfoundation.com";

// Distinct title so the foundation can recognise an incoming standing order as patronage.
const MECENAT_FIELDS: readonly TransferField[] = [
  {
    label: "Numer konta · PLN",
    value: "26160010131724418410000001",
    display: "26 1600 1013 1724 4184 1000 0001",
    eventName: "mecenat+copy+nrkonta",
  },
  {
    label: "Odbiorca",
    value: "Fundacja VoctFoundation",
    display: "Fundacja VoctFoundation",
    eventName: "mecenat+copy+fundacja",
  },
  {
    label: "Tytuł przelewu cyklicznego",
    value: "Mecenat — darowizna na cele statutowe VoctFoundation",
    display: "Mecenat — darowizna na cele statutowe VoctFoundation",
    eventName: "mecenat+copy+tytul",
  },
];

const BENEFITS: readonly string[] = [
  "Osobiste podziękowanie i bezpośredni kontakt z założycielem Fundacji.",
  "Imienne podziękowanie wśród mecenasów cyklu, jeśli wyrazisz na to zgodę.",
  "Pierwszeństwo zaproszeń na przyszłe koncerty i wydarzenia.",
  "Roczne zbiorcze potwierdzenie darowizn — pomocne przy rozliczeniu podatkowym.",
];

export function MecenatPanel(): React.JSX.Element {
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

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (loading) return;

      const fn = firstName.trim();
      const ln = lastName.trim();
      const em = email.trim();

      if (!fn || !ln) {
        setError("Podaj imię i nazwisko, abyśmy wiedzieli, komu dziękować.");
        firstNameRef.current?.focus();
        return;
      }
      if (!em || !emailRef.current?.checkValidity()) {
        setEmailInvalid(true);
        setError("Podaj poprawny adres e-mail — na niego się odezwiemy.");
        emailRef.current?.focus();
        return;
      }
      if (!consent) {
        setConsentInvalid(true);
        setError("Zaznacz zgodę na kontakt, abyśmy mogli się do Ciebie odezwać.");
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
        setError(
          `Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę lub napisz na ${PATRON_EMAIL}.`,
        );
      }
    },
    [loading, firstName, lastName, email, consent],
  );

  return (
    <section className="mecenat" aria-label="Mecenat — wsparcie regularne">
      <article className="method mecenat-card" data-method="mecenat">
        <div className="method-head">
          <div className="method-tag">
            <span className="method-tag-dot" aria-hidden="true" />
            <span className="micro">wsparcie regularne · relacja</span>
          </div>
          <span className="method-status" data-status="ready">
            mecenat
          </span>
        </div>

        <h3 className="method-title">Zostań mecenasem cyklu</h3>
        <p className="method-note">
          Mecenat to więcej niż jednorazowa darowizna — to trwała relacja z zespołem i jego muzyką.
          Twoje regularne wsparcie pozwala nam planować z wyprzedzeniem: próby, nagrania i kolejne
          odsłony cyklu Concerts Spirituels. W zamian zapraszamy Cię bliżej tego, co robimy.
        </p>

        <div className="mecenat-block">
          <span className="mecenat-sublabel">Co zapewniamy mecenasom</span>
          <ul className="mecenat-benefits">
            {BENEFITS.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </div>

        <div className="mecenat-block">
          <span className="mecenat-sublabel">Jak to działa</span>
          <p className="mecenat-how">
            Mecenat opiera się na <strong>zleceniu stałym</strong> — comiesięcznym przelewie, który
            ustawiasz i w pełni kontrolujesz w swojej bankowości (np. 50, 100 lub 200&nbsp;zł
            miesięcznie). Zmienisz go lub odwołasz w każdej chwili, bez kontaktu z nami. Bez
            prowizji i bez przekazywania danych karty.
          </p>
          <div className="method-transfer-fields">
            {MECENAT_FIELDS.map((field) => (
              <TransferFieldButton key={field.label} field={field} />
            ))}
          </div>
        </div>

        <div className="mecenat-block">
          <span className="mecenat-sublabel">Wolisz najpierw porozmawiać?</span>
          <p className="mecenat-how">
            Napisz do nas — odpowiemy osobiście i pomożemy dobrać dogodną formę wsparcia.
          </p>
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
            <p className="mecenat-confirm-text">
              Dziękujemy, {firstName.trim() || "drogi Mecenasie"}! Zapisaliśmy Twoje zgłoszenie —
              odezwiemy się, gdy tylko zaksięgujemy Twój pierwszy przelew. W razie pytań napisz na{" "}
              <a href={`mailto:${PATRON_EMAIL}`}>{PATRON_EMAIL}</a>.
            </p>
          </div>
        ) : (
          <form className="mecenat-form" onSubmit={onSubmit} noValidate aria-busy={loading}>
            <span className="mecenat-sublabel">Daj nam znać, że dołączasz</span>
            <div className="mecenat-name-row">
              <div className="give-field">
                <label className="give-label micro" htmlFor="mecenatFirstName">
                  Imię
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
                  Nazwisko
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
                E-mail · na ten adres się odezwiemy
              </label>
              <input
                ref={emailRef}
                id="mecenatEmail"
                className="give-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="twoj@adres.pl"
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
              <span className="give-consent-text">
                Wyrażam zgodę na przetwarzanie moich danych (imię, nazwisko, e-mail) w celu kontaktu
                w sprawie mecenatu, zgodnie z{" "}
                <a
                  className="give-consent-link"
                  href="/polityka-prywatnosci"
                  target="_blank"
                  rel="noopener"
                >
                  Polityką prywatności
                </a>
                .
              </span>
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
                {loading ? "Wysyłanie..." : "Dołączam do mecenatu"}
              </span>
              <span className="method-cta-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </form>
        )}
      </article>
    </section>
  );
}
