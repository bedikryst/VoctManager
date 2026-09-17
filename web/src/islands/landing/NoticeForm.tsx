/**
 * @file NoticeForm.tsx
 * @description The concert notice list's sign-up — an address, a consent, and nothing else — and
 *  the waiting leaf it is exchanged for once the address is handed over.
 *
 *  TWO COMPOSITIONS, ONE FORM. `band` is the arrangement every placement has always worn: labels
 *  and fields on one line, the button beside them. `leaf` is the correspondence page on
 *  /newsletter, where the address is the largest practical value on the sheet and the reading
 *  order is the one the form is actually filled in — address, name, consent, act. They are
 *  branched rather than restyled because they are genuinely different compositions and the
 *  reading ORDER differs; everything either of them does with what the reader typed is shared.
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
 *  message that distinguished the two would leak what the endpoint refuses to. The same rule
 *  governs the resend inside the waiting leaf — see `resent` in `i18n/content/nuntius.ts`.
 *
 *  AND IT TAKES MORE THAN THIS ISLAND'S OWN SUBTREE. The heading and the lede above belong to
 *  `components/NoticeSignup.astro`; left standing, the largest words on the page went on promising
 *  "we will let you know" while the one instruction that still matters — open your inbox, click
 *  the link — sat smaller and below them. On a double opt-in list that is not a cosmetic loss: an
 *  unread receipt is an address that expires in seven days having consented to nothing. So the
 *  island freezes the surrounding box, marks it, and the sheet hides what it was saying before.
 *  Which box that is differs by composition — see `holdBand`.
 * @architecture Astro islands 2026
 * @module islands/landing/NoticeForm
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { Locale } from "../../i18n/config";
import type { NoticeFormChrome } from "../../i18n/content/nuntius";
import {
  NOTICE_RESEND_COOLDOWN_MS,
  NoticeError,
  subscribeToNotices,
  type NoticeSurface,
} from "./api/notices";
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

/**
 * Where the reader is between the two leaves. `leaving` exists only on the correspondence leaf
 * and only while motion is allowed: it is the one frame in which BOTH are mounted, which is what
 * lets the written surface lift away from a receipt already standing underneath it.
 */
type Phase = "open" | "leaving" | "sent";

interface NoticeFormProps {
  readonly lang: Locale;
  /** Labels, errors and the consent clause. `consentHtml` arrives typeset and localized. */
  readonly chrome: NoticeFormChrome;
  readonly copy: NoticeFormCopy;
  readonly surface: NoticeSurface;
  /** Which composition to render. See the header. */
  readonly variant?: "band" | "leaf";
}

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The countdown on the resend button, as mm:ss.
 *
 * Rounded UP, which is the one rounding a shut control may use: `Math.floor` prints 0:00 for the
 * last whole second the button is still refusing to work, and a timer that reaches zero beside a
 * disabled button reads as a page that has stopped.
 */
function formatWait(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function NoticeForm({
  lang,
  chrome,
  copy,
  surface,
  variant = "band",
}: NoticeFormProps): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("open");
  /** When the resend button opens again. A wall-clock instant, so a backgrounded tab that misses
      every interval tick still computes the right remainder the moment it is looked at. */
  const [resendAt, setResendAt] = useState(0);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const emailRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  /** The band this island stands in, held from the moment it is marked so the receipt can be
      found afterwards without reaching through the document a second time. */
  const bandRef = useRef<HTMLElement | null>(null);
  /** Set while returning from the waiting leaf, so focus lands back on the address being fixed. */
  const refocusEmail = useRef(false);
  /** Whether focus has already been handed to the receipt for this exchange. */
  const greeted = useRef(false);

  const isLeaf = variant === "leaf";

  /**
   * Marks the box this form is exchanged inside and freezes its height BEFORE it loses its
   * heading, so nothing moves while the reader is looking straight at it.
   *
   * WHICH BOX DIFFERS BY COMPOSITION, and that is the whole reason the leaf has a stage. The band
   * holds the WHOLE inner block, because there the receipt replaces a heading, a lede and a form
   * that are siblings with nothing around them. The leaf holds only `.notice-stage`: the running
   * head above it survives the exchange, and the two written surfaces are superimposed inside the
   * stage, so freezing the stage is what keeps the receipt from sliding upward the instant the
   * form unmounts from under it.
   *
   * `offsetHeight` is a NUMBER read now — a computed style would be a live handle and would
   * report the collapsed box a tick later. `min-height` rather than `height`, because the waiting
   * leaf is allowed to be the taller of the two.
   */
  const holdBand = useCallback((): HTMLElement | null => {
    const selector = isLeaf ? ".notice-stage" : ".notice-inner";
    const band = formRef.current?.closest<HTMLElement>(selector) ?? null;
    if (!band) return null;
    band.style.minHeight = `${band.offsetHeight}px`;
    bandRef.current = band;
    return band;
  }, [isLeaf]);

  /**
   * Lets the sheet down onto what it now says.
   *
   * The freeze above is what keeps the receipt still while the written surface lifts off it — but
   * it is a floor, not a size, and a sheet left standing at the sign-up's height around four lines
   * of instruction is two hundred pixels of blank paper under a centred paragraph. So once the
   * exchange is over the floor is walked down to the receipt's own height and then removed
   * entirely: the paper contracts to the shorter letter, which is the one movement in this whole
   * sequence that a sheet of paper would actually make.
   *
   * ONLY DOWNWARD. A waiting leaf that needs more room than the form did — a long address, an open
   * recovery disclosure, three locales of it — keeps the floor it was given and grows past it,
   * which is what `min-height` was chosen for in the first place.
   */
  const settleBand = useCallback((band: HTMLElement) => {
    // Two frames: the first lets React paint the receipt into the box, the second reads a height
    // that is the receipt's own rather than the form's it replaced.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const done = band.querySelector<HTMLElement>(".notice-done");
        if (!done) return;
        const target = done.offsetHeight;
        // Nothing to walk down, or nothing that may be walked: without a transition there is no
        // `transitionend` to clear the floor again, so the floor simply goes.
        if (!target || target >= band.offsetHeight || prefersReducedMotion()) {
          band.style.minHeight = "";
          return;
        }
        band.dataset.settling = "true";
        band.style.minHeight = `${target}px`;
        // Cleared at the end so the box goes back to being measured by its content: a floor left
        // at a number is a floor that will be wrong the moment the disclosure below it opens.
        const release = (event: TransitionEvent) => {
          if (event.propertyName !== "min-height") return;
          band.removeEventListener("transitionend", release);
          delete band.dataset.settling;
          band.style.minHeight = "";
        };
        band.addEventListener("transitionend", release);
      });
    });
  }, []);

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
      setError(null);
      setLoading(true);
      try {
        await subscribeToNotices({
          email: address,
          name: name.trim(),
          locale: lang,
          surface,
        });
        // This submission WAS the request the cooldown counts from, so the resend opens a full
        // cooldown from here rather than from the first press of the button inside the receipt.
        setResendAt(Date.now() + NOTICE_RESEND_COOLDOWN_MS);
        const band = holdBand();
        // Reduced motion is shown the target state directly: the exchange is the one gesture on
        // this sheet that has an intermediate frame, and there is nothing in it to read.
        const exchanges = isLeaf && !prefersReducedMotion();
        if (band) {
          if (exchanges) band.dataset.phase = "leaving";
          else {
            band.dataset.sent = "true";
            // No exchange to wait for: the sheet is let down as soon as the receipt is painted.
            if (isLeaf) settleBand(band);
          }
        }
        setPhase(exchanges ? "leaving" : "sent");
      } catch (err) {
        if (!(err instanceof NoticeError)) console.error("[VoctNotice] unexpected", err);
        else console.error("[VoctNotice]", err);
        setLoading(false);
        setError(chrome.errorSend);
      }
    },
    [loading, email, name, chrome, lang, surface, isLeaf, holdBand, settleBand],
  );

  /** The written surface has finished lifting away; the receipt standing under it is now the leaf.
      Driven by the animation rather than by a timer, so the duration lives only in the sheet.
      Animation events bubble, so a child's own motion must not be mistaken for the form's. */
  const onLeft = useCallback(
    (event: React.AnimationEvent<HTMLFormElement>) => {
      if (event.target !== event.currentTarget) return;
      const band = bandRef.current;
      if (band) {
        delete band.dataset.phase;
        band.dataset.sent = "true";
        settleBand(band);
      }
      setPhase("sent");
    },
    [settleBand],
  );

  /** Back to the fields with everything still in them — a typo in an address is the whole reason
      this way back exists, and re-ticking a consent given a moment ago would be a second ask. */
  const onEditAddress = useCallback(() => {
    const band = bandRef.current;
    if (band) {
      delete band.dataset.sent;
      delete band.dataset.settling;
      band.style.minHeight = "";
    }
    setLoading(false);
    setResent(false);
    setRecoveryOpen(false);
    refocusEmail.current = true;
    setPhase("open");
  }, []);

  const waiting = Math.max(0, resendAt - now);

  const onResend = useCallback(async () => {
    if (resending || Date.now() < resendAt) return;
    setResending(true);
    setResent(false);
    setError(null);
    try {
      await subscribeToNotices({
        email: email.trim(),
        name: name.trim(),
        locale: lang,
        surface,
      });
      setResendAt(Date.now() + NOTICE_RESEND_COOLDOWN_MS);
      setResent(true);
    } catch (err) {
      if (!(err instanceof NoticeError)) console.error("[VoctNotice] unexpected", err);
      else console.error("[VoctNotice]", err);
      setError(chrome.errorSend);
    } finally {
      setResending(false);
    }
  }, [resending, resendAt, email, name, lang, surface, chrome]);

  // The countdown runs only while the reader is looking at it. It is read from the clock on every
  // tick rather than counted down, so a tab that slept through the cooldown opens accurate.
  useEffect(() => {
    if (!recoveryOpen) return;
    setNow(Date.now());
    if (resendAt <= Date.now()) return;
    const id = window.setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= resendAt) window.clearInterval(id);
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [recoveryOpen, resendAt]);

  // Coming back to fix the address: the field the reader returned for takes the caret.
  useEffect(() => {
    if (phase !== "open" || !refocusEmail.current) return;
    refocusEmail.current = false;
    emailRef.current?.focus();
  }, [phase]);

  // The receipt carries the only instruction left on screen, so focus moves to it — a screen
  // reader and the keyboard follow the eye. The page scrolls only when the receipt is not
  // already whole in view, which on a phone is the ordinary case: the keyboard closes as the
  // form submits and hands back some 300px of viewport, moving everything under the reader.
  useEffect(() => {
    if (phase === "open") {
      greeted.current = false;
      return;
    }
    // The exchange passes through two phases and the receipt is mounted for both of them; the
    // move happens on the first, or the reader's caret would be pulled back mid-gesture.
    if (greeted.current) return;
    const done = bandRef.current?.querySelector<HTMLElement>(".notice-done");
    if (!done) return;
    greeted.current = true;

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
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [phase]);

  /**
   * The clause, STATED rather than ticked.
   *
   * NO CHECKBOX, AND THE LAW IS WHY — not the other way round. Consent under the GDPR is a
   * statement or a CLEAR AFFIRMATIVE ACTION (art. 4(11), recital 32); a tick box is one way of
   * giving one, never the required way. On a form whose only purpose is to join this list,
   * submitting it IS that action — and this list is double opt-in, so the consent is not recorded
   * at all until a second, independent action: the click in the mail. The backend says the same
   * thing in its own words (`outreach/serializers`): the `consent` flag is not stored, and the
   * evidence is `confirmed_at`. A box that no column ever recorded was a widget standing between
   * a reader and a list, carrying no legal weight it did not already have.
   *
   * WHAT THE LAW DOES REQUIRE IS THIS TEXT, ON SCREEN, BEFORE THE ACT — who the controller is,
   * what the address is for, and how to withdraw. So the clause did not get shorter or quieter
   * because the box went: it is still the whole wording, still stamped by version
   * (`outreach/consent.NOTICE_CLAUSE_VERSION`), still rendered by this one component for every
   * placement. Only the widget is gone.
   *
   * Typeset and localized at build (lib/islandCopy) — the build's own HTML pass skips island
   * subtrees, and `Typo` sees no string leaf inside an injected fragment.
   */
  const consentBlock = (
    <p className="notice-consent-text" dangerouslySetInnerHTML={{ __html: chrome.consentHtml }} />
  );

  const emailInput = (
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
  );

  /* Optional, and nothing here enforces it beyond that: no validation, no trimming the reader can
     see, no asterisk on the one beside it. The backend trims and the service stores `''` for
     anything blank, so a reader who would rather stay a stranger costs the form no branch. */
  const nameInput = (
    <input
      id="noticeName"
      className="notice-email"
      type="text"
      autoComplete="given-name"
      placeholder={chrome.namePlaceholder}
      value={name}
      onChange={(event) => setName(event.target.value)}
    />
  );

  /* Its own class, not the page's `.pill`: that rule is SCOPED to KoncertyPage, and Astro appends
     the scope attribute to every compound — an element React rendered carries none, so the page's
     own affordance styles never reach inside an island. Everything this form and the receipt page
     wear lives in `styles/notice.css`. */
  const submitButton = (
    <button type="submit" className="notice-submit" disabled={loading}>
      {loading ? chrome.submitting : chrome.submit}
    </button>
  );

  const errorLine = error ? (
    <p className="notice-error" role="alert">
      {error}
    </p>
  ) : null;

  /* `inert` rather than `aria-hidden` on the leaving sheet: it takes the sheet out of the reading
     order AND out of the tab order, and it moves focus off whatever was still holding it — which
     `aria-hidden` over a focused field would merely have made unannounceable. */
  const form =
    phase === "sent" ? null : (
      <form
        ref={formRef}
        className="notice-form"
        onSubmit={onSubmit}
        noValidate
        aria-busy={loading}
        inert={phase === "leaving"}
        onAnimationEnd={phase === "leaving" ? onLeft : undefined}
      >
        {isLeaf ? (
          <>
            {/* The address is the sheet's largest practical value and leads it, which is also the
                order the form is filled in. The name shares the register below it. */}
            <div className="notice-lines">
              <div className="notice-field notice-field-address">
                <label className="notice-label eyebrow" htmlFor="noticeEmail">
                  {chrome.emailLabel}
                </label>
                {emailInput}
              </div>
              <div className="notice-field notice-field-given">
                <label className="notice-label eyebrow" htmlFor="noticeName">
                  {chrome.nameLabel}
                </label>
                {nameInput}
              </div>
            </div>
            {consentBlock}
            {/* The rule is what gives the act a place to stand — the line a form is signed on. It
                closes the clause above it and carries the block on its outer end. */}
            <div className="notice-act">{submitButton}</div>
            {errorLine}
          </>
        ) : (
          <>
            <div className="notice-row">
              <div className="notice-field notice-field-name">
                <label className="notice-label eyebrow" htmlFor="noticeName">
                  {chrome.nameLabel}
                </label>
                {nameInput}
              </div>
              <div className="notice-field">
                <label className="notice-label eyebrow" htmlFor="noticeEmail">
                  {chrome.emailLabel}
                </label>
                {emailInput}
              </div>
              {submitButton}
            </div>
            {consentBlock}
            {errorLine}
          </>
        )}
      </form>
    );

  const receipt =
    phase === "open" ? null : (
      /* `tabIndex` is what lets focus land here; it is not a control and wears no ring. */
      <div className="notice-done" role="status" tabIndex={-1}>
        <span className="notice-done-mark" aria-hidden="true">
          ✦
        </span>
        <p className="notice-done-title">{copy.sentTitle}</p>
        <p className="notice-done-body">{copy.sentBody}</p>
        {isLeaf ? (
          <p className="notice-done-address">
            <span className="notice-done-address-label eyebrow">{chrome.pendingAddressLabel}</span>
            <span className="notice-done-address-value">{email.trim()}</span>
            <button type="button" className="notice-textlink" onClick={onEditAddress}>
              {chrome.editAddress}
            </button>
          </p>
        ) : null}
        <p className="notice-done-hint">{copy.sentHint}</p>
        {isLeaf ? (
          /* Shut by default and quiet: a reader whose letter arrived never opens it, and the one
             whose letter did not is the only person this row is for. */
          <details
            className="notice-recovery"
            onToggle={(event) => setRecoveryOpen(event.currentTarget.open)}
          >
            <summary className="notice-recovery-summary">{chrome.recoverySummary}</summary>
            <p className="notice-recovery-body">{chrome.recoveryBody}</p>
            <button
              type="button"
              className="notice-submit notice-submit-quiet"
              onClick={() => void onResend()}
              disabled={resending || waiting > 0}
            >
              {resending ? chrome.resending : chrome.resend}
            </button>
            {/* One live region for both answers, so a screen reader hears the outcome rather than
                only seeing a button go quiet. */}
            <p className="notice-recovery-state" role="status">
              {waiting > 0
                ? chrome.resendWait.replace("{time}", formatWait(waiting))
                : resent
                  ? chrome.resent
                  : ""}
            </p>
          </details>
        ) : null}
        {errorLine}
      </div>
    );

  return (
    <Typo locale={lang}>
      {form}
      {receipt}
    </Typo>
  );
}
