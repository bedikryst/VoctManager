/**
 * @file ResetPasswordPage.tsx
 * @description Self-service password recovery on the shared auth threshold.
 * One route, two modes derived from the URL: without a signed link it asks for
 * an e-mail (enumeration-safe "we sent it if it exists"); with uid+token it
 * lets the member set a new password. Mirrors the login card aesthetic.
 * @architecture Enterprise SaaS 2026
 * @module pages/auth/ResetPasswordPage
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { AlertCircle, ArrowLeft, CheckCircle2, Mail, MailCheck } from "lucide-react";

import { usePasswordReset } from "@features/auth/hooks/usePasswordReset";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { PasswordInput } from "@/shared/ui/primitives/PasswordInput";
import { PasswordStrengthMeter } from "@/shared/ui/composites/PasswordStrengthMeter";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";
import { EASE } from "@/shared/ui/kinematics/motion-presets";
import { AuthShell } from "@features/auth/components/AuthShell";
import { AuthBrand } from "@features/auth/components/AuthBrand";
import { PasswordRequirements } from "@features/auth/components/PasswordRequirements";

const CARD_SHADOW =
  "shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_2px_6px_-2px_rgba(22,20,18,0.08),0_30px_64px_-22px_rgba(120,104,82,0.5)]";

export default function ResetPasswordPage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    mode,
    email,
    setEmail,
    requestError,
    requestSubmitted,
    isRequesting,
    handleRequestSubmit,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    formError,
    resetData,
    isConfirming,
    handleConfirmSubmit,
  } = usePasswordReset();

  const meetsLength = password.length >= 8;
  const meetsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const backToLogin = (
    <button
      type="button"
      onClick={() => navigate("/login")}
      className="mt-7 flex w-full items-center justify-center gap-2 border-t border-ethereal-incense/10 pt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-ethereal-graphite/55 transition-colors hover:text-ethereal-gold"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      {t("auth.reset.back_to_login", "Powrót do logowania")}
    </button>
  );

  const errorBanner = (message: string) => (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-ethereal-crimson/20 bg-ethereal-crimson/5 p-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-0.5 h-5 w-5 shrink-0 text-ethereal-crimson"
          aria-hidden="true"
        />
        <Text size="sm" color="crimson" className="leading-6">
          {t(message, message)}
        </Text>
      </div>
    </motion.div>
  );

  const renderBody = () => {
    /* ── Confirm: set a new password ─────────────────────────────── */
    if (mode === "confirm") {
      if (resetData) {
        return (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-ethereal-sage/15"
            >
              <CheckCircle2 className="h-7 w-7 text-ethereal-sage" aria-hidden="true" />
            </motion.div>
            <Eyebrow color="sage" as="p" className="mb-2">
              {t("auth.reset.success_eyebrow", "Gotowe")}
            </Eyebrow>
            <Heading as="h1" size="2xl" color="default">
              {t("auth.reset.success_title", "Hasło zostało zmienione")}
            </Heading>
            <Text size="sm" color="graphite" className="mx-auto mt-3 max-w-sm leading-7">
              {t(
                "auth.reset.success_desc",
                "Twoje nowe hasło jest aktywne. Zaloguj się, aby wejść do panelu.",
              )}
            </Text>
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              className="mt-7"
              onClick={() => navigate("/login")}
            >
              {t("auth.reset.go_to_login", "Przejdź do logowania")}
            </Button>
          </div>
        );
      }

      return (
        <>
          <Eyebrow color="incense-muted" as="p" className="mb-1.5">
            {t("auth.reset.confirm_eyebrow", "Nowe hasło")}
          </Eyebrow>
          <Heading as="h1" size="2xl" color="default">
            {t("auth.reset.confirm_title", "Ustaw nowe hasło")}
          </Heading>
          <Text size="sm" color="graphite" className="mt-3 leading-7">
            {t(
              "auth.reset.confirm_description",
              "Wybierz nowe, bezpieczne hasło do swojego konta.",
            )}
          </Text>

          <form className="mt-7 space-y-5" onSubmit={handleConfirmSubmit}>
            <div className="space-y-1">
              <PasswordInput
                id="new-password"
                name="new-password"
                label={t("auth.reset.new_password", "Nowe hasło")}
                autoComplete="new-password"
                required
                disabled={isConfirming}
                value={password}
                onChange={setPassword}
                placeholder={t(
                  "auth.reset.new_password_placeholder",
                  "Utwórz bezpieczne hasło",
                )}
              />
              <PasswordStrengthMeter password={password} />
            </div>

            <PasswordInput
              id="confirm-password"
              name="confirm-password"
              label={t("auth.reset.confirm_password", "Potwierdź hasło")}
              autoComplete="new-password"
              required
              disabled={isConfirming}
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder={t("auth.reset.confirm_password_placeholder", "Powtórz hasło")}
            />

            <PasswordRequirements
              password={password}
              confirmPassword={confirmPassword}
            />

            <div aria-live="polite">{formError && errorBanner(formError)}</div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isConfirming}
              disabled={isConfirming || !meetsLength || !meetsMatch}
            >
              {isConfirming
                ? t("auth.reset.submitting_confirm", "Zapisywanie…")
                : t("auth.reset.submit_confirm", "Ustaw nowe hasło")}
            </Button>
          </form>

          {backToLogin}
        </>
      );
    }

    /* ── Request: ask for the reset link ─────────────────────────── */
    if (requestSubmitted) {
      return (
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-ethereal-gold/15"
          >
            <MailCheck className="h-7 w-7 text-ethereal-gold" aria-hidden="true" />
          </motion.div>
          <Eyebrow color="incense-muted" as="p" className="mb-2">
            {t("auth.reset.sent_eyebrow", "Link wysłany")}
          </Eyebrow>
          <Heading as="h1" size="2xl" color="default">
            {t("auth.reset.sent_title", "Sprawdź skrzynkę")}
          </Heading>
          <Text size="sm" color="graphite" className="mx-auto mt-3 max-w-sm leading-7">
            {t(
              "auth.reset.sent_desc",
              "Jeśli konto powiązane z tym adresem istnieje, wysłaliśmy na nie link do zresetowania hasła. Sprawdź też folder ze spamem.",
            )}
          </Text>
          {backToLogin}
        </div>
      );
    }

    return (
      <>
        <Eyebrow color="incense-muted" as="p" className="mb-1.5">
          {t("auth.reset.request_eyebrow", "Odzyskiwanie dostępu")}
        </Eyebrow>
        <Heading as="h1" size="2xl" color="default">
          {t("auth.reset.request_title", "Zresetuj hasło")}
        </Heading>
        <Text size="sm" color="graphite" className="mt-3 leading-7">
          {t(
            "auth.reset.request_description",
            "Podaj adres e-mail powiązany z kontem. Jeśli istnieje, wyślemy link do ustawienia nowego hasła.",
          )}
        </Text>

        <form className="mt-7 space-y-5" onSubmit={handleRequestSubmit} noValidate>
          <Input
            id="reset-email"
            name="email"
            type="email"
            label={t("auth.login.email_label")}
            autoComplete="email"
            required
            disabled={isRequesting}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.login.email_placeholder")}
            leftIcon={<Mail className="h-4 w-4" />}
          />

          <div aria-live="polite">{requestError && errorBanner(requestError)}</div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isRequesting}
            disabled={isRequesting || !email}
          >
            {isRequesting
              ? t("auth.reset.submitting_request", "Wysyłanie…")
              : t("auth.reset.submit_request", "Wyślij link resetujący")}
          </Button>
        </form>

        {backToLogin}
      </>
    );
  };

  return (
    <AuthShell backLabel={t("auth.login.back_to_lobby")}>
      <div className="w-full max-w-[26rem]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE.buttery }}
          className="mb-9 flex flex-col items-center"
        >
          <AuthBrand tagline={t("auth.login.subtitle")} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: EASE.buttery }}
        >
          <GlassCard
            variant="ethereal"
            padding="lg"
            glow
            isHoverable={false}
            className={CARD_SHADOW}
          >
            {renderBody()}
          </GlassCard>
        </motion.div>
      </div>
    </AuthShell>
  );
}
