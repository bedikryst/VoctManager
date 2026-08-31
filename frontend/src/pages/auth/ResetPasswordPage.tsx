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
import { ArrowLeft, CheckCircle2, Mail, MailCheck } from "lucide-react";

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
import { AuthAlert } from "@features/auth/components/AuthAlert";
import { AuthOutcome } from "@features/auth/components/AuthOutcome";
import { PasswordRequirements } from "@features/auth/components/PasswordRequirements";

const CARD_SHADOW =
  "shadow-[inset_0_1px_1px_var(--glass-highlight),0_2px_6px_-2px_var(--glass-contact),0_30px_64px_-22px_var(--glass-shade-strong)]";

export default function ResetPasswordPage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    mode,
    email,
    setEmail,
    emailError,
    requestError,
    requestSubmitted,
    isRequesting,
    handleRequestSubmit,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    passwordError,
    confirmError,
    formError,
    resetData,
    isConfirming,
    handleConfirmSubmit,
  } = usePasswordReset();

  const backToLogin = (
    <button
      type="button"
      onClick={() => navigate("/login")}
      className="group mt-7 flex w-full items-center justify-center gap-2 border-t border-hairline pt-5 text-ethereal-graphite/70 transition-colors hover:text-ethereal-gold"
    >
      <ArrowLeft
        className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
        aria-hidden="true"
      />
      <Eyebrow color="inherit">{t("auth.reset.back_to_login")}</Eyebrow>
    </button>
  );

  const renderBody = () => {
    /* ── Confirm: set a new password ─────────────────────────────── */
    if (mode === "confirm") {
      if (resetData) {
        return (
          <AuthOutcome
            tone="success"
            icon={<CheckCircle2 className="h-7 w-7" />}
            eyebrow={t("auth.reset.success_eyebrow")}
            title={t("auth.reset.success_title")}
            description={t("auth.reset.success_desc")}
            actions={
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => navigate("/login")}
              >
                {t("auth.reset.go_to_login")}
              </Button>
            }
          />
        );
      }

      return (
        <>
          <Eyebrow color="incense-muted" as="p" className="mb-1.5">
            {t("auth.reset.confirm_eyebrow")}
          </Eyebrow>
          <Heading as="h1" size="2xl" color="default">
            {t("auth.reset.confirm_title")}
          </Heading>
          <Text size="sm" color="graphite" className="mt-3 leading-7">
            {t("auth.reset.confirm_description")}
          </Text>

          <form className="mt-7 space-y-5" onSubmit={handleConfirmSubmit} noValidate>
            <div className="space-y-1">
              <PasswordInput
                id="new-password"
                name="new-password"
                label={t("auth.reset.new_password")}
                autoComplete="new-password"
                required
                disabled={isConfirming}
                value={password}
                onChange={setPassword}
                placeholder={t("auth.reset.new_password_placeholder")}
                error={
                  passwordError ? t(passwordError, passwordError) : undefined
                }
              />
              <PasswordStrengthMeter password={password} />
            </div>

            <PasswordInput
              id="confirm-password"
              name="confirm-password"
              label={t("auth.reset.confirm_password")}
              autoComplete="new-password"
              required
              disabled={isConfirming}
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder={t("auth.reset.confirm_password_placeholder")}
              error={confirmError ? t(confirmError) : undefined}
            />

            <PasswordRequirements
              password={password}
              confirmPassword={confirmPassword}
            />

            <AuthAlert message={formError ? t(formError, formError) : null} />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isConfirming}
            >
              {isConfirming
                ? t("auth.reset.submitting_confirm")
                : t("auth.reset.submit_confirm")}
            </Button>
          </form>

          {backToLogin}
        </>
      );
    }

    /* ── Request: ask for the reset link ─────────────────────────── */
    if (requestSubmitted) {
      return (
        <>
          <AuthOutcome
            tone="info"
            icon={<MailCheck className="h-7 w-7" />}
            eyebrow={t("auth.reset.sent_eyebrow")}
            title={t("auth.reset.sent_title")}
            description={t("auth.reset.sent_desc")}
          />
          {backToLogin}
        </>
      );
    }

    return (
      <>
        <Eyebrow color="incense-muted" as="p" className="mb-1.5">
          {t("auth.reset.request_eyebrow")}
        </Eyebrow>
        <Heading as="h1" size="2xl" color="default">
          {t("auth.reset.request_title")}
        </Heading>
        <Text size="sm" color="graphite" className="mt-3 leading-7">
          {t("auth.reset.request_description")}
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
            error={emailError ? t(emailError) : undefined}
          />

          <AuthAlert message={requestError ? t(requestError, requestError) : null} />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isRequesting}
          >
            {isRequesting
              ? t("auth.reset.submitting_request")
              : t("auth.reset.submit_request")}
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
