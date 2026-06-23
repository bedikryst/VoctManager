/**
 * @file ErrorScreen.tsx
 * @description The Ethereal fault surface — what a chorister or conductor sees
 * when something interrupts the performance. Replaces the framework's raw
 * "Unexpected Application Error" with a calm, premium, on-brand moment: a held
 * fermata over the nave-of-light field, reassuring copy, and one clear way back.
 *
 * Two tones share one body:
 *  - `fullscreen` — a catastrophic / shell-level fault. Paints its own ambient
 *    backdrop so it stands alone even when the app shell is gone.
 *  - `panel`      — a single view stumbled; the surrounding chrome (sidebar,
 *    nav) is still alive, so this renders as a contained card with no backdrop.
 *
 * Deliberately self-contained: it depends only on i18n (global, loaded before
 * first paint) and pure presentational primitives — never on app stores,
 * providers or query state, any of which may be the very thing that failed.
 * @module shared/ui/feedback/ErrorScreen
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { RefreshCw, ArrowLeft } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Heading, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

export interface ErrorScreenProps {
  /** Layout posture — full-viewport takeover vs. a card inside the live shell. */
  tone?: "fullscreen" | "panel";
  /** A stale-deploy / failed-chunk fault reframes the copy as "new version". */
  isStale?: boolean;
  /** Primary recovery (default: hard reload). */
  onReload?: () => void;
  /** Re-mount the failed subtree without a full reload (panel tone). */
  onRetry?: () => void;
  /** Escape hatch back to the panel home (default: hard nav to /panel). */
  onHome?: () => void;
  /** Raw technical detail — shown only in dev, tucked behind a disclosure. */
  detail?: string;
}

/** A held fermata: the musician's mark for an unmeasured pause — exactly this
 *  moment. Drawn rather than glyph'd so it stays crisp at the emblem scale. */
const FermataMark = ({ className }: { className?: string }): React.JSX.Element => (
  <svg
    viewBox="0 0 48 34"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <path
      d="M5 27C5 16.5 13.5 8 24 8C34.5 8 43 16.5 43 27"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <circle cx="24" cy="26" r="2.6" fill="currentColor" />
  </svg>
);

/** Ambient nave-of-light field, distilled to pure CSS so the fault surface
 *  carries no dependency on the kinematic background layer it may be replacing. */
const AmbientField = (): React.JSX.Element => (
  <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-ethereal-canvas" aria-hidden="true">
    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(253,253,250,0.6)_0%,rgba(253,253,250,0)_46%)]" />
    <div className="absolute -left-[8%] -top-[10%] h-[44vw] w-[44vw] rounded-full bg-ethereal-gold/20 opacity-25 mix-blend-multiply blur-[120px]" />
    <div className="absolute -bottom-[22%] -right-[8%] h-[48vw] w-[48vw] rounded-full bg-ethereal-amethyst/15 opacity-[0.16] mix-blend-multiply blur-[120px]" />
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex h-[260vh] w-[260vw] -rotate-[8deg] flex-col justify-center">
        {[0, 1, 2, 3, 4].map((line) => (
          <div
            key={`fault-stave-${line}`}
            className="mb-14 h-px w-full bg-linear-to-r from-transparent via-ethereal-incense/40 to-transparent last:mb-0"
          />
        ))}
      </div>
    </div>
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,transparent_42%,rgba(22,20,18,0.06)_100%)]" />
    <div className="absolute inset-0 bg-noise opacity-[0.02] mix-blend-overlay" />
  </div>
);

export function ErrorScreen({
  tone = "fullscreen",
  isStale = false,
  onReload,
  onRetry,
  onHome,
  detail,
}: ErrorScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const isFullscreen = tone === "fullscreen";

  const handleReload = onReload ?? (() => window.location.reload());
  const handleHome = onHome ?? (() => window.location.assign("/panel"));

  const eyebrow = isStale
    ? t("errors.eyebrow_stale", "Nowa odsłona")
    : t("errors.eyebrow", "Nieoczekiwana pauza");
  const title = isStale
    ? t("errors.title_stale", "Dostępna jest świeża wersja")
    : isFullscreen
      ? t("errors.title", "Coś przerwało partyturę")
      : t("errors.panel_title", "Ten widok się potknął");
  const body = isStale
    ? t(
        "errors.body_stale",
        "Wczytujemy najnowszą wersję aplikacji. Odśwież, aby kontynuować z aktualnymi nutami.",
      )
    : isFullscreen
      ? t(
          "errors.body",
          "Napotkaliśmy nieoczekiwany błąd i zatrzymaliśmy się, by niczego nie zepsuć. Twoje dane są bezpieczne — odśwież widok, aby wrócić do pracy.",
        )
      : t(
          "errors.panel_body",
          "Reszta panelu działa bez zmian. Spróbuj wczytać ten widok ponownie lub wróć do panelu głównego.",
        );

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "relative flex w-full flex-col items-center justify-center px-6 text-center",
        isFullscreen
          ? "min-h-[100dvh] text-ethereal-ink"
          : "min-h-[60vh] py-16",
      )}
    >
      {isFullscreen && <AmbientField />}

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "relative flex w-full max-w-md flex-col items-center gap-7 rounded-[28px] px-8 py-12 sm:px-12",
          isFullscreen
            ? "border border-glass-border bg-glass-surface shadow-glass-ethereal backdrop-blur-[var(--blur-ethereal)]"
            : "border border-ethereal-gold/15 bg-ethereal-alabaster/70 shadow-glass-solid backdrop-blur-md",
        )}
      >
        {/* Emblem — a fermata cradled in a softly breathing gold halo. */}
        <div className="relative grid h-20 w-20 place-items-center">
          <span className="absolute inset-0 rounded-full bg-ethereal-gold/15 blur-xl motion-safe:animate-pulse" />
          <span className="absolute inset-[6px] rounded-full border border-ethereal-gold/30" />
          <FermataMark className="relative h-9 w-9 text-ethereal-gold drop-shadow-[0_0_10px_rgba(194,168,120,0.45)]" />
        </div>

        <div className="flex flex-col items-center gap-3">
          <Eyebrow size="caption" color="incense" className="tracking-[0.28em]">
            {eyebrow}
          </Eyebrow>
          <Heading
            size={isFullscreen ? "3xl" : "2xl"}
            className="text-balance leading-tight text-ethereal-ink"
          >
            {title}
          </Heading>
          <Text size="sm" color="muted" className="max-w-sm text-pretty leading-relaxed">
            {body}
          </Text>
        </div>

        <div className="flex w-full flex-col items-center gap-3 pt-1 sm:flex-row sm:justify-center">
          <Button
            variant="primary"
            size="touch"
            onClick={onRetry ?? handleReload}
            leftIcon={<RefreshCw size={14} strokeWidth={2} />}
            className="w-full sm:w-auto"
          >
            {isStale
              ? t("errors.action_reload", "Odśwież")
              : onRetry
                ? t("errors.action_retry", "Spróbuj ponownie")
                : t("errors.action_reload", "Odśwież")}
          </Button>
          <Button
            variant="ghost"
            size="touch"
            onClick={handleHome}
            leftIcon={<ArrowLeft size={14} strokeWidth={2} />}
            className="w-full sm:w-auto"
          >
            {t("errors.action_home", "Wróć do panelu")}
          </Button>
        </div>

        {import.meta.env.DEV && detail && (
          <details className="w-full max-w-full text-left">
            <summary className="cursor-pointer select-none text-[10px] font-bold uppercase tracking-[0.18em] text-ethereal-graphite/50 transition-colors hover:text-ethereal-graphite">
              {t("errors.detail_label", "Szczegóły techniczne")}
            </summary>
            <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-ethereal-ink/[0.04] p-3 text-left font-mono text-[11px] leading-relaxed text-ethereal-graphite/80 ring-1 ring-ethereal-ink/5">
              {detail}
            </pre>
          </details>
        )}
      </motion.div>
    </div>
  );
}

ErrorScreen.displayName = "ErrorScreen";
