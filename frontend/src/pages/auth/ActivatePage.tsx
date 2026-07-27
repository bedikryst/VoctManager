/**
 * @file ActivatePage.tsx
 * @description The invited member's first crossing into VoctManager, and the
 * first screen they ever see. Where the login is a quick "return", activation is
 * a welcome, so it earns a wider composition — but only while there is something
 * to activate.
 *
 * The chassis follows the state instead of surviving it. A live invitation is
 * two columns: the nave rail says who is being welcomed and names the login they
 * are about to secure, the card holds the single act. A dead link and a finished
 * activation are both one centred card on the same field — the shape of the
 * login screen they are about to meet — because a rail listing what waits inside
 * has nothing to say beside a door that is closed, or one already walked
 * through. Business logic stays fully in `useAccountActivation`.
 * @architecture Enterprise SaaS 2026
 * @module pages/auth/ActivatePage
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Check, CheckCircle2, Copy, Volume2 } from "lucide-react";

import { useAccountActivation } from "@features/auth/hooks/useAccountActivation";
import { useWelcomeTone } from "@/shared/ui/instruments/useWelcomeTone";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { PasswordInput } from "@/shared/ui/primitives/PasswordInput";
import { PasswordStrengthMeter } from "@/shared/ui/composites/PasswordStrengthMeter";
import { Heading } from "@/shared/ui/primitives/typography/Heading";
import { Text } from "@/shared/ui/primitives/typography/Text";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { EASE } from "@/shared/ui/kinematics/motion-presets";
import { AuthShell } from "@features/auth/components/AuthShell";
import { AuthBrand } from "@features/auth/components/AuthBrand";
import { AuthAlert } from "@features/auth/components/AuthAlert";
import { AuthOutcome } from "@features/auth/components/AuthOutcome";
import { AuthCredential } from "@features/auth/components/AuthCredential";
import { ActivationNave } from "@features/auth/components/ActivationNave";
import { ActivationLinkClosed } from "@features/auth/components/ActivationLinkClosed";
import { LegalModal } from "@features/auth/components/LegalModals";
import { PasswordRequirements } from "@features/auth/components/PasswordRequirements";
import { cn } from "@/shared/lib/utils";

/** The elevated warm float the login card sits on — the threshold's one shadow. */
const CARD_SHADOW =
  "shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_2px_6px_-2px_rgba(22,20,18,0.08),0_30px_64px_-22px_rgba(120,104,82,0.5)]";

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
    inviteeEmail,
    linkStatus,
    handleSubmit,
  } = useAccountActivation();

  const { toggle: toggleWelcomeTone, isPlaying: tonePlaying } = useWelcomeTone();

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

  /**
   * The single centred card: the crown, then one surface. Everything that is not
   * an invitation in progress is told in this shape, which is also the login
   * screen's — so the last thing a member sees here and the first thing they see
   * next are the same object.
   */
  const renderSolitary = (body: React.ReactNode): React.JSX.Element => (
    <div className="w-full max-w-[26rem]">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE.buttery }}
        className="mb-9 flex flex-col items-center"
      >
        <AuthBrand tagline={t("auth.activate.subtitle")} />
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
          {body}
        </GlassCard>
      </motion.div>
    </div>
  );

  // Until the signed link answers we do not know whose invitation this is, so
  // the page says nothing rather than greeting a stranger and then correcting
  // itself — the rail's headline IS the personal greeting.
  if (linkStatus === "checking") {
    return (
      <AuthShell backLabel={t("auth.activate.back_to_home")}>
        {renderSolitary(
          <EtherealLoader
            fullHeight={false}
            message={t("auth.activate.checking_link")}
          />,
        )}
      </AuthShell>
    );
  }

  if (linkStatus !== "ok") {
    return (
      <AuthShell backLabel={t("auth.activate.back_to_home")}>
        {renderSolitary(<ActivationLinkClosed status={linkStatus} />)}
      </AuthShell>
    );
  }

  if (activatedData) {
    return (
      <AuthShell backLabel={t("auth.activate.back_to_home")}>
        {renderSolitary(
          <AuthOutcome
            tone="success"
            icon={<CheckCircle2 className="h-6 w-6" strokeWidth={1.6} />}
            eyebrow={t("auth.activate.success.subtitle")}
            title={t("auth.activate.success.title")}
            description={t("auth.activate.success.desc")}
            actions={
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => navigate("/login")}
              >
                {t("auth.activate.success.go_to_login")}
              </Button>
            }
          >
            {/* The kamerton — the honest A every rehearsal starts from, offered
                the moment the new member crosses in. Tap to ring, tap to
                silence. */}
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

            <AuthCredential
              className="mt-6"
              label={t("auth.activate.login_label")}
              email={activatedData.email}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
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
              }
            />
          </AuthOutcome>,
        )}
      </AuthShell>
    );
  }

  /* ── The invitation is live: the welcome and the one act, side by side ── */
  return (
    <AuthShell backLabel={t("auth.activate.back_to_home")}>
      <div className="w-full max-w-5xl">
        {/* The form column is pinned to the login card's own width so the two
            threshold screens are literally the same object; the rail takes
            whatever is left. `minmax(0,…)` is what keeps that a ratio — a bare
            `fr` floors at min-content, so the widest thing the form ever renders
            would annex the rail's share. */}
        <div className="grid w-full items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE.buttery }}
          >
            <ActivationNave
              inviteeName={inviteeName}
              inviteeEmail={inviteeEmail}
            />
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
              className={cn("h-full", CARD_SHADOW)}
            >
              {/* One heading, naming the act. The rail already said who is being
                  welcomed and why; an overline, a title and a lead paragraph all
                  restating "set a password" is the same instruction on four
                  voices, above a form that is two fields long. */}
              <Heading as="h2" size="2xl" color="default" className="mb-7">
                {t("auth.activate.form.title")}
              </Heading>

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
                    placeholder={t("auth.activate.form.new_password_placeholder")}
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

                {/* The rule the form enforces, stated once and from first paint:
                    a live checklist, not a static "security standard" box. */}
                <PasswordRequirements
                  password={password}
                  confirmPassword={confirmPassword}
                />

                {/* Consent is a different kind of thing from a credential, so a
                    rule separates them — not a second bordered tile stacked under
                    the checklist, which turned the foot of the card into two
                    competing plates. */}
                <div className="border-t border-hairline pt-5">
                  <label
                    htmlFor="terms-accepted"
                    className="flex cursor-pointer items-start gap-3"
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
                      size="xs"
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
                      className="mt-2 block font-medium"
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
