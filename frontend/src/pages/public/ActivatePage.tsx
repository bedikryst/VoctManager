/**
 * @file ActivatePage.tsx
 * @description Final account activation screen for invited artists.
 * Completely decoupled from business logic via useAccountActivation hook.
 * @architecture Enterprise SaaS 2026
 * @module pages/public/ActivatePage
 */

import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAccountActivation } from "@features/auth/hooks/useAccountActivation";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Heading } from "@/shared/ui/primitives/typography/Heading";
import { Text } from "@/shared/ui/primitives/typography/Text";
import { Eyebrow } from "@/shared/ui/primitives/typography/Eyebrow";
import { LegalModal } from "@features/auth/components/LegalModals";

export default function ActivatePage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
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
    handleSubmit,
  } = useAccountActivation();

  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => document.body.classList.remove("admin-mode");
  }, []);

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

  return (
    <div className="relative min-h-screen bg-transparent selection:bg-ethereal-gold/30">
      <div className="absolute top-8 left-8 z-10">
        <Link
          to="/"
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-ethereal-graphite hover:text-ethereal-gold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t("auth.activate.back_to_home", "Powrót")}</span>
        </Link>
      </div>

      <div className="absolute top-8 right-8 z-10">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-ethereal-graphite/50">
          {t("auth.activate.badge", "Aktywacja")}
        </span>
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center justify-center px-6 py-24 lg:px-10">
        <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard
              variant="dark"
              padding="lg"
              isHoverable={false}
              className="h-full flex flex-col"
            >
              <Eyebrow color="parchment-muted" as="p" className="mb-4">
                {t("auth.activate.subtitle")}
              </Eyebrow>
              <Heading
                as="h1"
                size="5xl"
                color="marble"
                className="leading-none"
              >
                {t("auth.activate.title_1")}
                <span className="ml-2 italic text-ethereal-gold">
                  {t("auth.activate.title_2")}
                </span>
              </Heading>
              <Text
                size="base"
                color="parchment-muted"
                className="mt-5 max-w-lg leading-7"
              >
                {t("auth.activate.description")}
              </Text>
              <div className="mt-8 grid gap-4 flex-1">
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

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.55,
              delay: 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <GlassCard
              variant="ethereal"
              padding="lg"
              glow
              isHoverable={false}
              className="relative h-full flex flex-col"
            >
              <div
                className="absolute inset-x-0 -top-6 h-px bg-linear-to-r from-transparent via-ethereal-gold/60 to-transparent"
                aria-hidden="true"
              />
              {!activatedData ? (
                <>
                  <div className="mb-8">
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
                        <Text
                          size="sm"
                          color="graphite"
                          className="mt-1.5 leading-6"
                        >
                          {t("auth.activate.form.security_desc")}
                        </Text>
                      </div>
                    </div>
                  </div>

                  {!hasActivationParams && (
                    <div className="mb-6 rounded-2xl border border-amber-200/70 bg-amber-50/80 p-4">
                      <Text size="sm" className="text-amber-900 leading-6">
                        {t("auth.activate.form.missing_params")}
                      </Text>
                    </div>
                  )}

                  <form className="space-y-5" onSubmit={handleSubmit}>
                    <div>
                      <label
                        htmlFor="new-password"
                        className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-ethereal-graphite ml-1"
                      >
                        {t("auth.activate.form.new_password")}
                      </label>
                      <input
                        id="new-password"
                        name="new-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        disabled={isSubmitting || !hasActivationParams}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="appearance-none block w-full px-4 py-3 bg-white/40 backdrop-blur-sm border border-ethereal-incense/20 rounded-xl shadow-sm placeholder-ethereal-graphite/40 text-ethereal-ink focus:outline-none focus:ring-2 focus:ring-ethereal-gold/40 focus:border-ethereal-gold/50 text-sm font-medium transition-all disabled:opacity-50"
                        placeholder={t(
                          "auth.activate.form.new_password_placeholder",
                        )}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="confirm-password"
                        className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-ethereal-graphite ml-1"
                      >
                        {t("auth.activate.form.confirm_password")}
                      </label>
                      <input
                        id="confirm-password"
                        name="confirm-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        disabled={isSubmitting || !hasActivationParams}
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        className="appearance-none block w-full px-4 py-3 bg-white/40 backdrop-blur-sm border border-ethereal-incense/20 rounded-xl shadow-sm placeholder-ethereal-graphite/40 text-ethereal-ink focus:outline-none focus:ring-2 focus:ring-ethereal-gold/40 focus:border-ethereal-gold/50 text-sm font-medium transition-all disabled:opacity-50"
                        placeholder={t(
                          "auth.activate.form.confirm_password_placeholder",
                        )}
                      />
                    </div>

                    <label
                      htmlFor="terms-accepted"
                      className="flex items-start gap-3 cursor-pointer rounded-2xl border border-ethereal-incense/15 bg-white/30 p-4 transition-colors hover:bg-white/50"
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
                        <div className="h-4 w-4 rounded border border-ethereal-incense/40 bg-white/60 transition-all peer-checked:border-ethereal-gold peer-checked:bg-ethereal-gold flex items-center justify-center">
                          <svg
                            className={`h-2.5 w-2.5 text-white transition-opacity duration-150 ${termsAccepted ? "opacity-100" : "opacity-0"}`}
                            viewBox="0 0 12 10"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M1 5l3.5 3.5L11 1"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </div>
                      <Text
                        size="sm"
                        color="graphite"
                        className="leading-6 select-none"
                      >
                        {t("auth.activate.form.terms_prefix", "Akceptuję ")}{" "}
                        <button
                          type="button"
                          onClick={(e) => handleOpenLegalModal("terms", e)}
                          className="text-ethereal-gold hover:text-ethereal-ink transition-colors font-medium underline underline-offset-4"
                        >
                          {t("auth.activate.form.terms_link", "Regulamin")}
                        </button>{" "}
                        &{" "}
                        <button
                          type="button"
                          onClick={(e) => handleOpenLegalModal("privacy", e)}
                          className="text-ethereal-gold hover:text-ethereal-ink transition-colors font-medium underline underline-offset-4"
                        >
                          {t(
                            "auth.activate.form.privacy_link",
                            "Politykę Prywatności",
                          )}
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
                            <Text
                              size="sm"
                              color="crimson"
                              className="leading-6"
                            >
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
                        !password ||
                        !confirmPassword ||
                        !hasActivationParams ||
                        !termsAccepted
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
                  <div className="rounded-3xl border border-ethereal-sage/30 bg-ethereal-sage/5 p-6">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 rounded-2xl bg-ethereal-sage/15 p-3">
                        <CheckCircle2
                          className="h-7 w-7 text-ethereal-sage"
                          aria-hidden="true"
                        />
                      </div>
                      <div>
                        <Eyebrow color="sage" as="p" className="mb-3">
                          {t("auth.activate.success.subtitle")}
                        </Eyebrow>
                        <Heading as="h2" size="4xl" color="default">
                          {t("auth.activate.success.title")}
                        </Heading>
                        <Text
                          size="sm"
                          color="graphite"
                          className="mt-3 leading-7"
                        >
                          {t("auth.activate.success.desc_1")}
                          <span className="font-semibold text-ethereal-ink">
                            {activatedData.email}
                          </span>
                          {t("auth.activate.success.desc_2")}
                        </Text>
                        <div className="mt-5 mb-4 rounded-xl border border-ethereal-incense/20 bg-white/70 p-4 shadow-glass-solid">
                          <Text
                            size="xs"
                            weight="bold"
                            color="graphite"
                            className="mb-1 uppercase tracking-[0.2em]"
                          >
                            {t("auth.activate.success.your_username")}
                          </Text>
                          <Text
                            size="md"
                            weight="bold"
                            color="gold"
                            className="font-mono tracking-tight"
                          >
                            {activatedData.email}
                          </Text>
                        </div>
                        <Text
                          size="xs"
                          color="graphite"
                          className="leading-relaxed"
                        >
                          {t("auth.activate.success.instruction")}
                        </Text>
                      </div>
                    </div>
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
    </div>
  );
}
