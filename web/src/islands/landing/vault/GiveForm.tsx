/**
 * @file GiveForm.tsx
 * @description Axepta BNP Paribas donation form. Tier picker (PLN: 50/100/200, EUR:
 *  20/50/100, or custom amount), email + consent capture, then POSTs to the public Django
 *  endpoint that returns a gateway redirect URL. Exposes a `preselect(amount)` imperative API
 *  via VaultContext so opening links can pre-populate the form. Web/Astro port of the SPA widget.
 *
 *  THE LOCALE TRAVELS WITH THE DONATION. The gateway's own page carries its language in the URL
 *  (`paywall.axepta.pl/<lang>/pay/…`), so the backend rewrites that segment from what is posted
 *  here — otherwise a reader of any language meets whichever page the gateway defaults to, which
 *  is not the one they were reading a second earlier.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/GiveForm
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { initiateDonation, DonationInitiateError } from "../api/donations";
import {
  CURRENCY_SUFFIX,
  GIVE_DEFAULT_TIER,
  GIVE_MAX,
  GIVE_MIN,
  GIVE_TIERS,
  type GiveCurrency,
} from "../constants/giveTiers";
import { formatMoney } from "../lib/formatMoney";
import { VAULT_CONFIG } from "../constants/vaultConfig";
import { useVault } from "../providers/VaultContext";
import { useVaultCopy } from "./copyContext";
import { Typo } from "../lib/Typo";

type TierValue = number | "custom";

interface GiveFormState {
  readonly currency: GiveCurrency;
  readonly tier: TierValue;
  readonly customAmount: string;
  readonly email: string;
  readonly consent: boolean;
}

const INITIAL_STATE: GiveFormState = {
  currency: "PLN",
  tier: GIVE_DEFAULT_TIER,
  customAmount: "",
  email: "",
  consent: false,
};

function resolveAmount(state: GiveFormState): number {
  if (state.tier === "custom") {
    const parsed = parseFloat(state.customAmount.replace(",", "."));
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }
  return GIVE_TIERS[state.currency][state.tier as number];
}

function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount >= GIVE_MIN && amount <= GIVE_MAX;
}

export function GiveForm(): React.JSX.Element {
  const { registerGiveApi, registerConsentAcceptor, openRegulamin } = useVault();
  const { lang, vault, terms, t } = useVaultCopy();
  const [state, setState] = useState<GiveFormState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [consentInvalid, setConsentInvalid] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

  const amount = resolveAmount(state);
  const amountValid = isValidAmount(amount);

  const amountLabel = useMemo(
    () => (amountValid ? formatMoney(amount, state.currency, lang) : "—"),
    [amount, amountValid, state.currency, lang],
  );

  const ctaLabel = useMemo(() => {
    if (loading) return t.ctaProcessing;
    return amountValid ? t.ctaGive(formatMoney(amount, state.currency, lang)) : t.ctaFallback;
  }, [amount, amountValid, loading, state.currency, lang, t]);

  // Expose preselect() to the VaultContext so external openers can pre-populate the amount.
  useEffect(() => {
    const preselect = (presetAmount: number) => {
      const value = Math.round(Number(presetAmount) || 0);
      setError(null);
      setState((prev) => {
        const tiers = GIVE_TIERS.PLN;
        const idx = tiers.indexOf(value);
        if (idx !== -1) {
          return { ...prev, currency: "PLN", tier: idx, customAmount: "" };
        }
        if (value >= GIVE_MIN) {
          return { ...prev, currency: "PLN", tier: "custom", customAmount: String(value) };
        }
        return { ...prev, currency: "PLN", tier: GIVE_DEFAULT_TIER, customAmount: "" };
      });
    };
    registerGiveApi({ preselect });
    return () => registerGiveApi(null);
  }, [registerGiveApi]);

  // Expose a consent acceptor so the Regulamin's "Akceptuję" button can flip the checkbox.
  useEffect(() => {
    const acceptor = () => {
      setState((prev) => ({ ...prev, consent: true }));
      setConsentInvalid(false);
      setError(null);
    };
    registerConsentAcceptor(acceptor);
    return () => registerConsentAcceptor(null);
  }, [registerConsentAcceptor]);

  const selectTier = useCallback((tier: TierValue) => {
    setState((prev) => ({ ...prev, tier }));
    setError(null);
    if (tier === "custom") {
      window.requestAnimationFrame(() => customRef.current?.focus());
    }
  }, []);

  const setCurrency = useCallback((currency: GiveCurrency) => {
    setState((prev) => (prev.currency === currency ? prev : { ...prev, currency }));
    setError(null);
  }, []);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (loading) return;
      setError(null);

      const resolved = resolveAmount(state);
      const email = state.email.trim();

      if (!Number.isFinite(resolved) || resolved < GIVE_MIN) {
        setError(t.errorAmount);
        if (state.tier === "custom") customRef.current?.focus();
        return;
      }
      if (resolved > GIVE_MAX) {
        setError(t.errorAmountMax(formatMoney(GIVE_MAX, state.currency, lang)));
        return;
      }
      const emailEl = emailRef.current;
      if (!email || !emailEl?.checkValidity()) {
        setEmailInvalid(true);
        setError(t.errorEmail);
        emailEl?.focus();
        return;
      }
      if (!state.consent) {
        setConsentInvalid(true);
        setError(t.errorConsent);
        consentRef.current?.focus();
        return;
      }

      setLoading(true);
      try {
        const { redirectUrl } = await initiateDonation({
          email,
          amount: resolved,
          currency: state.currency,
          locale: lang,
        });
        window.location.href = redirectUrl;
      } catch (err) {
        if (err instanceof DonationInitiateError) {
          console.error("[VoctGive]", err);
        } else {
          console.error("[VoctGive] unexpected", err);
        }
        setLoading(false);
        setError(t.errorNetwork);
      }
    },
    [loading, state, lang, t],
  );

  return (
    <Typo locale={lang}>
      <form
        className="give-form"
        onSubmit={onSubmit}
        noValidate
        aria-busy={loading}
      >
        <div className="give-field">
          <div className="give-label-row">
            <span className="give-label micro">{t.amountLabel}</span>
            <span className="give-amount-current" aria-live="polite">
              {amountLabel}
            </span>
          </div>
          <div
            className="give-currency"
            data-currency={state.currency}
            role="radiogroup"
            aria-label={t.currencyAria}
          >
            <button
              type="button"
              className={`give-currency-opt${state.currency === "PLN" ? " is-active" : ""}`}
              role="radio"
              aria-checked={state.currency === "PLN"}
              onClick={() => setCurrency("PLN")}
            >
              PLN
            </button>
            <button
              type="button"
              className={`give-currency-opt${state.currency === "EUR" ? " is-active" : ""}`}
              role="radio"
              aria-checked={state.currency === "EUR"}
              onClick={() => setCurrency("EUR")}
            >
              EUR
            </button>
            <div className="give-currency-thumb" aria-hidden="true" />
          </div>
          <div className="give-tiers" role="radiogroup" aria-label={t.tiersAria}>
            {GIVE_TIERS[state.currency].map((value, index) => (
              <button
                key={index}
                type="button"
                className={`give-tier${state.tier === index ? " is-active" : ""}`}
                role="radio"
                aria-checked={state.tier === index}
                onClick={() => selectTier(index)}
              >
                {formatMoney(value, state.currency, lang)}
              </button>
            ))}
            <button
              type="button"
              className={`give-tier give-tier--custom${state.tier === "custom" ? " is-active" : ""}`}
              role="radio"
              aria-checked={state.tier === "custom"}
              onClick={() => selectTier("custom")}
            >
              {t.customTier}
            </button>
          </div>
          {state.tier === "custom" ? (
            <div className="give-custom">
              <div className="give-custom-field">
                <input
                  ref={customRef}
                  type="number"
                  inputMode="decimal"
                  min="1"
                  max={GIVE_MAX}
                  step="1"
                  placeholder="0"
                  autoComplete="off"
                  aria-label={t.customAria}
                  value={state.customAmount}
                  onChange={(event) => {
                    setState((prev) => ({
                      ...prev,
                      customAmount: event.target.value,
                    }));
                    setError(null);
                  }}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <span className="give-custom-suffix" aria-hidden="true">
                  {CURRENCY_SUFFIX[state.currency]}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="give-field">
          <label className="give-label micro" htmlFor="giveEmail">
            {t.emailLabel}
          </label>
          <input
            ref={emailRef}
            id="giveEmail"
            name="email"
            type="email"
            className="give-email"
            placeholder={t.emailPlaceholder}
            required
            autoComplete="email"
            inputMode="email"
            aria-invalid={emailInvalid || undefined}
            value={state.email}
            onChange={(event) => {
              setState((prev) => ({ ...prev, email: event.target.value }));
              setEmailInvalid(false);
              if (event.target.value.trim()) setError(null);
            }}
          />
        </div>

        {error ? (
          <p className="give-error" role="alert">
            {error}
          </p>
        ) : null}

        <label className="give-consent">
          <input
            ref={consentRef}
            type="checkbox"
            className="give-consent-input"
            required
            aria-invalid={consentInvalid || undefined}
            checked={state.consent}
            onChange={(event) => {
              setState((prev) => ({ ...prev, consent: event.target.checked }));
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
          {/* One sentence broken at the link, because the link is a BUTTON that opens the terms
              overlay — and the desk's inline vocabulary has no `<button>`. The title comes from
              the terms document itself, so the checkbox and the overlay's own heading can never
              drift into two names for one thing. */}
          <span className="give-consent-text">
            {`${vault.online.consentLead} `}
            <button
              type="button"
              className="give-consent-link plausible-event-name=regulamin+darowizn"
              aria-haspopup="dialog"
              aria-controls="regulamin"
              onClick={(event) => {
                event.stopPropagation();
                openRegulamin();
              }}
            >
              {terms.head.title}
            </button>
            .
          </span>
        </label>

        <button
          type="submit"
          className={`method-cta give-submit plausible-event-name=wesprzyj+Axepta${loading ? " is-loading" : ""}`}
          disabled={loading}
        >
          <span className="method-cta-text">{ctaLabel}</span>
          <span className="method-cta-arrow" aria-hidden="true">
            →
          </span>
        </button>

        <div className="give-fineprint">
          <p className="give-methods-note">
            {state.currency === "PLN" ? vault.online.methodsNotePln : vault.online.methodsNoteEur}
          </p>
          {/* The transfer title stays Polish in every locale: it is the string the foundation's
              bank statement has to carry, not a sentence for the reader. Only its label turns. */}
          <p className="give-descriptor">
            {`${t.transactionTitleLabel}: `}
            <strong>{VAULT_CONFIG.recipient.title}</strong>
          </p>
        </div>
      </form>
    </Typo>
  );
}
