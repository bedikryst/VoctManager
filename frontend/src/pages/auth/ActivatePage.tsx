/**
 * @file ActivatePage.tsx
 * @description The invited member's first crossing into VoctManager. Where the
 * login is a quick "return", activation is a welcome — so it earns more
 * ceremony: a dark Nave rail introducing the ensemble on the left, and a
 * coaching-rich password setup on the right (live strength + requirement read).
 * Business logic stays fully in `useAccountActivation`.
 * @architecture Enterprise SaaS 2026
 * @module pages/auth/ActivatePage
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Volume2,
} from "lucide-react";

import { useAccountActivation } from "@features/auth/hooks/useAccountActivation";
import { useWelcomeTone } from "@/shared/ui/instruments/useWelcomeTone";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { PasswordInput } from "@/shared/ui/primitives/PasswordInput";
import { PasswordStrengthMeter } from "@/shared/ui/composites/PasswordStrengthMeter";
import { Heading } from "@/shared/ui/primitives/typography/Heading";
import { Text } from "@/shared/ui/primitives/typography/Text";
import { Eyebrow } from "@/shared/ui/primitives/typography/Eyebrow";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { EASE } from "@/shared/ui/kinematics/motion-presets";
import { AuthShell } from "@features/auth/components/AuthShell";
import { AuthBrand } from "@features/auth/components/AuthBrand";
import { AuthAlert } from "@features/auth/components/AuthAlert";
import { AuthOutcome } from "@features/auth/components/AuthOutcome";
import { LegalModal } from "@features/auth/components/LegalModals";
import { PasswordRequirements } from "@features/auth/components/PasswordRequirements";
import { cn } from "@/shared/lib/utils";

export default function ActivatePage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState<boolean>(false);
  const [legalModalState, setLegalModalState] = useState<{
    isOpen: boolean;
    type: "privacy" | "terms";
  }>({ isOpen: false, type: "terms" });

  const {
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    termsAccepted,
    setTermsAccepted,
    passwordError,
    confirmError,
    termsError,
    formError,
    activatedData,
    isSubmitting,
    inviteeName,
    linkStatus,
    handleSubmit,
  } = useAccountActivation();

  const { toggle: toggleWelcomeTone, isPlaying: tonePlaying } = useWelcomeTone();

  const activationHighlights = [
    {
      title: t("auth.activate.features.security.title"),
      description: t("auth.activate.features.security.desc"),
      icon: ShieldCheck,
    },
    {
      title: t("auth.activate.features.access.title"),
      description: t("auth.activate.features.access.desc"),
      icon: KeyRound,
    },
    {
      title: t("auth.activate.features.workspace.title"),
      description: t("auth.activate.features.workspace.desc"),
      icon: Sparkles,
    },
  ];

  const handleOpenLegalModal = (
    type: "privacy" | "terms",
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    setLegalModalState({ isOpen: true, type });
  };

  const handleCopyLogin = async () => {
    if (!activatedData) return;
    try {
      await navigator.clipboard.writeText(activatedData.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard unavailable — the login stays visible to copy by hand. */
    }
  };

  // Until the signed link answers we do not know whose invitation this is, so
  // the page says nothing rather than greeting a stranger and then correcting
  // itself — the headline here IS the personal greeting.
  if (linkStatus === "checking") {
    return (
      <AuthShell backLabel={t("auth.activate.back_to_home")}>
        <EtherealLoader
          fullHeight={false}
          message={t("auth.activate.checking_link")}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell backLabel={t("auth.activate.back_to_home")}>
      <div className="w-full max-w-5xl">
        {/* Compact crown for small screens — the dark rail is desktop-only. */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE.buttery }}
          className="mb-8 flex flex-col items-center text-center lg:hidden"
        >
          <AuthBrand size="lg" />
          <Eyebrow color="incense-muted" as="p" className="mt-5">
            {t("auth.activate.badge")}
          </Eyebrow>
          <Heading as="h1" size="4xl" color="default" className="mt-2 leading-tight">
            {inviteeName ? (
              <>
                {t("auth.activate.greeting_word")},{" "}
                <span className="italic text-ethereal-gold">{inviteeName}</span>
              </>
            ) : (
              <>
                {t("auth.activate.title_1")}{" "}
                <span className="italic text-ethereal-gold">
                  {t("auth.activate.title_2")}
                </span>
              </>
            )}
          </Heading>
        </motion.div>

        <div className="grid w-full items-stretch gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          {/* ── Left: the Nave rail (desktop) — welcome the new member ── */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE.buttery }}
            className="hidden lg:block"
          >
            <GlassCard
              variant="dark"
              padding="lg"
              isHoverable={false}
              className="h-full"
            >
              <AuthBrand tone="marble" align="left" size="lg" className="mb-8" />

              <Eyebrow color="parchment-muted" as="p" className="mb-3">
                {t("auth.activate.badge")}
              </Eyebrow>
              <Heading as="h1" size="5xl" color="marble" className="leading-none">
                {inviteeName ? (
                  <>
                    {t("auth.activate.greeting_word")},
                    <span className="ml-2 italic text-ethereal-gold">
                      {inviteeName}
                    </span>
                  </>
                ) : (
                  <>
                    {t("auth.activate.title_1")}
                    <span className="ml-2 italic text-ethereal-gold">
                      {t("auth.activate.title_2")}
                    </span>
                  </>
                )}
              </Heading>
              <Text
                size="base"
                color="parchment-muted"
                className="mt-5 max-w-lg leading-7"
              >
                {t("auth.activate.description")}
              </Text>

              <Eyebrow color="parchment-muted" as="p" className="mt-9 mb-4">
                {t("auth.activate.features_title")}
              </Eyebrow>
              <div className="grid gap-3">
                {activationHighlights.map(
                  ({ title, description, icon: Icon }) => (
                    <div
                      key={title}
                      className="rounded-nested border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 shrink-0 rounded-control bg-ethereal-gold/15 p-2.5">
                          <Icon
                            className="h-5 w-5 text-ethereal-gold"
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <Eyebrow color="marble" as="p">
                            {title}
                          </Eyebrow>
                          <Text
                            size="sm"
                            color="parchment-muted"
                            className="mt-1.5 leading-6"
                          >
                            {description}
                          </Text>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </GlassCard>
          </motion.div>

          {/* ── Right: the act — set the password, or the welcome ── */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE.buttery }}
          >
            <GlassCard
              variant="ethereal"
              padding="lg"
              glow
              isHoverable={false}
              className="relative h-full"
            >
              <div
                className="absolute inset-x-0 -top-6 h-px bg-linear-to-r from-transparent via-ethereal-gold/60 to-transparent"
                aria-hidden="true"
              />

              {linkStatus !== "ok" ? (
                <AuthOutcome
                  tone="alert"
                  icon={<AlertCircle className="h-7 w-7" />}
                  eyebrow={t("auth.activate.invalid.eyebrow")}
                  headingAs="h2"
                  title={
                    linkStatus === "expired"
                      ? t("auth.activate.invalid.expired_title")
                      : t("auth.activate.invalid.invalid_title")
                  }
                  description={
                    linkStatus === "expired"
                      ? t("auth.activate.invalid.expired_desc")
                      : t("auth.activate.invalid.invalid_desc")
                  }
                  actions={
                    <>
                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        className="flex-1"
                        onClick={() => navigate("/")}
                      >
                        {t("auth.activate.invalid.cta_home")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="flex-1"
                        onClick={() => navigate("/login")}
                      >
                        {t("auth.activate.invalid.cta_login")}
                      </Button>
                    </>
                  }
                />
              ) : !activatedData ? (
                <>
                  <div className="mb-7">
                    <Eyebrow color="incense-muted" as="p" className="mb-3">
                      {t("auth.activate.form.subtitle")}
                    </Eyebrow>
                    <Heading as="h2" size="4xl" color="default">
                      {t("auth.activate.form.title")}
                    </Heading>
                    <Text
                      size="sm"
                      color="graphite"
                      className="mt-3 max-w-lg leading-7"
                    >
                      {t("auth.activate.form.description")}
                    </Text>
                  </div>

                  <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                    <div className="space-y-1">
                      <PasswordInput
                        id="new-password"
                        name="new-password"
                        label={t("auth.activate.form.new_password")}
                        autoComplete="new-password"
                        required
                        disabled={isSubmitting}
                        value={password}
                        onChange={setPassword}
                        placeholder={t(
                          "auth.activate.form.new_password_placeholder",
                        )}
                        error={
                          passwordError ? t(passwordError, passwordError) : undefined
                        }
                      />
                      <PasswordStrengthMeter password={password} />
                    </div>

                    <PasswordInput
                      id="confirm-password"
                      name="confirm-password"
                      label={t("auth.activate.form.confirm_password")}
                      autoComplete="new-password"
                      required
                      disabled={isSubmitting}
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder={t(
                        "auth.activate.form.confirm_password_placeholder",
                      )}
                      error={confirmError ? t(confirmError) : undefined}
                    />

                    {/* The rule the form enforces, stated once and in one place:
                        a live checklist, not a static "security standard" box
                        repeating the same 8 characters two elements above. */}
                    <PasswordRequirements
                      password={password}
                      confirmPassword={confirmPassword}
                    />

                    <div>
                      <label
                        htmlFor="terms-accepted"
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-nested border bg-white/30 p-4 transition-colors hover:bg-white/50",
                          termsError
                            ? "border-ethereal-crimson/40"
                            : "border-hairline-strong",
                        )}
                      >
                        <Checkbox
                          id="terms-accepted"
                          className="mt-0.5"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          disabled={isSubmitting}
                          aria-invalid={Boolean(termsError)}
                        />
                        <Text
                          size="sm"
                          color="graphite"
                          className="select-none leading-6"
                        >
                          {t("auth.activate.form.terms_prefix")}{" "}
                          <button
                            type="button"
                            onClick={(e) => handleOpenLegalModal("terms", e)}
                            className="font-medium text-ethereal-gold underline underline-offset-4 transition-colors hover:text-ethereal-ink"
                          >
                            {t("auth.activate.form.terms_link")}
                          </button>
                          {t("auth.activate.form.terms_and")}
                          <button
                            type="button"
                            onClick={(e) => handleOpenLegalModal("privacy", e)}
                            className="font-medium text-ethereal-gold underline underline-offset-4 transition-colors hover:text-ethereal-ink"
                          >
                            {t("auth.activate.form.privacy_link")}
                          </button>
                        </Text>
                      </label>
                      {termsError && (
                        <Text
                          as="span"
                          role="alert"
                          size="xs"
                          color="crimson"
                          className="ml-1 mt-1.5 block font-medium"
                        >
                          {t(termsError)}
                        </Text>
                      )}
                    </div>

                    <AuthAlert
                      message={formError ? t(formError, formError) : null}
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      fullWidth
                      isLoading={isSubmitting}
                    >
                      {isSubmitting
                        ? t("auth.activate.form.activating_btn")
                        : t("auth.activate.form.activate_btn")}
                    </Button>
                  </form>
                </>
              ) : (
                <AuthOutcome
                  tone="success"
                  icon={<CheckCircle2 className="h-7 w-7" />}
                  eyebrow={t("auth.activate.success.subtitle")}
                  headingAs="h2"
                  title={t("auth.activate.success.title")}
                  description={t("auth.activate.success.desc")}
                  actions={
                    <>
                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        className="flex-1"
                        onClick={() => navigate("/login")}
                      >
                        {t("auth.activate.success.go_to_login")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="flex-1"
                        onClick={() => navigate("/")}
                      >
                        {t("auth.activate.success.return_home")}
                      </Button>
                    </>
                  }
                >
                  {/* The kamerton — the honest A every rehearsal starts from,
                      offered the moment the new member crosses in. Tap to ring,
                      tap again to silence. */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "mx-auto mt-5",
                      tonePlaying &&
                        "border-ethereal-gold/60 bg-ethereal-gold/10 text-ethereal-ink",
                    )}
                    onClick={toggleWelcomeTone}
                    aria-pressed={tonePlaying}
                    leftIcon={
                      <Volume2
                        size={16}
                        strokeWidth={2}
                        className={cn(
                          "shrink-0",
                          tonePlaying
                            ? "animate-pulse text-ethereal-gold"
                            : "text-ethereal-gold/80",
                        )}
                      />
                    }
                  >
                    {tonePlaying
                      ? t("auth.activate.success.tone_playing")
                      : t("auth.activate.success.tone_cta")}
                  </Button>

                  {/* The credential — the one fact the member has to keep. */}
                  <div className="mt-6 rounded-nested border border-hairline-strong bg-white/70 p-4 text-left shadow-glass-solid">
                    <Eyebrow color="muted" as="p" className="mb-2.5">
                      {t("auth.activate.success.your_username")}
                    </Eyebrow>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Text
                        size="md"
                        weight="medium"
                        color="gold"
                        className="min-w-0 truncate"
                      >
                        {activatedData.email}
                      </Text>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={handleCopyLogin}
                        leftIcon={
                          copied ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )
                        }
                      >
                        {copied
                          ? t("auth.activate.success.copied")
                          : t("auth.activate.success.copy_login")}
                      </Button>
                    </div>
                  </div>
                </AuthOutcome>
              )}
            </GlassCard>
          </motion.div>
        </div>
      </div>

      <LegalModal
        isOpen={legalModalState.isOpen}
        onClose={() =>
          setLegalModalState({ ...legalModalState, isOpen: false })
        }
        type={legalModalState.type}
      />
    </AuthShell>
  );
}
