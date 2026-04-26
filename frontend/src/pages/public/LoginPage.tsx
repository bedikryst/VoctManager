/**
 * @file Login.tsx
 * @description Authentication gateway for the VoctManager Dashboard.
 * Refactored to fully embody Ethereal UI standards (Glassmorphism)
 * and strictly adheres to i18n architectural standards.
 * @architecture Enterprise 2026 Standards
 * @module pages/Login
 * @author Krystian Bugalski
 */

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { AlertCircle, ArrowLeft } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";

export default function Login(): React.JSX.Element {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // Enforce system cursor normalization for accessibility on the auth screen
  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => document.body.classList.remove("admin-mode");
  }, []);

  // Smart redirect resolution
  const from = (location.state as any)?.from?.pathname || "/panel";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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

  return (
    <div className="min-h-screen bg-transparent flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="absolute top-8 left-8">
        <Link
          to="/"
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-ethereal-graphite hover:text-ethereal-gold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t("auth.login.back_to_lobby", "Powrót do przedsionka")}</span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <h2 className="text-5xl md:text-6xl font-medium text-ethereal-ink mb-3 font-serif tracking-tight">
            Voct<span className="italic text-ethereal-gold pr-2">Manager</span>
          </h2>
          <p className="mt-2 text-[11px] text-ethereal-graphite font-bold tracking-[0.2em] uppercase">
            {t("auth.login.subtitle", "Panel Administracyjny & Kadrowy")}
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.8,
          delay: 0.15,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <GlassCard
          variant="ethereal"
          padding="lg"
          glow={true}
          isHoverable={false}
          className="!pt-10"
        >
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block text-[10px] font-bold uppercase tracking-[0.15em] text-ethereal-graphite mb-2 ml-1"
              >
                {t("auth.login.email_label", "Adres e-mail")}
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isSubmitting}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 bg-white/40 backdrop-blur-sm border border-ethereal-incense/20 rounded-xl shadow-sm placeholder-ethereal-graphite/40 text-ethereal-ink focus:outline-none focus:ring-2 focus:ring-ethereal-gold/40 focus:border-ethereal-gold/50 sm:text-sm font-medium transition-all disabled:opacity-50"
                  placeholder={t(
                    "auth.login.email_placeholder",
                    "np. jan.kowalski@voctensemble.pl",
                  )}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[10px] font-bold uppercase tracking-[0.15em] text-ethereal-graphite mb-2 ml-1"
              >
                {t("auth.login.password_label", "Klucz dostępu")}
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 bg-white/40 backdrop-blur-sm border border-ethereal-incense/20 rounded-xl shadow-sm placeholder-ethereal-graphite/40 text-ethereal-ink focus:outline-none focus:ring-2 focus:ring-ethereal-gold/40 focus:border-ethereal-gold/50 sm:text-sm font-medium transition-all disabled:opacity-50"
                  placeholder={t("auth.login.password_placeholder", "••••••••")}
                />
              </div>
            </div>

            <div aria-live="polite">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-red-50/80 backdrop-blur-md border-l-4 border-red-400 p-4 rounded-r-xl shadow-sm"
                >
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle
                        className="h-5 w-5 text-red-500"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800 font-medium">
                        {error}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                isLoading={isSubmitting}
                disabled={!email || !password}
              >
                {isSubmitting
                  ? t("auth.login.submitting", "Autoryzacja...")
                  : t("auth.login.submit_button", "Autoryzuj dostęp")}
              </Button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[9px] text-ethereal-graphite/60 uppercase tracking-[0.2em] font-bold">
              {t(
                "auth.login.footer_security",
                "Zabezpieczone przez JWT Auth • 2026",
              )}
            </p>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
