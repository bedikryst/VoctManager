/**
 * @file WelcomeMoment.tsx
 * @description The chorister's first crossing into their home — shown once, ever,
 * PER ACCOUNT (the "seen" flag lives on the server, so a borrowed phone still
 * earns the welcome and a member who dismissed it on a laptop won't see it again
 * on a phone). Not a tutorial and not a coach-mark overlay (both die on first
 * dismissal): a single full-bleed *moment* that takes the stage, names the singer
 * and their voice, lets them hear the ensemble find its pitch (the chord at the
 * centre), then dissolves into the dashboard waiting underneath. Any setup nudges
 * (install, finish configuration) sit quietly below the ceremony — offered after
 * the warmth, never as a wall of permission asks before it.
 * @module features/dashboard/components/WelcomeMoment
 */

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Download, Settings, Sparkles } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/app/providers/AuthProvider";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { EASE } from "@/shared/ui/kinematics/motion-presets";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow } from "@/shared/ui/primitives/typography/Eyebrow";
import { Heading } from "@/shared/ui/primitives/typography/Heading";
import { Text } from "@/shared/ui/primitives/typography/Text";
import { useWelcomeChord } from "@/shared/ui/instruments/useWelcomeChord";
import { useInstallPrompt } from "@/shared/pwa/useInstallPrompt";
import {
  getSectionPresentation,
  type SectionPresentation,
} from "@/features/artists/constants/voiceSections";
import { settingsService } from "@/features/settings/api/settings.service";

// Section accent for the "Your voice" chip — borrowed from the roster's SATB
// colour language so a singer's section reads the same everywhere.
const VOICE_ACCENT: Record<SectionPresentation["textColor"], string> = {
  crimson: "border-ethereal-crimson/30 text-ethereal-crimson",
  amethyst: "border-ethereal-amethyst/30 text-ethereal-amethyst",
  gold: "border-ethereal-gold/40 text-ethereal-gold",
  sage: "border-ethereal-sage/30 text-ethereal-sage",
};

interface WelcomeMomentProps {
  /** The singer's name (vocative-aware), highlighted in the greeting. */
  readonly name?: string | null;
}

export const WelcomeMoment = ({
  name,
}: WelcomeMomentProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { play, isPlaying } = useWelcomeChord();
  const { canPrompt, isInstalled, promptInstall } = useInstallPrompt();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => setMounted(true), []);

  // The flag is server-authoritative: null = the member has never completed the
  // welcome on any device. Local `dismissed` only smooths the exit animation.
  const seenAt = user?.profile?.welcome_seen_at ?? null;
  const show = Boolean(user) && seenAt === null && !dismissed;

  useBodyScrollLock(show);

  const dismiss = useCallback(() => {
    setDismissed(true);
    // Stamp it once, server-side, then settle the in-memory user so a remount
    // doesn't greet again. On failure we keep the local dismissal; the flag
    // simply gets another chance next session.
    void settingsService
      .markWelcomeSeen()
      .then(() => refreshUser())
      .catch(() => undefined);
  }, [refreshUser]);

  const voiceType = user?.voice_type ?? null;
  const voicePresentation = getSectionPresentation(voiceType);
  const voiceLabel = voiceType
    ? t(`dashboard.layout.roles.${voiceType}`, user?.voice_type_display || voiceType)
    : null;

  // Offer a one-tap install only where the browser actually hands us a prompt
  // (Chromium). iOS / already-installed members meet the ambient pill later.
  const canInstall = canPrompt && !isInstalled;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          key="welcome-moment"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: EASE.buttery }}
          className="fixed inset-0 z-focus-trap flex items-center justify-center overflow-y-auto px-5 py-10"
          role="dialog"
          aria-modal="true"
          aria-label={t("dashboard.artist.welcome.eyebrow", "Witamy w zespole")}
        >
          {/* The threshold — a luminous full-bleed wash, not a dim modal scrim. */}
          <div
            className="absolute inset-0 bg-linear-to-b from-ethereal-alabaster/95 via-ethereal-parchment/95 to-ethereal-marble/95 backdrop-blur-2xl"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute inset-0 bg-noise opacity-60" aria-hidden="true" />

          <button
            type="button"
            onClick={dismiss}
            className="absolute right-5 top-5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-ethereal-graphite/45 transition-colors hover:bg-ethereal-graphite/6 hover:text-ethereal-ink"
          >
            {t("dashboard.artist.welcome.overlay_skip", "Pomiń")}
          </button>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: EASE.buttery }}
            className="relative z-10 flex w-full max-w-xl flex-col items-center text-center"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-ethereal-gold" aria-hidden="true" />
              <Eyebrow color="gold" as="p">
                {t("dashboard.artist.welcome.eyebrow", "Witamy w zespole")}
              </Eyebrow>
            </div>

            <Heading
              as="h1"
              size="5xl"
              color="default"
              className="mt-5 leading-[1.05]"
            >
              {t("dashboard.artist.welcome.title", "Dobrze, że jesteś")}
              {name ? (
                <>
                  ,<span className="italic text-ethereal-gold"> {name}</span>
                </>
              ) : (
                "."
              )}
            </Heading>

            {voiceLabel && (
              <span
                className={cn(
                  "mt-5 inline-flex items-center gap-2 rounded-full border bg-white/50 px-3.5 py-1.5",
                  voicePresentation
                    ? VOICE_ACCENT[voicePresentation.textColor]
                    : "border-ethereal-incense/25 text-ethereal-graphite",
                )}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ethereal-graphite/55">
                  {t("dashboard.artist.welcome.voice_label", "Twój głos")}
                </span>
                <span className="text-sm font-semibold">{voiceLabel}</span>
              </span>
            )}

            <Text size="base" color="graphite" className="mt-5 max-w-md leading-7">
              {t(
                "dashboard.artist.welcome.overlay_intro",
                "To Twoja przestrzeń — najbliższa próba, Twoja partia i obecność w jednym miejscu. Ale najpierw posłuchaj, jak brzmi zespół, do którego dołączasz.",
              )}
            </Text>

            {/* ── The chord of welcome — the centrepiece, the ensemble finding
                its pitch. A large tactile disc that rings outward on tap. ── */}
            <div className="relative mt-10 grid place-items-center">
              {isPlaying && !reduceMotion && (
                <>
                  {[0, 0.35, 0.7].map((delay) => (
                    <motion.span
                      key={delay}
                      className="pointer-events-none absolute h-28 w-28 rounded-full border border-ethereal-gold/40"
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 2.4, opacity: 0 }}
                      transition={{ duration: 1.6, delay, ease: "easeOut", repeat: Infinity }}
                      aria-hidden="true"
                    />
                  ))}
                </>
              )}

              <button
                type="button"
                onClick={play}
                aria-label={t("dashboard.artist.welcome.chord_cta", "Usłysz swój zespół")}
                className={cn(
                  "group relative grid h-28 w-28 place-items-center rounded-full border transition-[transform,background-color,border-color] duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                  isPlaying
                    ? "scale-105 border-ethereal-gold/60 bg-ethereal-gold/15 shadow-glass-ethereal-hover"
                    : "border-ethereal-incense/30 bg-white/60 shadow-glass-ethereal hover:scale-105 hover:border-ethereal-gold/50 hover:bg-ethereal-gold/8 active:scale-100",
                )}
              >
                {/* A four-note glyph — the voicing made visible. */}
                <span className="flex items-end gap-1" aria-hidden="true">
                  {[0.55, 0.78, 0.66, 1].map((h, i) => (
                    <span
                      key={i}
                      className={cn(
                        "w-1.5 rounded-full transition-all duration-500",
                        isPlaying ? "bg-ethereal-gold" : "bg-ethereal-gold/70 group-hover:bg-ethereal-gold",
                      )}
                      style={{ height: `${h * 2.4}rem` }}
                    />
                  ))}
                </span>
              </button>
            </div>

            <Eyebrow
              color={isPlaying ? "gold" : "muted"}
              as="p"
              className="mt-5 tracking-[0.16em]"
            >
              {isPlaying
                ? t("dashboard.artist.welcome.chord_playing", "Brzmi…")
                : t("dashboard.artist.welcome.chord_hint", "Dotknij, by usłyszeć, jak zespół stroi")}
            </Eyebrow>

            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={dismiss}
              className="mt-10"
            >
              {t("dashboard.artist.welcome.enter", "Wejdź do swojej przestrzeni")}
            </Button>

            {/* ── Quiet, optional setup — offered AFTER the moment, never before.
                Install (one-tap, Chromium) + a nudge to finish configuration. ── */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              {canInstall && (
                <button
                  type="button"
                  onClick={() => void promptInstall()}
                  className="inline-flex items-center gap-2 rounded-full border border-ethereal-incense/25 bg-white/40 px-4 py-2 text-xs font-semibold text-ethereal-graphite transition-colors hover:border-ethereal-gold/45 hover:text-ethereal-ink"
                >
                  <Download size={14} strokeWidth={2} className="text-ethereal-gold" aria-hidden="true" />
                  {t("dashboard.artist.welcome.install_cta", "Zainstaluj aplikację")}
                </button>
              )}
              <Link
                to="/panel/settings"
                onClick={dismiss}
                className="group inline-flex items-center gap-2 rounded-full border border-dashed border-ethereal-incense/30 bg-white/25 px-4 py-2 text-xs font-semibold text-ethereal-graphite transition-colors hover:border-ethereal-gold/40 hover:text-ethereal-ink"
              >
                <Settings size={14} strokeWidth={1.75} className="text-ethereal-graphite/55 group-hover:text-ethereal-gold" aria-hidden="true" />
                {t("dashboard.artist.welcome.settings_cta", "Dokończ konfigurację")}
                <ArrowRight size={13} strokeWidth={2} className="text-ethereal-graphite/40 transition-transform group-hover:translate-x-0.5 group-hover:text-ethereal-gold" aria-hidden="true" />
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

WelcomeMoment.displayName = "WelcomeMoment";
