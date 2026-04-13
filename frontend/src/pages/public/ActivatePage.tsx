/**
 * @file ActivatePage.tsx
 * @description Final account activation screen for invited artists.
 * Completely decoupled from business logic via useAccountActivation hook.
 * @module pages/public/ActivatePage
 */

import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useAccountActivation } from "@features/auth/hooks/useAccountActivation";

export default function ActivatePage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
      title: t("auth.activate.features.security.title", "Bezpieczna aktywacja"),
      description: t(
        "auth.activate.features.security.desc",
        "Link aktywacyjny jest przypisany do zaproszonego konta i odblokowuje prywatny panel dopiero po ustawieniu hasła.",
      ),
      icon: ShieldCheck,
    },
    {
      title: t("auth.activate.features.access.title", "Szybki start"),
      description: t(
        "auth.activate.features.access.desc",
        "Po aktywacji możesz od razu zalogować się i sprawdzić próby, projekty oraz materiały organizacyjne.",
      ),
      icon: KeyRound,
    },
    {
      title: t("auth.activate.features.workspace.title", "Panel pracy zespołu"),
      description: t(
        "auth.activate.features.workspace.desc",
        "VoctManager centralizuje komunikację artystyczną, dane zespołu i logistykę produkcyjną w jednym miejscu.",
      ),
      icon: Sparkles,
    },
  ];

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#f6f1e8] selection:bg-brand selection:text-white"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 12% 18%, rgba(0,35,149,0.08), transparent 22%), radial-gradient(circle at 84% 16%, rgba(14,116,144,0.10), transparent 18%), linear-gradient(135deg, rgba(255,255,255,0.62), rgba(255,255,255,0.18))",
        }}
      />
      <div
        className="pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full bg-brand/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-cyan-700/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 lg:px-10">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] font-medium text-stone-500 transition-colors hover:text-brand"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>
              {t("auth.activate.back_to_home", "Powrót na stronę główną")}
            </span>
          </Link>

          <div className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-600 shadow-sm shadow-stone-300/30 backdrop-blur">
            {t("auth.activate.badge", "Aktywacja zaproszenia")}
          </div>
        </div>

        <div className="flex flex-1 items-center py-8 lg:py-12">
          <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-[28px] border border-stone-200/70 bg-stone-950 px-7 py-8 text-white shadow-2xl shadow-stone-900/20 lg:px-10 lg:py-10"
            >
              <div
                className="absolute inset-0 opacity-80"
                aria-hidden="true"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(0,35,149,0.82), rgba(17,24,39,0.95) 42%, rgba(12,74,110,0.88))",
                }}
              />
              <div
                className="absolute -right-12 top-10 h-40 w-40 rounded-full border border-white/10"
                aria-hidden="true"
              />
              <div
                className="absolute bottom-[-24px] left-[-16px] h-48 w-48 rounded-full bg-white/6 blur-2xl"
                aria-hidden="true"
              />

              <div className="relative">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-100/90">
                  {t("auth.activate.subtitle", "Dostęp do VoctManagera")}
                </p>
                <h1
                  className="max-w-xl text-5xl leading-none text-white md:text-6xl"
                  style={{ fontFamily: "'Cormorant', serif" }}
                >
                  {t("auth.activate.title_1", "Aktywuj swój")}
                  <span className="ml-3 italic text-cyan-200">
                    {t("auth.activate.title_2", "panel artysty")}
                  </span>
                </h1>
                <p className="mt-6 max-w-xl text-sm leading-7 text-stone-200/88 md:text-base">
                  {t(
                    "auth.activate.description",
                    "Dokończ ostatni krok wdrożenia, aby zabezpieczyć konto i uzyskać dostęp do panelu używanego do projektów, prób i koordynacji zespołu.",
                  )}
                </p>

                <div className="mt-8 grid gap-4">
                  {activationHighlights.map(
                    ({ title, description, icon: Icon }) => (
                      <div
                        key={title}
                        className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm"
                      >
                        <div className="flex items-start gap-4">
                          <div className="mt-0.5 rounded-xl bg-white/12 p-2.5">
                            <Icon
                              className="h-5 w-5 text-cyan-100"
                              aria-hidden="true"
                            />
                          </div>
                          <div>
                            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/95">
                              {title}
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-stone-200/82">
                              {description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="relative overflow-hidden rounded-[28px] border border-stone-200/70 bg-white/90 p-6 shadow-2xl shadow-stone-300/25 backdrop-blur md:p-8"
            >
              <div
                className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-cyan-500 to-stone-900"
                aria-hidden="true"
              />

              {!activatedData ? (
                <>
                  <div className="mb-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                      {t("auth.activate.form.subtitle", "Ustawienie hasła")}
                    </p>
                    <h2
                      className="mt-3 text-4xl text-stone-900"
                      style={{ fontFamily: "'Cormorant', serif" }}
                    >
                      {t("auth.activate.form.title", "Dokończ aktywację")}
                    </h2>
                    <p className="mt-3 max-w-lg text-sm leading-7 text-stone-600">
                      {t(
                        "auth.activate.form.description",
                        "Ustaw bezpieczne hasło dla zaproszonego konta. Po aktywacji zalogujesz się do panelu przez standardową stronę logowania.",
                      )}
                    </p>
                  </div>

                  <div className="mb-6 rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck
                        className="mt-0.5 h-5 w-5 text-brand"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-700">
                          {t(
                            "auth.activate.form.security_title",
                            "Standard bezpieczeństwa",
                          )}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {t(
                            "auth.activate.form.security_desc",
                            "Użyj co najmniej 8 znaków. Zalecane jest dłuższe hasło z małymi i wielkimi literami, cyframi oraz znakami specjalnymi.",
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {!hasActivationParams && (
                    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      {t(
                        "auth.activate.form.missing_params",
                        "W tym linku brakuje parametrów aktywacyjnych. Otwórz najnowszy e-mail z zaproszeniem i użyj pełnego przycisku lub adresu URL.",
                      )}
                    </div>
                  )}

                  <form className="space-y-5" onSubmit={handleSubmit}>
                    <div>
                      <label
                        htmlFor="new-password"
                        className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500"
                      >
                        {t("auth.activate.form.new_password", "Nowe hasło")}
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
                        className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-medium text-stone-900 shadow-sm transition-all placeholder:text-stone-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-stone-100 disabled:text-stone-400"
                        placeholder={t(
                          "auth.activate.form.new_password_placeholder",
                          "Utwórz bezpieczne hasło",
                        )}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="confirm-password"
                        className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500"
                      >
                        {t(
                          "auth.activate.form.confirm_password",
                          "Potwierdź hasło",
                        )}
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
                        className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-medium text-stone-900 shadow-sm transition-all placeholder:text-stone-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-stone-100 disabled:text-stone-400"
                        placeholder={t(
                          "auth.activate.form.confirm_password_placeholder",
                          "Powtórz hasło",
                        )}
                      />
                    </div>

                    <div aria-live="polite">
                      {formError && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-2xl border border-red-200 bg-red-50 p-4"
                        >
                          <div className="flex items-start gap-3">
                            <AlertCircle
                              className="mt-0.5 h-5 w-5 text-red-600"
                              aria-hidden="true"
                            />
                            <p className="text-sm leading-6 text-red-800">
                              {t(formError, formError)}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={
                        isSubmitting ||
                        !password ||
                        !confirmPassword ||
                        !hasActivationParams
                      }
                      className="flex w-full items-center justify-center rounded-xl bg-stone-900 px-4 py-3 text-xs font-bold uppercase tracking-[0.22em] text-white transition-colors hover:bg-brand disabled:cursor-not-allowed disabled:bg-stone-300"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                          {t(
                            "auth.activate.form.activating_btn",
                            "Aktywowanie konta",
                          )}
                        </span>
                      ) : (
                        t("auth.activate.form.activate_btn", "Aktywuj konto")
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex h-full flex-col justify-center">
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6">
                    <div className="flex items-start gap-4">
                      <div className="rounded-2xl bg-emerald-100 p-3">
                        <CheckCircle2
                          className="h-7 w-7 text-emerald-700"
                          aria-hidden="true"
                        />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                          {t(
                            "auth.activate.success.subtitle",
                            "Aktywacja zakończona",
                          )}
                        </p>
                        <h2
                          className="mt-3 text-4xl text-stone-900"
                          style={{ fontFamily: "'Cormorant', serif" }}
                        >
                          {t(
                            "auth.activate.success.title",
                            "Twój panel jest gotowy",
                          )}
                        </h2>

                        <p className="mt-3 text-sm leading-7 text-stone-700">
                          {t(
                            "auth.activate.success.desc_1",
                            "Konto przypisane do ",
                          )}
                          <span className="font-semibold">
                            {activatedData.email}
                          </span>
                          {t(
                            "auth.activate.success.desc_2",
                            " zostało zabezpieczone i aktywowane.",
                          )}
                        </p>

                        <div className="mt-5 mb-3 p-4 rounded-xl bg-white border border-emerald-200/60 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500 mb-1">
                            {t(
                              "auth.activate.success.your_username",
                              "Twój login do panelu",
                            )}
                          </p>
                          <p className="font-mono text-xl font-bold text-brand tracking-tight">
                            {activatedData.email}
                          </p>
                        </div>

                        <p className="text-xs text-stone-500 leading-relaxed">
                          {t(
                            "auth.activate.success.instruction",
                            "Przejdź do strony logowania i użyj swojego adresu e-mail oraz nowo utworzonego hasła, aby wejść do panelu.",
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => navigate("/login")}
                      className="flex-1 rounded-xl bg-stone-900 px-4 py-3 text-xs font-bold uppercase tracking-[0.22em] text-white transition-colors hover:bg-brand"
                    >
                      {t(
                        "auth.activate.success.go_to_login",
                        "Przejdź do logowania",
                      )}
                    </button>
                    <Link
                      to="/"
                      className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.22em] text-stone-700 transition-colors hover:border-stone-900 hover:text-stone-900"
                    >
                      {t(
                        "auth.activate.success.return_home",
                        "Wróć na stronę główną",
                      )}
                    </Link>
                  </div>
                </div>
              )}
            </motion.section>
          </div>
        </div>
      </div>
    </div>
  );
}
