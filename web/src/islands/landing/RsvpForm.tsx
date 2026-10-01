/**
 * @file RsvpForm.tsx
 * @description The reply card's form on /rsvp: a name on a writing line, a seat count on a
 *  stepper, and the act that sends them — then a receipt in the same place, or the sentence that
 *  says the concert has begun.
 *
 *  WHAT THE ISLAND DECIDES AND WHAT IT IS HANDED. Validation, the request and the four states
 *  (idle, sending, sent, closed) are its own; every word is a prop (`i18n/content/rsvp.ts`), and
 *  every look is `styles/rsvp.css`.
 *
 *  A DECLINE IS THE SAME CARD WITH THE SEATS PUT AWAY. The quiet switch under the act turns the
 *  card into "I can't come": the name line stays, the stepper goes, the act says so, and the reply
 *  is sent as zero seats — the backend's own spelling of a decline, under the same newest-reply-
 *  per-name rule, so a guest who changes their mind simply answers again.
 *
 *  SET AS A PRINTED REPLY CARD: each blank is a line with its caption UNDER it, the way a response
 *  card prints "imię i nazwisko" beneath the rule. The caption is the field's `<label>`, so the
 *  visual order changes nothing for assistive technology.
 *
 *  THE RECEIPT IS BUILT FROM WHAT THE GUEST TYPED, not from the answer, because the endpoint
 *  deliberately answers every accepted reply alike. "Change the seat count" returns to the form
 *  with both values kept: a second reply under the same name replaces the first on the office's
 *  list, so correcting is simply answering again.
 *
 *  CLOSED IS DECIDED TWICE. The server refuses a reply once the concert has begun (410) and the
 *  island renders the sentence for it; and on mount the island compares Warsaw's wall clock with
 *  the evening's, so a guest opening the link afterwards is not offered a form that can only
 *  refuse. That check runs in an effect, never in the first render — the page is static HTML and
 *  the first client render must match it.
 * @architecture Astro islands 2026
 * @module islands/landing/RsvpForm
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { submitReservation } from "./api/reservations";
import { Typo } from "./lib/Typo";
import type { RsvpFormCopy } from "../../i18n/content/rsvp";

export interface RsvpFormProps {
  readonly copy: RsvpFormCopy;
  /** The corpus id of the evening, which is also the key the backend accepts. */
  readonly concert: string;
  /** Warsaw wall-clock moment the concert begins: `YYYY-MM-DD` and `HH:MM`. */
  readonly startsOn: { readonly date: string; readonly time: string };
  readonly maxSeats: number;
  /** The office's address — the way out of a refused request and of a party too large. */
  readonly contactEmail: string;
}

type Phase = "idle" | "sending" | "sent" | "closed";
type Answer = "attend" | "decline";

/** Warsaw's wall clock as `YYYY-MM-DD HH:MM`, which compares as a string against the corpus. */
function warsawNow(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
}

/**
 * The new seat count rises into place from under its line (or drops from above it when the count
 * goes down), like a counter wheel. Transform and opacity only, run by WAAPI on the compositor;
 * the line itself belongs to the field's well and stays put.
 */
function turnCounter(field: HTMLInputElement | null, direction: 1 | -1): void {
  if (!field || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  field.animate(
    [
      { transform: `translateY(${direction * 0.42}em)`, opacity: 0.15 },
      { transform: "translateY(0)", opacity: 1 },
    ],
    { duration: 460, easing: "cubic-bezier(0.22, 0.61, 0.16, 1)" },
  );
}

export function RsvpForm({
  copy,
  concert,
  startsOn,
  maxSeats,
  contactEmail,
}: RsvpFormProps): React.JSX.Element {
  const [fullName, setFullName] = useState("");
  const [seats, setSeats] = useState("1");
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState<Answer>("attend");
  const [error, setError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [nameInvalid, setNameInvalid] = useState(false);
  const [seatsInvalid, setSeatsInvalid] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const seatsRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const ids = useId();
  const errorId = `${ids}-error`;

  useEffect(() => {
    if (warsawNow() >= `${startsOn.date} ${startsOn.time}`) setPhase("closed");
  }, [startsOn.date, startsOn.time]);

  // The receipt replaces the form the focus was in, and the form replaces the receipt on
  // "change": each time, hand the focus to what took the place of the control that had it.
  const changing = useRef(false);
  useEffect(() => {
    if (phase === "sent") receiptRef.current?.focus();
    if (phase === "idle" && changing.current) {
      changing.current = false;
      seatsRef.current?.focus();
    }
  }, [phase]);

  const seatCount = Number.parseInt(seats, 10);
  const seatsValid = Number.isInteger(seatCount) && seatCount >= 1 && seatCount <= maxSeats;

  const step = useCallback(
    (delta: 1 | -1) => {
      const current = Number.isInteger(seatCount) ? seatCount : 1;
      const next = Math.min(maxSeats, Math.max(1, current + delta));
      setSeats(String(next));
      setSeatsInvalid(false);
      if (next !== current) turnCounter(seatsRef.current, delta);
    },
    [seatCount, maxSeats],
  );

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (phase === "sending") return;

      const name = fullName.trim().replace(/\s+/g, " ");
      setError(null);
      setNetworkError(false);
      setNameInvalid(false);
      setSeatsInvalid(false);

      if (name.length < 2) {
        setNameInvalid(true);
        setError(copy.errorName);
        nameRef.current?.focus();
        return;
      }
      const declining = answer === "decline";
      if (!declining && !seatsValid) {
        setSeatsInvalid(true);
        setError(copy.errorSeats);
        seatsRef.current?.focus();
        return;
      }

      setPhase("sending");
      try {
        const outcome = await submitReservation({
          concert,
          fullName: name,
          seats: declining ? 0 : seatCount,
        });
        setFullName(name);
        setPhase(outcome === "closed" ? "closed" : "sent");
      } catch {
        // Network failure and a non-2xx answer read the same to the guest: nothing was
        // recorded, the values stay in the fields, and the address is the way out.
        setPhase("idle");
        setNetworkError(true);
        setError(copy.errorNetwork);
      }
    },
    [phase, fullName, answer, seatsValid, seatCount, concert, copy],
  );

  const switchAnswer = useCallback(() => {
    setAnswer((current) => (current === "attend" ? "decline" : "attend"));
    setError(null);
    setNetworkError(false);
    setSeatsInvalid(false);
  }, []);

  if (phase === "closed") {
    return (
      <Typo locale="pl">
        <p className="rsvp-closed" role="status">
          {copy.closed}
        </p>
      </Typo>
    );
  }

  if (phase === "sent") {
    const declined = answer === "decline";
    return (
      <Typo locale="pl">
        <div
          ref={receiptRef}
          className="rsvp-receipt"
          role="status"
          aria-live="polite"
          tabIndex={-1}
        >
          <span className="rsvp-seal" aria-hidden="true" />
          <p className="rsvp-receipt-title">{declined ? copy.declinedTitle : copy.receiptTitle}</p>
          <dl className="rsvp-receipt-lines">
            <div className="rsvp-receipt-line">
              <dt>{copy.receiptName}</dt>
              <dd>{fullName}</dd>
            </div>
            {!declined && (
              <div className="rsvp-receipt-line">
                <dt>{copy.receiptSeats}</dt>
                <dd>{seatCount}</dd>
              </div>
            )}
          </dl>
          <p className="rsvp-receipt-farewell">
            {declined ? copy.declinedFarewell : copy.farewell}
          </p>
          {/* Either way, changing returns to the card ready to take seats: from a decline that
              is the only other answer, and from a reservation it is the count being corrected. */}
          <button
            type="button"
            className="rsvp-change"
            onClick={() => {
              changing.current = true;
              setAnswer("attend");
              setPhase("idle");
            }}
          >
            {declined ? copy.declinedChange : copy.change}
          </button>
        </div>
      </Typo>
    );
  }

  const sending = phase === "sending";
  const declining = answer === "decline";
  const atCeiling = !declining && seatsValid && seatCount === maxSeats;

  return (
    <Typo locale="pl">
      <form className="rsvp-form" onSubmit={onSubmit} noValidate aria-busy={sending || undefined}>
        <div className="rsvp-field">
          <span className="rsvp-line">
            <input
              ref={nameRef}
              id={`${ids}-name`}
              className="rsvp-name"
              type="text"
              name="name"
              autoComplete="name"
              autoCapitalize="words"
              spellCheck={false}
              maxLength={120}
              aria-invalid={nameInvalid || undefined}
              aria-describedby={nameInvalid ? errorId : undefined}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={sending}
            />
          </span>
          <label className="rsvp-caption" htmlFor={`${ids}-name`}>
            {copy.nameLabel}
          </label>
        </div>

        {!declining && (
          <div className="rsvp-field">
            <span className="rsvp-stepper">
              <button
                type="button"
                className="rsvp-step"
                aria-label={copy.fewer}
                aria-controls={`${ids}-seats`}
                onClick={() => step(-1)}
                disabled={sending || (seatsValid && seatCount <= 1)}
              />
              <span className="rsvp-well">
                <input
                  ref={seatsRef}
                  id={`${ids}-seats`}
                  className="rsvp-seats"
                  type="number"
                  name="seats"
                  inputMode="numeric"
                  min={1}
                  max={maxSeats}
                  aria-invalid={seatsInvalid || undefined}
                  aria-describedby={seatsInvalid ? errorId : undefined}
                  value={seats}
                  onChange={(e) => {
                    setSeats(e.target.value);
                    setSeatsInvalid(false);
                  }}
                  disabled={sending}
                />
              </span>
              <button
                type="button"
                className="rsvp-step rsvp-step-more"
                aria-label={copy.more}
                aria-controls={`${ids}-seats`}
                onClick={() => step(1)}
                disabled={sending || atCeiling}
              />
            </span>
            <label className="rsvp-caption" htmlFor={`${ids}-seats`}>
              {copy.seatsLabel}
            </label>
          </div>
        )}

        {atCeiling && (
          <p className="rsvp-hint">
            {copy.largerParty} <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
        )}

        {error && (
          <p id={errorId} className="rsvp-error" role="alert">
            {error}
            {networkError && (
              <>
                {" "}
                <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
              </>
            )}
          </p>
        )}

        <button className="rsvp-act" type="submit" disabled={sending}>
          <span className="rsvp-act-label">
            {sending ? copy.sending : declining ? copy.declineSubmit : copy.submit}
          </span>
        </button>

        <button type="button" className="rsvp-switch" onClick={switchAnswer} disabled={sending}>
          {declining ? copy.attendSwitch : copy.declineSwitch}
        </button>

        <p className="rsvp-fine" dangerouslySetInnerHTML={{ __html: copy.privacyHtml }} />
      </form>
    </Typo>
  );
}
