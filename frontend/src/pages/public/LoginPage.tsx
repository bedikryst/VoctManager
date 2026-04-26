/**
 * @file Login.tsx
 * @description Authentication gateway for the VoctManager Dashboard.
 * Refactored to fully embody Ethereal UI standards (Glassmorphism),
 * strictly adhere to the "NO-RAW-HTML" mandate, and utilize Kinematics.
 * @architecture Enterprise 2026 Standards
 * @module pages/Login
 * @author Krystian Bugalski & Ethereal UI System
 */

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { AlertCircle, ArrowLeft } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealBackground } from "@/shared/ui/kinematics/EtherealBackground";
import { VocalClefShadow } from "@/shared/ui/kinematics/VocalClefShadow";
import { LegalModal } from "@features/auth/components/LegalModals";

export default function Login(): React.JSX.Element {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [legalModalState, setLegalModalState] = useState<{
    isOpen: boolean;
    type: "privacy" | "terms";
  }>({ isOpen: false, type: "privacy" });

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => document.body.classList.remove("admin-mode");
  }, []);

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    "/panel";

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
      setError(
        result.error ||
          t("auth.login.error_default", "Autoryzacja nie powiodła się."),
      );
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
    <PageTransition>
      <div className="relative min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 overflow-hidden">
        <EtherealBackground />
        <div className="absolute top-0 right-0 opacity-10 pointer-events-none translate-x-1/4 -translate-y-1/4">
          <VocalClefShadow />
        </div>

        <div className="absolute top-8 left-8 z-20">
          <Link
            to="/"
            className="group flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <ArrowLeft
              className="w-4 h-4 text-ethereal-graphite group-hover:text-ethereal-gold transition-colors"
              aria-hidden="true"
            />
            <Eyebrow className="group-hover:text-ethereal-gold transition-colors">
              {t("auth.login.back_to_lobby", "Powrót do przedsionka")}
            </Eyebrow>
          </Link>
        </div>

        <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-8"
          >
            <Heading
              size="huge"
              weight="medium"
              className="text-ethereal-ink mb-3"
            >
              Voct
              <span className="italic text-ethereal-gold pr-2">Manager</span>
            </Heading>
            <Eyebrow color="muted">
              {t("auth.login.subtitle", "Panel Administracyjny & Kadrowy")}
            </Eyebrow>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard
              variant="ethereal"
              padding="lg"
              glow={true}
              isHoverable={false}
            >
              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                <div>
                  <Eyebrow as="label" className="block mb-2 ml-1">
                    {t("auth.login.email_label", "Adres e-mail")}
                  </Eyebrow>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={isSubmitting}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t(
                      "auth.login.email_placeholder",
                      "np. jan.kowalski@voctensemble.pl",
                    )}
                  />
                </div>

                <div>
                  <Eyebrow as="label" className="block mb-2 ml-1">
                    {t("auth.login.password_label", "Klucz dostępu")}
                  </Eyebrow>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    disabled={isSubmitting}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t(
                      "auth.login.password_placeholder",
                      "••••••••",
                    )}
                  />
                </div>

                <div aria-live="polite">
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-ethereal-crimson-light/80 backdrop-blur-md border-l-4 border-ethereal-crimson p-4 rounded-r-xl shadow-sm mb-4 overflow-hidden"
                      >
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <AlertCircle
                              className="h-5 w-5 text-ethereal-crimson"
                              aria-hidden="true"
                            />
                          </div>
                          <div className="ml-3">
                            <Text className="text-ethereal-crimson font-medium text-sm">
                              {error}
                            </Text>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    size="lg"
                    isLoading={isSubmitting}
                    disabled={!email || !password || isSubmitting}
                  >
                    {isSubmitting
                      ? t("auth.login.submitting", "Autoryzacja...")
                      : t("auth.login.submit_button", "Autoryzuj dostęp")}
                  </Button>
                </div>
              </form>

              <div className="mt-8 flex flex-col items-center gap-2">
                <Eyebrow color="muted" className="text-[9px] opacity-60">
                  {t(
                    "auth.login.footer_security",
                    "Zabezpieczone przez JWT Auth • 2026",
                  )}
                </Eyebrow>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => handleOpenLegalModal("terms", e)}
                    className="text-[10px] text-ethereal-graphite/60 hover:text-ethereal-gold transition-colors uppercase tracking-widest font-medium"
                  >
                    Regulamin
                  </button>
                  <span className="text-ethereal-graphite/30 text-[10px]">
                    •
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleOpenLegalModal("privacy", e)}
                    className="text-[10px] text-ethereal-graphite/60 hover:text-ethereal-gold transition-colors uppercase tracking-widest font-medium"
                  >
                    Polityka Prywatności
                  </button>
                </div>
              </div>
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
    </PageTransition>
  );
}
