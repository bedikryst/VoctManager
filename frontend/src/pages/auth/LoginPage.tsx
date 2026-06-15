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
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { AlertCircle, KeyRound, LifeBuoy, Mail } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { PasswordInput } from "@/shared/ui/primitives/PasswordInput";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";
import { EASE } from "@/shared/ui/kinematics/motion-presets";
import { AuthShell } from "@features/auth/components/AuthShell";
import { AuthBrand } from "@features/auth/components/AuthBrand";
import { LegalModal } from "@features/auth/components/LegalModals";

export default function LoginPage(): React.JSX.Element {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);

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

  const supportEmail = t("auth.legal.privacy.contact_email");

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await login(email, password);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || t("auth.login.error_default"));
      setIsSubmitting(false);
    }
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
              {t("auth.login.welcome", "Witaj ponownie")}
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
              />

              <div aria-live="polite">
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-start gap-3 rounded-2xl border border-ethereal-crimson/20 bg-ethereal-crimson/5 p-4">
                        <AlertCircle
                          className="mt-0.5 h-5 w-5 shrink-0 text-ethereal-crimson"
                          aria-hidden="true"
                        />
                        <Text size="sm" color="crimson" className="leading-6">
                          {error}
                        </Text>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  size="lg"
                  isLoading={isSubmitting}
                  disabled={!email || !password || isSubmitting}
                >
                  {isSubmitting
                    ? t("auth.login.submitting")
                    : t("auth.login.submit_button")}
                </Button>
              </div>
            </form>

            {/* Access recovery — accounts are provisioned by the board, so there
                is no self-service reset; we point members to the right humans. */}
            <div className="mt-7 border-t border-ethereal-incense/10 pt-5">
              <button
                type="button"
                onClick={() => setHelpOpen((open) => !open)}
                aria-expanded={helpOpen}
                className="flex w-full items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-ethereal-graphite/55 transition-colors hover:text-ethereal-gold"
              >
                <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
                {t("auth.login.access_trouble", "Problem z dostępem do konta?")}
              </button>

              <AnimatePresence>
                {helpOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease: EASE.buttery }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 space-y-3 rounded-2xl border border-ethereal-incense/15 bg-white/40 p-4">
                      <Link
                        to="/reset-password"
                        className="flex items-center justify-center gap-2 rounded-xl border border-ethereal-gold/30 bg-ethereal-gold/10 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ethereal-graphite transition-colors hover:bg-ethereal-gold/20 hover:text-ethereal-ink"
                      >
                        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("auth.login.access_reset_cta", "Zresetuj hasło")}
                      </Link>
                      <Text size="sm" color="graphite" className="leading-6">
                        {t("auth.login.access_help", {
                          defaultValue:
                            "Nie masz jeszcze dostępu? Konta w VoctManagerze zakłada zarząd zespołu — napisz na {{email}}, a pomożemy Ci wejść do panelu.",
                          email: supportEmail,
                        })}
                      </Text>
                      <a
                        href={`mailto:${supportEmail}`}
                        className="inline-flex items-center gap-2 text-xs font-medium text-ethereal-gold underline decoration-ethereal-gold/40 underline-offset-4 transition-colors hover:text-ethereal-ink"
                      >
                        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("auth.login.access_contact_cta", "Napisz do zarządu")}
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-5 flex flex-col items-center gap-2.5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => handleOpenLegalModal("terms", e)}
                    className="text-[10px] font-medium uppercase tracking-widest text-ethereal-graphite/55 transition-colors hover:text-ethereal-gold"
                  >
                    {t("auth.login.terms_link")}
                  </button>
                  <span
                    className="text-[10px] text-ethereal-graphite/25"
                    aria-hidden="true"
                  >
                    •
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleOpenLegalModal("privacy", e)}
                    className="text-[10px] font-medium uppercase tracking-widest text-ethereal-graphite/55 transition-colors hover:text-ethereal-gold"
                  >
                    {t("auth.login.privacy_link")}
                  </button>
                </div>
                <Eyebrow color="muted" className="text-[9px] opacity-45">
                  {t("auth.login.footer_security")}
                </Eyebrow>
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
