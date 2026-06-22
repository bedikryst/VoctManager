/**
 * @file WelcomeMoment.tsx
 * @description The chorister's first crossing into their home — shown once, ever,
 * PER ACCOUNT (not per device): the "seen" flag lives on the server, so signing
 * in for the first time on a borrowed phone still earns the welcome, and a member
 * who dismissed it on their laptop won't see it again on their phone. Not a
 * tutorial and not a coach-mark overlay (both die on first dismissal): one warm
 * card that names the singer and their voice, plays a soft "chord of welcome" on
 * tap (the ensemble finding its pitch), points at the three surfaces that matter,
 * and offers a quiet, secondary nudge into Settings.
 * @module features/dashboard/components/WelcomeMoment
 */

import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookMarked,
  CalendarClock,
  Music2,
  Settings,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/app/providers/AuthProvider";
import { EASE } from "@/shared/ui/kinematics/motion-presets";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow } from "@/shared/ui/primitives/typography/Eyebrow";
import { Heading } from "@/shared/ui/primitives/typography/Heading";
import { Text } from "@/shared/ui/primitives/typography/Text";
import { useWelcomeChord } from "@/shared/ui/instruments/useWelcomeChord";
import {
  getSectionPresentation,
  type SectionPresentation,
} from "@/features/artists/constants/voiceSections";
import { settingsService } from "@/features/settings/api/settings.service";
import { QuickTile } from "./QuickTile";

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
}: WelcomeMomentProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { play, isPlaying } = useWelcomeChord();
  const [dismissed, setDismissed] = useState(false);

  // The flag is server-authoritative: null = the member has never completed the
  // welcome on any device. Local `dismissed` only smooths the exit animation.
  const seenAt = user?.profile?.welcome_seen_at ?? null;
  const show = Boolean(user) && seenAt === null && !dismissed;

  const dismiss = useCallback(() => {
    setDismissed(true);
    // Stamp it once, server-side, then settle the in-memory user so a remount
    // (navigating away and back) doesn't greet again. On failure we keep the
    // local dismissal; the flag simply gets another chance next session.
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

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="welcome-moment"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.7, ease: EASE.buttery }}
        >
          <GlassCard variant="ethereal" padding="lg" glow isHoverable={false} className="relative overflow-hidden">
            {/* A breath of gold along the top edge — the "stage light". */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-ethereal-gold/60 to-transparent"
              aria-hidden="true"
            />

            <button
              type="button"
              onClick={dismiss}
              aria-label={t("common.actions.close", "Zamknij")}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-ethereal-graphite/45 transition-colors hover:bg-ethereal-graphite/[0.06] hover:text-ethereal-ink"
            >
              <X size={16} strokeWidth={2} aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-ethereal-gold" aria-hidden="true" />
              <Eyebrow color="gold" as="p">
                {t("dashboard.artist.welcome.eyebrow", "Witamy w zespole")}
              </Eyebrow>
            </div>

            <Heading as="h2" size="3xl" color="default" className="mt-3 leading-tight">
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
                  "mt-3 inline-flex items-center gap-2 rounded-full border bg-white/40 px-3 py-1",
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

            <Text size="sm" color="graphite" className="mt-3 max-w-xl leading-7">
              {t(
                "dashboard.artist.welcome.intro",
                "To Twoja przestrzeń: zobaczysz tu najbliższą próbę, przećwiczysz swoją partię i potwierdzisz obecność. Zacznij od jednego z trzech miejsc poniżej.",
              )}
            </Text>

            {/* The chord of welcome — tap to hear the ensemble find its pitch. */}
            <button
              type="button"
              onClick={play}
              aria-label={t("dashboard.artist.welcome.chord_cta", "Usłysz swój zespół")}
              className={cn(
                "group mt-5 inline-flex items-center gap-2.5 rounded-full border px-4 py-2 transition-colors",
                isPlaying
                  ? "border-ethereal-gold/60 bg-ethereal-gold/10"
                  : "border-ethereal-incense/25 bg-white/40 hover:border-ethereal-gold/45 hover:bg-ethereal-gold/[0.06]",
              )}
            >
              <Volume2
                size={16}
                strokeWidth={2}
                className={cn(
                  "shrink-0 transition-transform",
                  isPlaying ? "animate-pulse text-ethereal-gold" : "text-ethereal-gold/80 group-hover:scale-110",
                )}
                aria-hidden="true"
              />
              <Eyebrow color={isPlaying ? "gold" : "muted"} as="span" className="tracking-[0.16em]">
                {isPlaying
                  ? t("dashboard.artist.welcome.chord_playing", "Brzmi…")
                  : t("dashboard.artist.welcome.chord_cta", "Usłysz swój zespół")}
              </Eyebrow>
            </button>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <QuickTile
                to="/panel/materials"
                Icon={Music2}
                accent="sage"
                label={t("dashboard.artist.tools.songbook", "Śpiewnik")}
                hint={t("dashboard.artist.tools.songbook_hint", "Nuty i audio")}
              />
              <QuickTile
                to="/panel/schedule"
                Icon={CalendarClock}
                accent="incense"
                label={t("dashboard.artist.tools.schedule", "Harmonogram")}
                hint={t("dashboard.artist.tools.schedule_hint", "Próby i koncerty")}
              />
              <QuickTile
                to="/panel/resources"
                Icon={BookMarked}
                accent="amethyst"
                label={t("dashboard.artist.tools.my_card", "Moja Karta")}
                hint={t("dashboard.artist.tools.my_card_hint", "Zespół i niezbędnik")}
              />
            </div>

            {/* Subordinate, optional nudge into Settings — deliberately lighter
                than the three tiles (dashed, low-fill) so it points without
                competing for the first action. */}
            <Link
              to="/panel/settings"
              className="group mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-ethereal-incense/30 bg-white/25 px-4 py-3 transition-colors hover:border-ethereal-gold/40 hover:bg-ethereal-gold/[0.04]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-ethereal-incense/20 text-ethereal-graphite/55 transition-colors group-hover:text-ethereal-gold">
                <Settings size={18} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <Text size="sm" weight="bold" className="block leading-tight">
                  {t("dashboard.artist.welcome.settings_cta", "Dokończ konfigurację")}
                </Text>
                <Eyebrow color="muted" className="mt-0.5 block">
                  {t(
                    "dashboard.artist.welcome.settings_desc",
                    "Powiadomienia o próbach · synchronizacja kalendarza · zdjęcie profilowe",
                  )}
                </Eyebrow>
              </span>
              <ArrowRight
                size={16}
                strokeWidth={2}
                className="shrink-0 text-ethereal-graphite/40 transition-transform group-hover:translate-x-0.5 group-hover:text-ethereal-gold"
                aria-hidden="true"
              />
            </Link>

            <div className="mt-6 flex justify-end">
              <Button type="button" variant="primary" size="touch" onClick={dismiss}>
                {t("dashboard.artist.welcome.dismiss", "Zaczynam")}
              </Button>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

WelcomeMoment.displayName = "WelcomeMoment";
