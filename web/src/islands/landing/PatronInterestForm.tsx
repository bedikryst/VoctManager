/**
 * @file PatronInterestForm.tsx
 * @description The patron-interest form as /fundacja mounts it: first name, last name, e-mail and
 *  the purpose-specific consent, posted to the existing patronage endpoint. It records that a
 *  reader intends to support the foundation regularly; it moves no money and creates no standing
 *  order — the page says so beside it, and the receipt says it again.
 *
 *  WHAT THE ISLAND DECIDES AND WHAT IT IS HANDED. Validation, the request and the four states
 *  (idle, sending, sent, refused) are its own. Every word is a prop: the labels and refusals come
 *  from the page chrome (complete in every locale by type), the consent clause and the receipt
 *  from the page copy — so no wording lives in a component literal, and the desk sees all of it.
 *
 *  THE RECEIPT IS SHOWN ONLY AFTER THE ENDPOINT ACCEPTED. A refusal keeps every value the reader
 *  typed and prints one line under the fields, with the patronage address as the way out; the
 *  button is disabled for the length of the request so a double tap cannot post twice.
 * @architecture Astro islands 2026
 * @module islands/landing/PatronInterestForm
 */

import { useCallback, useId, useRef, useState } from "react";

import { submitPatronInterest } from "./api/patronage";
import type { PatronFormChrome } from "../../i18n/content/fundacja";
import { GOALS, track } from "../../lib/plausible";

export interface PatronInterestFormProps {
  readonly chrome: PatronFormChrome;
  readonly copy: {
    /** The consent clause as HTML — a link to the privacy policy, already localized. */
    readonly consentHtml: string;
    readonly successTitle: string;
    readonly successBody: string;
  };
  /** The patronage address, printed as the way out of a refused request. */
  readonly contactEmail: string;
}

type Phase = "idle" | "sending" | "sent";

export function PatronInterestForm({ chrome, copy, contactEmail }: PatronInterestFormProps): React.JSX.Element {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [consentInvalid, setConsentInvalid] = useState(false);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const ids = useId();

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (phase === "sending") return;

      const fn = firstName.trim();
      const ln = lastName.trim();
      const em = email.trim();
      setError(null);
      setNetworkError(false);
      setEmailInvalid(false);
      setConsentInvalid(false);

      if (!fn || !ln || !em) {
        setError(chrome.errorRequired);
        (fn ? (ln ? emailRef : firstNameRef) : firstNameRef).current?.focus();
        return;
      }
      if (!emailRef.current?.checkValidity()) {
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

      setPhase("sending");
      try {
        await submitPatronInterest({ firstName: fn, lastName: ln, email: em, consent });
        track(GOALS.patronInterest);
        setPhase("sent");
      } catch {
        // Network failure and a non-2xx answer read the same to the reader: nothing was recorded,
        // and the address beside the line is the way out. The values stay in the fields.
        setPhase("idle");
        setNetworkError(true);
        setError(chrome.errorNetwork);
      }
    },
    [phase, firstName, lastName, email, consent, chrome],
  );

  if (phase === "sent") {
    return (
      <div className="patron-done" role="status" aria-live="polite">
        <p className="patron-done-title">{copy.successTitle}</p>
        <p className="patron-done-body">{copy.successBody}</p>
      </div>
    );
  }

  const sending = phase === "sending";

  return (
    <form className="patron-form" onSubmit={onSubmit} noValidate aria-busy={sending || undefined}>
      <div className="patron-fields">
        <label className="patron-field">
          <span className="patron-label">{chrome.firstName}</span>
          <input
            ref={firstNameRef}
            className="patron-input"
            type="text"
            name="first_name"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={sending}
          />
        </label>
        <label className="patron-field">
          <span className="patron-label">{chrome.lastName}</span>
          <input
            className="patron-input"
            type="text"
            name="last_name"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={sending}
          />
        </label>
        <label className="patron-field patron-field-wide">
          <span className="patron-label">{chrome.email}</span>
          <input
            ref={emailRef}
            className="patron-input"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={emailInvalid || undefined}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sending}
          />
        </label>
      </div>

      <label className="patron-consent" htmlFor={`${ids}-consent`}>
        <input
          ref={consentRef}
          id={`${ids}-consent`}
          className="patron-consent-input"
          type="checkbox"
          name="consent"
          aria-invalid={consentInvalid || undefined}
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={sending}
        />
        <span className="patron-consent-box" aria-hidden="true" />
        <span className="patron-consent-text" dangerouslySetInnerHTML={{ __html: copy.consentHtml }} />
      </label>

      {error && (
        <p className="patron-error" role="alert">
          {error}
          {networkError && (
            <>
              {" "}
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            </>
          )}
        </p>
      )}

      <button className="patron-submit" type="submit" disabled={sending}>
        {sending ? chrome.sending : chrome.submit}
      </button>
    </form>
  );
}
