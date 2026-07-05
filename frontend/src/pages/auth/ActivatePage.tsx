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
import { PasswordInput } from "@/shared/ui/primitives/PasswordInput";
import { PasswordStrengthMeter } from "@/shared/ui/composites/PasswordStrengthMeter";
import { Heading } from "@/shared/ui/primitives/typography/Heading";
import { Text } from "@/shared/ui/primitives/typography/Text";
import { Eyebrow } from "@/shared/ui/primitives/typography/Eyebrow";
import { EASE } from "@/shared/ui/kinematics/motion-presets";
import { AuthShell } from "@features/auth/components/AuthShell";
import { AuthBrand } from "@features/auth/components/AuthBrand";
import { LegalModal } from "@features/auth/components/LegalModals";
import { PasswordRequirements } from "@features/auth/components/PasswordRequirements";
import { cn } from "@/shared/lib/utils";

export default function ActivatePage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
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
    formError,
    activatedData,
    isSubmitting,
    hasActivationParams,
    inviteeName,
    handleSubmit,
  } = useAccountActivation();

  const { toggle: toggleWelcomeTone, isPlaying: tonePlaying } = useWelcomeTone();

  const meetsLength = password.length >= 8;
  const meetsMatch = confirmPassword.length > 0 && password === confirmPassword;

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
                {t("auth.activate.greeting_word", "Witaj")},{" "}
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
                    {t("auth.activate.greeting_word", "Witaj")},
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
                {t("auth.activate.features_title", "Co czeka na Ciebie w środku")}
              </Eyebrow>
              <div className="grid gap-3">
                {activationHighlights.map(
                  ({ title, description, icon: Icon }) => (
                    <div
                      key={title}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 shrink-0 rounded-xl bg-ethereal-gold/15 p-2.5">
                          <Icon
                            className="h-5 w-5 text-ethereal-gold"
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <Text
                            size="xs"
                            weight="bold"
                            color="marble"
                            className="uppercase tracking-[0.18em]"
                          >
                            {title}
                          </Text>
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

              {!activatedData ? (
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

                  <div className="mb-6 rounded-2xl border border-ethereal-incense/20 bg-ethereal-incense/5 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck
                        className="mt-0.5 h-5 w-5 shrink-0 text-ethereal-gold"
                        aria-hidden="true"
                      />
                      <div>
                        <Text
                          size="xs"
                          weight="bold"
                          color="graphite"
                          className="uppercase tracking-[0.18em]"
                        >
                          {t("auth.activate.form.security_title")}
                        </Text>
                        <Text size="sm" color="graphite" className="mt-1.5 leading-6">
                          {t("auth.activate.form.security_desc")}
                        </Text>
                      </div>
                    </div>
                  </div>

                  {!hasActivationParams && (
                    <div className="mb-6 rounded-2xl border border-amber-200/70 bg-amber-50/80 p-4">
                      <Text size="sm" className="leading-6 text-amber-900">
                        {t("auth.activate.form.missing_params")}
                      </Text>
                    </div>
                  )}

                  <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-1">
                      <PasswordInput
                        id="new-password"
                        name="new-password"
                        label={t("auth.activate.form.new_password")}
                        autoComplete="new-password"
                        required
                        disabled={isSubmitting || !hasActivationParams}
                        value={password}
                        onChange={setPassword}
                        placeholder={t(
                          "auth.activate.form.new_password_placeholder",
                        )}
                      />
                      <PasswordStrengthMeter password={password} />
                    </div>

                    <PasswordInput
                      id="confirm-password"
                      name="confirm-password"
                      label={t("auth.activate.form.confirm_password")}
                      autoComplete="new-password"
                      required
                      disabled={isSubmitting || !hasActivationParams}
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder={t(
                        "auth.activate.form.confirm_password_placeholder",
                      )}
                    />

                    <PasswordRequirements
                      password={password}
                      confirmPassword={confirmPassword}
                    />

                    <label
                      htmlFor="terms-accepted"
                      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-ethereal-incense/15 bg-white/30 p-4 transition-colors hover:bg-white/50"
                    >
                      <div className="relative mt-0.5 shrink-0">
                        <input
                          type="checkbox"
                          id="terms-accepted"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          disabled={isSubmitting}
                          className="peer sr-only"
                        />
                        <div className="flex h-4 w-4 items-center justify-center rounded border border-ethereal-incense/40 bg-white/60 transition-all peer-checked:border-ethereal-gold peer-checked:bg-ethereal-gold">
                          <Check
                            className={cn(
                              "h-2.5 w-2.5 text-white transition-opacity duration-150",
                              termsAccepted ? "opacity-100" : "opacity-0",
                            )}
                            strokeWidth={3}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
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
                        </button>{" "}
                        &{" "}
                        <button
                          type="button"
                          onClick={(e) => handleOpenLegalModal("privacy", e)}
                          className="font-medium text-ethereal-gold underline underline-offset-4 transition-colors hover:text-ethereal-ink"
                        >
                          {t("auth.activate.form.privacy_link")}
                        </button>
                      </Text>
                    </label>

                    <div aria-live="polite">
                      {formError && (
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
                              {t(formError, formError)}
                            </Text>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      fullWidth
                      isLoading={isSubmitting}
                      disabled={
                        isSubmitting ||
                        !hasActivationParams ||
                        !termsAccepted ||
                        !meetsLength ||
                        !meetsMatch
                      }
                    >
                      {isSubmitting
                        ? t("auth.activate.form.activating_btn")
                        : t("auth.activate.form.activate_btn")}
                    </Button>
                  </form>
                </>
              ) : (
                <div className="flex h-full flex-col justify-center">
                  <div className="rounded-3xl border border-ethereal-sage/30 bg-ethereal-sage/5 p-5 sm:p-6">
                    {/* Header — the seal of success crowns the message: stacked
                        and centred on mobile, inline on larger screens. */}
                    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
                      <motion.div
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 320,
                          damping: 18,
                        }}
                        className="shrink-0 rounded-2xl bg-ethereal-sage/15 p-3"
                      >
                        <CheckCircle2
                          className="h-7 w-7 text-ethereal-sage"
                          aria-hidden="true"
                        />
                      </motion.div>
                      <div className="min-w-0">
                        <Eyebrow color="sage" as="p" className="mb-2">
                          {t("auth.activate.success.subtitle")}
                        </Eyebrow>
                        <Heading as="h2" size="3xl" color="default">
                          {t("auth.activate.success.title")}
                        </Heading>
                        <Text size="sm" color="graphite" className="mt-3 leading-7">
                          {t("auth.activate.success.desc")}
                        </Text>

                        {/* The kamerton — the honest A every rehearsal starts
                            from, offered the moment the new member crosses in.
                            Tap to ring, tap again to silence. */}
                        <button
                          type="button"
                          onClick={toggleWelcomeTone}
                          aria-pressed={tonePlaying}
                          aria-label={
                            tonePlaying
                              ? t("auth.activate.success.tone_stop", "Wycisz ton")
                              : t(
                                  "auth.activate.success.tone_cta",
                                  "Kamerton · ton A",
                                )
                          }
                          className={cn(
                            "group mt-4 inline-flex items-center gap-2.5 rounded-full border px-4 py-2 transition-colors",
                            tonePlaying
                              ? "border-ethereal-gold/60 bg-ethereal-gold/10"
                              : "border-ethereal-sage/30 bg-white/50 hover:border-ethereal-gold/45 hover:bg-ethereal-gold/[0.06]",
                          )}
                        >
                          <Volume2
                            size={16}
                            strokeWidth={2}
                            className={cn(
                              "shrink-0 transition-transform",
                              tonePlaying
                                ? "animate-pulse text-ethereal-gold"
                                : "text-ethereal-gold/80 group-hover:scale-110",
                            )}
                            aria-hidden="true"
                          />
                          <Eyebrow
                            color={tonePlaying ? "gold" : "incense-muted"}
                            as="span"
                            className="tracking-[0.16em]"
                          >
                            {tonePlaying
                              ? t("auth.activate.success.tone_playing", "Brzmi… wycisz")
                              : t(
                                  "auth.activate.success.tone_cta",
                                  "Kamerton · ton A",
                                )}
                          </Eyebrow>
                        </button>
                      </div>
                    </div>

                    {/* The credential — given the full width of the card so the
                        login and its copy action never crush on a narrow screen. */}
                    <div className="mt-6 rounded-2xl border border-ethereal-incense/20 bg-white/70 p-4 shadow-glass-solid">
                      <Text
                        size="xs"
                        weight="bold"
                        color="graphite"
                        className="mb-2.5 uppercase tracking-[0.2em]"
                      >
                        {t("auth.activate.success.your_username")}
                      </Text>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Text
                          size="md"
                          weight="bold"
                          color="gold"
                          className="min-w-0 truncate font-mono tracking-tight"
                        >
                          {activatedData.email}
                        </Text>
                        <button
                          type="button"
                          onClick={handleCopyLogin}
                          className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-ethereal-incense/20 bg-white/60 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ethereal-graphite transition-colors hover:border-ethereal-gold/50 hover:text-ethereal-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 sm:w-auto sm:py-2"
                        >
                          {copied ? (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {copied
                            ? t("auth.activate.success.copied", "Skopiowano")
                            : t(
                                "auth.activate.success.copy_login",
                                "Skopiuj login",
                              )}
                        </button>
                      </div>
                    </div>

                    <Text
                      size="xs"
                      color="graphite"
                      className="mt-4 leading-relaxed"
                    >
                      {t("auth.activate.success.instruction")}
                    </Text>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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
                  </div>
                </div>
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
