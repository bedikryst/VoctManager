/**
 * @file WelcomeMoment.tsx
 * @description The chorister's first crossing into their home — shown once, ever,
 * PER ACCOUNT (the "seen" flag lives on the server, so a borrowed phone still
 * earns the welcome and a member who dismissed it on a laptop won't see it again
 * on a phone). Not a tutorial and not a coach-mark overlay (both die on first
 * dismissal): a single full-bleed *moment* staged as the nave in full light —
 * the app's own sacred-interior scene (shaft of light, incense glows, a stave
 * drawing itself in, the C-clef signature) at ceremonial intensity, not a dimmed
 * scrim. It names the singer and their voice, and offers the kamerton at the
 * centre: the honest A every rehearsal starts from (tap to ring, tap to
 * silence), never a synthesised stand-in for "how the ensemble sounds". Any
 * setup nudges (install, finish configuration) sit quietly below the ceremony —
 * offered after the warmth, never as a wall of permission asks before it.
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
import { VocalClefShadow } from "@/shared/ui/kinematics/VocalClefShadow";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow } from "@/shared/ui/primitives/typography/Eyebrow";
import { Heading } from "@/shared/ui/primitives/typography/Heading";
import { Text } from "@/shared/ui/primitives/typography/Text";
import { useWelcomeTone } from "@/shared/ui/instruments/useWelcomeTone";
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

const STAVE_LINES = [0, 1, 2, 3, 4] as const;

interface WelcomeSceneProps {
  /** Whether the kamerton is ringing — the shaft of light answers the tone. */
  readonly isToneRinging: boolean;
  readonly reduceMotion: boolean;
}

/**
 * The nave in full light — the welcome's own scenography. The dashboard's
 * ambient EtherealBackground sits *under* the (opaque) overlay, so the scene is
 * restated here at ceremonial intensity: the same layers, brighter, closer.
 * Painted in a non-scrolling wrapper so a short viewport scrolls the words,
 * never the light.
 */
const WelcomeScene = ({
  isToneRinging,
  reduceMotion,
}: WelcomeSceneProps): React.JSX.Element => (
  <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
    {/* Base — light falls from above: marble at the clerestory, parchment at
        the floor. Fully opaque: the reveal of the dashboard is the overlay's
        exit fade, not a haze over it. */}
    <div className="absolute inset-0 bg-linear-to-b from-ethereal-marble via-ethereal-alabaster to-ethereal-parchment" />

    {/* Shaft of light — a warm beam entering at the top centre, white at its
        core with a golden fringe. It swells while the kamerton rings. */}
    <motion.div
      className="absolute inset-0 bg-[radial-gradient(ellipse_90%_65%_at_50%_-12%,rgba(253,253,250,0.95)_0%,rgba(194,168,120,0.14)_46%,transparent_72%)]"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: isToneRinging ? 1 : 0.7 }}
      transition={{ duration: 1.4, ease: EASE.buttery }}
    />

    {/* Incense-light glows — gold pooling top-left, amethyst lower-right,
        the EtherealBackground pair a shade warmer for the ceremony. */}
    <div className="absolute -left-[8%] -top-[10%] h-[46vw] w-[46vw] rounded-full bg-ethereal-gold/25 opacity-30 mix-blend-multiply blur-[110px]" />
    <div className="absolute -bottom-[22%] -right-[8%] h-[50vw] w-[50vw] rounded-full bg-ethereal-amethyst/20 opacity-20 mix-blend-multiply blur-[120px]" />

    {/* The stave — the score the singer steps into, drawing itself in once. */}
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        className="flex w-[170vw] shrink-0 -rotate-[8deg] flex-col gap-14"
        initial={reduceMotion ? "visible" : "hidden"}
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.12 } },
        }}
      >
        {STAVE_LINES.map((line) => (
          <motion.div
            key={`welcome-stave-${line}`}
            className="h-px w-full origin-left bg-linear-to-r from-transparent via-ethereal-incense/45 to-transparent shadow-[0_0_8px_rgba(194,168,120,0.35)]"
            variants={{
              hidden: { scaleX: 0, opacity: 0 },
              visible: {
                scaleX: 1,
                opacity: 1,
                transition: { duration: 2.4, ease: [0.16, 1, 0.3, 1] },
              },
            }}
          />
        ))}
      </motion.div>
    </div>

    {/* The C-clef signature, settled at the singer's left hand. */}
    <motion.div
      className="absolute inset-0"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 2, delay: 0.4, ease: EASE.buttery }}
    >
      <VocalClefShadow className="left-[4%] text-ethereal-incense/25" />
    </motion.div>

    {/* Oculus vignette + film grain — the chiaroscuro of a lit interior,
        grain held at the app-wide whisper (NOT a dirty film over the scene). */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,transparent_40%,rgba(22,20,18,0.08)_100%)]" />
    <div className="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay" />
  </div>
);

interface WelcomeMomentProps {
  /** The singer's name (vocative-aware), highlighted in the greeting. */
  readonly name?: string | null;
}

export const WelcomeMoment = ({
  name,
}: WelcomeMomentProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { toggle, stop, isPlaying } = useWelcomeTone();
  const { canPrompt, isInstalled, promptInstall } = useInstallPrompt();
  const reduceMotion = useReducedMotion() ?? false;
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => setMounted(true), []);

  // The flag is server-authoritative: null = the member has never completed the
  // welcome on any device. Local `dismissed` only smooths the exit animation.
  const seenAt = user?.profile?.welcome_seen_at ?? null;
  const show = Boolean(user) && seenAt === null && !dismissed;

  useBodyScrollLock(show);

  const dismiss = useCallback(() => {
    // The component stays mounted through the exit animation, so a ringing
    // kamerton must be silenced explicitly — unmount cleanup never fires here.
    stop();
    setDismissed(true);
    // Stamp it once, server-side, then settle the in-memory user so a remount
    // doesn't greet again. On failure we keep the local dismissal; the flag
    // simply gets another chance next session.
    void settingsService
      .markWelcomeSeen()
      .then(() => refreshUser())
      .catch(() => undefined);
  }, [refreshUser, stop]);

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
          className="fixed inset-0 z-focus-trap"
          role="dialog"
          aria-modal="true"
          aria-label={t("dashboard.artist.welcome.eyebrow", "Witamy w zespole")}
        >
          <WelcomeScene isToneRinging={isPlaying} reduceMotion={reduceMotion} />

          <button
            type="button"
            onClick={dismiss}
            className="absolute right-5 top-5 z-20 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-ethereal-graphite/45 transition-colors hover:bg-ethereal-graphite/6 hover:text-ethereal-ink"
          >
            {t("dashboard.artist.welcome.overlay_skip", "Pomiń")}
          </button>

          {/* Scroll region separate from the scene: on a short viewport the
              words scroll, the light stays. `m-auto` (not items-center) so an
              overflowing column never clips its own first line. */}
          <div className="relative z-10 flex h-full overflow-y-auto px-5 py-10">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: EASE.buttery }}
              className="m-auto flex w-full max-w-xl flex-col items-center text-center"
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
                  "To Twoja przestrzeń — najbliższa próba, Twoja partia i obecność w jednym miejscu. A zaczyna się tak, jak każda próba: od jednego tonu.",
                )}
              </Text>

              {/* ── The kamerton — the honest centrepiece: the A every rehearsal
                  starts from. Tap to ring, tap again to silence. ── */}
              <div className="relative mt-10 grid place-items-center">
                {/* A golden halo that answers the ringing tone. */}
                <motion.span
                  className="pointer-events-none absolute h-48 w-48 rounded-full bg-ethereal-gold/25 blur-2xl"
                  initial={false}
                  animate={{ opacity: isPlaying ? 1 : 0, scale: isPlaying ? 1 : 0.8 }}
                  transition={{ duration: 1, ease: EASE.buttery }}
                  aria-hidden="true"
                />

                {isPlaying && !reduceMotion && (
                  <>
                    {[0, 0.8, 1.6].map((delay) => (
                      <motion.span
                        key={delay}
                        className="pointer-events-none absolute h-32 w-32 rounded-full border border-ethereal-gold/40"
                        initial={{ scale: 1, opacity: 0.5 }}
                        animate={{ scale: 2.3, opacity: 0 }}
                        transition={{ duration: 2.4, delay, ease: "easeOut", repeat: Infinity }}
                        aria-hidden="true"
                      />
                    ))}
                  </>
                )}

                <button
                  type="button"
                  onClick={toggle}
                  aria-pressed={isPlaying}
                  aria-label={
                    isPlaying
                      ? t("dashboard.artist.welcome.tone_stop", "Wycisz ton")
                      : t("dashboard.artist.welcome.tone_cta", "Zagraj ton A")
                  }
                  className={cn(
                    "group relative grid h-32 w-32 place-items-center rounded-full border transition-[transform,background-color,border-color] duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                    isPlaying
                      ? "scale-105 border-ethereal-gold/60 bg-ethereal-gold/15 shadow-glass-ethereal-hover"
                      : "border-ethereal-incense/30 bg-white/60 shadow-glass-ethereal hover:scale-105 hover:border-ethereal-gold/50 hover:bg-ethereal-gold/8 active:scale-100",
                  )}
                >
                  {/* The pitch made visible: the letter of the tone itself. */}
                  <span
                    className={cn(
                      "font-serif text-6xl italic leading-none transition-colors duration-500",
                      isPlaying ? "text-ethereal-gold" : "text-ethereal-gold/75 group-hover:text-ethereal-gold",
                    )}
                    aria-hidden="true"
                  >
                    a
                  </span>
                </button>
              </div>

              <Eyebrow color="gold" as="p" className="mt-5 tracking-[0.16em]">
                {t("dashboard.artist.welcome.tone_label", "Kamerton · A 440 Hz")}
              </Eyebrow>
              <Text size="xs" color="muted" className="mt-1.5">
                {isPlaying
                  ? t(
                      "dashboard.artist.welcome.tone_playing",
                      "Brzmi… dotknij, by wyciszyć.",
                    )
                  : t(
                      "dashboard.artist.welcome.tone_hint",
                      "Dotknij, by usłyszeć ton, od którego zaczyna się każda próba.",
                    )}
              </Text>

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
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

WelcomeMoment.displayName = "WelcomeMoment";
