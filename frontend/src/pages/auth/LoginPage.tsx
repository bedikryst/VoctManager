/**
 * @file LoginPage.tsx
 * @description Authentication threshold for the VoctManager panel. A single
 * elevated card on the shared Nave-of-Light field — the calm "return" gesture
 * for members already inside the ensemble. Built entirely on Ethereal
 * primitives (no raw inputs) and the shared AuthShell so it reads as one
 * vestibule with the activation screen.
 * @architecture Enterprise SaaS 2026
 * @module pages/auth/LoginPage
 */

import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { PasswordInput } from "@/shared/ui/primitives/PasswordInput";
import { Heading, Text } from "@/shared/ui/primitives/typography";
import { EASE } from "@/shared/ui/kinematics/motion-presets";
import { AuthShell } from "@features/auth/components/AuthShell";
import { AuthBrand } from "@features/auth/components/AuthBrand";
import { AuthAlert } from "@features/auth/components/AuthAlert";
import { LegalModal } from "@features/auth/components/LegalModals";

export default function LoginPage(): React.JSX.Element {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [legalModalState, setLegalModalState] = useState<{
    isOpen: boolean;
    type: "privacy" | "terms";
  }>({ isOpen: false, type: "privacy" });

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    "/panel";

  const supportEmail = t("auth.login.support_email");

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();

    // The submit stays live on an empty form and answers with the reason —
    // a gold full-width control that does nothing is the hierarchy inverted,
    // and a disabled button never says which field it is waiting for.
    const missingEmail = email.trim().length === 0;
    const missingPassword = password.length === 0;
    setEmailError(missingEmail ? t("auth.login.errors.email_required") : null);
    setPasswordError(
      missingPassword ? t("auth.login.errors.password_required") : null,
    );
    setSignInError(null);
    if (missingEmail || missingPassword) return;

    setIsSubmitting(true);
    const result = await login(email, password);

    if (result.success) {
      navigate(from, { replace: true });
      return;
    }

    // The server cannot say which half was wrong without disclosing which
    // accounts exist, so both fields carry the tint and the banner carries the
    // one sentence — `hasError` exists for exactly this shape.
    setSignInError(t(result.errorKey ?? "auth.login.errors.unexpected"));
    setIsSubmitting(false);
  };

  const handleOpenLegalModal = (
    type: "privacy" | "terms",
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    setLegalModalState({ isOpen: true, type });
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
            className="shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_2px_6px_-2px_rgba(22,20,18,0.08),0_30px_64px_-22px_rgba(120,104,82,0.5)]"
          >
            <Heading as="h1" size="2xl" color="default" className="mb-7">
              {t("auth.login.welcome")}
            </Heading>

            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <Input
                id="email"
                name="email"
                type="email"
                label={t("auth.login.email_label")}
                autoComplete="email"
                required
                disabled={isSubmitting}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.login.email_placeholder")}
                leftIcon={<Mail className="h-4 w-4" />}
                error={emailError ?? undefined}
                hasError={Boolean(signInError)}
              />

              <PasswordInput
                id="password"
                name="password"
                label={t("auth.login.password_label")}
                autoComplete="current-password"
                required
                disabled={isSubmitting}
                value={password}
                onChange={setPassword}
                placeholder={t("auth.login.password_placeholder")}
                capsLockHint
                error={passwordError ?? undefined}
                hasError={Boolean(signInError)}
              />

              <AuthAlert message={signInError} />

              <div className="pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  size="lg"
                  isLoading={isSubmitting}
                >
                  {isSubmitting
                    ? t("auth.login.submitting")
                    : t("auth.login.submit_button")}
                </Button>
              </div>
            </form>

            {/* The two ways in that are not this form, told apart: a member who
                has a password but forgot it, and a singer who has no account at
                all. They used to share one accordion, one question and three
                competing controls. */}
            {/* Three ranks under the submit, and they must stay three: a real
                action at the card's body size, the one sentence for someone
                with no account a step below it, and the legal pair quieter
                again. All three sat at 10–12px, which put the fine print level
                with the action it is not. */}
            <div className="mt-5 text-center">
              <Link
                to="/reset-password"
                className="text-ethereal-graphite underline decoration-ethereal-incense/40 underline-offset-4 transition-colors hover:text-ethereal-gold"
              >
                <Text as="span" size="base" color="inherit">
                  {t("auth.login.forgot_password")}
                </Text>
              </Link>
            </div>

            <div className="mt-6 space-y-3 border-t border-hairline pt-5 text-center">
              <Text size="sm" color="graphite">
                {t("auth.login.no_account")}{" "}
                <a
                  href={`mailto:${supportEmail}`}
                  className="font-medium text-ethereal-gold underline decoration-ethereal-gold/40 underline-offset-4 transition-colors hover:text-ethereal-ink"
                >
                  {supportEmail}
                </a>
              </Text>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={(e) => handleOpenLegalModal("terms", e)}
                  className="text-ethereal-graphite/60 underline decoration-ethereal-incense/40 underline-offset-4 transition-colors hover:text-ethereal-gold"
                >
                  <Text as="span" size="sm" color="inherit">
                    {t("auth.login.terms_link")}
                  </Text>
                </button>
                <Text
                  as="span"
                  size="sm"
                  color="inherit"
                  className="text-ethereal-graphite/25"
                  aria-hidden="true"
                >
                  •
                </Text>
                <button
                  type="button"
                  onClick={(e) => handleOpenLegalModal("privacy", e)}
                  className="text-ethereal-graphite/60 underline decoration-ethereal-incense/40 underline-offset-4 transition-colors hover:text-ethereal-gold"
                >
                  <Text as="span" size="sm" color="inherit">
                    {t("auth.login.privacy_link")}
                  </Text>
                </button>
              </div>
            </div>
          </GlassCard>
        </motion.div>
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
