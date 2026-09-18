/**
 * @file NoticeForm.tsx
 * @description The concert notice list's sign-up — an address, a consent, and nothing else — and
 *  the waiting leaf it is exchanged for once the address is handed over.
 *
 *  ONE COMPOSITION, TWO PLACEMENTS, AND THE HOST DRESSES IT. The form is one blank — a label, a
 *  line to write on, the act, the clause — wherever it stands. `letter` is /newsletter, where the
 *  page IS the letter and `styles/notice-blank.css` dresses the blank as a form letter's
 *  (`Na adres ______`, the paper bar with the arrow). `band` is every other door to the list, and
 *  there the blank wears NOTHING OF ITS OWN: the page it stands on dresses it from its own
 *  materials (the station title's line and the pill on /koncerty, the register's ruled lines on
 *  the landing, the door's fact row on a concert page, the doors' serif line and capsule on
 *  /kontakt), because an object carried from
 *  one page onto another is a patch on every page but its own. Hence the neutral class names, and
 *  hence the two things this markup does decide by placement — the letter's arrow and the
 *  letter's `Na adres` label are the letter's gestures, and a band prints the plain field name.
 *  Beyond that the placements differ in what surrounds the exchange, not in the exchange: the
 *  letter mirrors the address onto the sheet beside it and its receipt carries the apparatus of a
 *  page that stands alone (the address as sent, the way back to it, the resend); a band inside a
 *  longer page freezes its own block and shows the short receipt.
 *
 *  NO NAME FIELD, AND THAT IS A PLACEMENT, NOT A REMOVAL. The greeting still wants a name; the page
 *  that asks for it is the receipt (/nuntius `preferences`), where the reader has already confirmed
 *  and the question is the only thing on screen. Beside the one blank a second field would make the
 *  ask a form, which is the verdict the letter was built to answer — and with the clause down to
 *  one line, nothing on screen said what the name was for. The API's contract is unchanged:
 *  `''` is an answer, an unnamed letter, and it is what this form sends.
 *
 *  IT WRITES THE ADDRESS ONTO THE SHEET BESIDE IT. On the letter the addressee's line is the
 *  server's markup, outside this island, so what the reader types is announced on `window`
 *  (`voct:notice-address`) and the page mirrors it. An island may not reach into a tree React does
 *  not own, and the sheet must not become one.
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

/** Which of the two surfaces the reader is on: the blank, or the receipt that replaces it. */
type Phase = "open" | "sent";

interface NoticeFormProps {
  readonly lang: Locale;
  /** Labels, errors and the consent clause. `consentHtml` arrives typeset and localized. */
  readonly chrome: NoticeFormChrome;
  readonly copy: NoticeFormCopy;
  readonly surface: NoticeSurface;
  /** What stands around the exchange. See the header. */
  readonly placement?: "band" | "letter";
}

/**
 * What the reader has written, for the letter beside the field. `state` is what the sheet does
 * with it: `writing` mirrors it onto the addressee's line, `sent` inks that line and lights the
 * sanctuary lamp in the photograph, and returning to the field takes both back.
 */
export interface NoticeAddressEvent {
  readonly value: string;
  readonly state: "writing" | "sent";
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
  placement = "band",
}: NoticeFormProps): React.JSX.Element {
  const [email, setEmail] = useState("");
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
  /** The line has the SHAPE of an address — a name, an `@`, a host, a dot and the first letter of
      its tail. A host may answer that moment (the landing's seal leaves the verb's line and rises
      to the end of the line just written). It is a pure reading of the value, so it holds while
      the rest of the tail is typed and drops only when that letter or the dot is deleted: a state
      that rose and fell on a timer moved the seal on every letter of `.com`. It is not the
      browser's `:valid` either, which calls `name@host` an address with no dot at all and would
      fire the answer three characters into the host. Validity proper is `onSubmit`'s. */
  const ready = /^[^\s@]+@[^\s@]+\.[^\s@.]/.test(email.trim());
  const emailRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  /** The band this island stands in, held from the moment it is marked so the receipt can be
      found afterwards without reaching through the document a second time. */
  const bandRef = useRef<HTMLElement | null>(null);
  /** Set while returning from the receipt, so focus lands back on the address being fixed. */
  const refocusEmail = useRef(false);
  /** Whether focus has already been handed to the receipt for this exchange. */
  const greeted = useRef(false);

  /** The letter stands alone, so its receipt carries the apparatus of a page: the address as it
      was sent, the way back to it, and the recovery row. A band inside a longer page does not. */
  const isLetter = placement === "letter";

  /* The letter is addressed as the reader types — character for character, with no easing: it is
     their writing, not an animation. Announced rather than written, because the sheet is the
     server's markup and this island does not own it. */
  const mirror = useCallback(
    (value: string, state: NoticeAddressEvent["state"]): void => {
      if (!isLetter) return;
      window.dispatchEvent(
        new CustomEvent<NoticeAddressEvent>("voct:notice-address", { detail: { value, state } }),
      );
    },
    [isLetter],
  );

  /**
   * Marks the box this form is exchanged inside and freezes its height BEFORE it loses its
   * heading, so nothing moves while the reader is looking straight at it.
   *
   * WHICH BOX DIFFERS BY PLACEMENT. The band holds the WHOLE inner block, because there the
   * receipt replaces a rubric, a sentence and a form that are siblings with nothing around them.
   * The letter's box is the column the blank stands in, and nothing above it: the sentence under
   * the photograph is the page's h1 and stays — it says what the letter is, which is still true
   * once the address has gone.
   *
   * `offsetHeight` is a NUMBER read now — a computed style would be a live handle and would
   * report the collapsed box a tick later. `min-height` rather than `height`, because the receipt
   * is allowed to be the taller of the two.
   */
  const holdBand = useCallback((): HTMLElement | null => {
    const selector = isLetter ? ".notice-letter-ask" : ".notice-inner";
    const band = formRef.current?.closest<HTMLElement>(selector) ?? null;
    if (!band) return null;
    band.style.minHeight = `${band.offsetHeight}px`;
    bandRef.current = band;
    return band;
  }, [isLetter]);

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
          name: "",
          locale: lang,
          surface,
        });
        // This submission WAS the request the cooldown counts from, so the resend opens a full
        // cooldown from here rather than from the first press of the button inside the receipt.
        setResendAt(Date.now() + NOTICE_RESEND_COOLDOWN_MS);
        const band = holdBand();
        if (band) {
          band.dataset.sent = "true";
          // The letter's column is let down onto the receipt as soon as it is painted; a band's
          // receipt is centred in the block the form held, so the floor there simply stays.
          if (isLetter) settleBand(band);
        }
        setPhase("sent");
        // The address that was actually POSTED, not whatever the field holds when the answer
        // lands: a slow answer beside an edited field must never let the letter name somebody
        // nobody wrote to.
        mirror(address, "sent");
      } catch (err) {
        if (!(err instanceof NoticeError)) console.error("[VoctNotice] unexpected", err);
        else console.error("[VoctNotice]", err);
        setLoading(false);
        setError(chrome.errorSend);
      }
    },
    [loading, email, chrome, lang, surface, isLetter, holdBand, settleBand, mirror],
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
    mirror(email.trim(), "writing");
  }, [email, mirror]);

  const waiting = Math.max(0, resendAt - now);

  const onResend = useCallback(async () => {
    if (resending || Date.now() < resendAt) return;
    setResending(true);
    setResent(false);
    setError(null);
    try {
      await subscribeToNotices({
        email: email.trim(),
        name: "",
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
  }, [resending, resendAt, email, lang, surface, chrome]);

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
   * WHAT THE LAW DOES REQUIRE IS A FIRST LAYER ON SCREEN, BEFORE THE ACT: who the controller is,
   * with the full account one link away. That is the whole clause — one line naming the
   * foundation and linking the policy. The purpose stands directly above it in the band's own
   * sentence, and the way out is in the policy and in every letter (`outreach/consent.py` records
   * why the successor left the screen). It is still stamped by version
   * (`outreach/consent.NOTICE_CLAUSE_VERSION`) and still rendered by this one component for every
   * placement, so no two placements can ever show two wordings.
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
      /* `required` is what makes `:valid` mean "a well-formed address is written here" rather than
         "nothing is written yet": a host may let its act answer that state (the landing's seal
         inks once the line is written). The form is `noValidate`, so the browser never speaks. */
      required
      /* No example address: this is a form letter's line, and the label sitting on its baseline is
         what says what goes on it. A specimen address inside the rule would be the one printed
         thing on the page that is not the reader's or ours. `data-blank` is the honest form of the
         `:placeholder-shown` trick for a field that has none: a host may mark the unwritten line
         (the landing dots it) and the mark goes the moment anything is written, autofill included,
         because the field is controlled and autofill reaches `onChange`. */
      data-blank={email === "" ? "" : undefined}
      aria-invalid={emailInvalid || undefined}
      value={email}
      onChange={(event) => {
        setEmail(event.target.value);
        setEmailInvalid(false);
        if (event.target.value.trim()) setError(null);
        mirror(event.target.value.trim(), "writing");
      }}
    />
  );

  const errorLine = error ? (
    <p className="notice-error" role="alert">
      {error}
    </p>
  ) : null;

  /* Its own classes, not any page's: a page rule is SCOPED by Astro, which appends the scope
     attribute to every compound, and an element React rendered carries none — so a page that
     dresses this form does it through a global sheet or `:global()` rules keyed on the section it
     mounts the island in (`.notice-band`, `.path-liniatura`, `.kd-nuntius`, `.notice-door`). */
  const form =
    phase === "sent" ? null : (
      <form
        ref={formRef}
        className="notice-form"
        onSubmit={onSubmit}
        noValidate
        aria-busy={loading}
        /* Read by the host's sheet, never by this island: what the moment LOOKS like belongs to the
           page the ask stands on; the island only says when the line has become an address. */
        data-ready={ready ? "" : undefined}
      >
        {/* THE BLANK: a label and a line to write on. On the letter the label is the form letter's
            `Na adres`, standing on the line's own baseline with the rule running on from it (the
            addressee's line on the sheet is the same shape, and the two rule themselves in one
            gesture on arrival); the field's plain name rides along for assistive technology. A band
            prints the plain name and lets its host decide where the label stands. */}
        <div className="notice-blank">
          <label className="notice-blank-label" htmlFor="noticeEmail">
            {isLetter ? (
              <>
                {chrome.addressLine}
                <span className="sr-only"> — {chrome.emailLabel}</span>
              </>
            ) : (
              chrome.emailLabel
            )}
          </label>
          <span className="notice-blank-line">{emailInput}</span>
        </div>
        {errorLine}
        {/* The act. The arrow is the letter's gesture — its paper bar sends the letter — and no
            host page draws arrows on its controls, so a band's act is the verb alone. */}
        <button type="submit" className="notice-act" disabled={loading}>
          <span>{loading ? chrome.submitting : chrome.commit}</span>
          {isLetter && (
            <span className="notice-act-arrow" aria-hidden="true">
              →
            </span>
          )}
        </button>
        {consentBlock}
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
        {isLetter ? (
          <p className="notice-done-address">
            <span className="notice-done-address-label eyebrow">{chrome.pendingAddressLabel}</span>
            <span className="notice-done-address-value">{email.trim()}</span>
            <button type="button" className="notice-textlink" onClick={onEditAddress}>
              {chrome.editAddress}
            </button>
          </p>
        ) : null}
        <p className="notice-done-hint">{copy.sentHint}</p>
        {isLetter ? (
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
