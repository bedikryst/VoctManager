/**
 * @file WelcomeMoment.tsx
 * @description The chorister's first crossing into their home — shown once, ever,
 * PER ACCOUNT (the "seen" flag lives on the server, so a borrowed phone still
 * earns the welcome and a member who dismissed it on a laptop won't see it again
 * on a phone). Not a tutorial and not a coach-mark overlay (both die on first
 * dismissal): a single full-bleed *moment* staged as the nave in full light —
 * the app's own sacred-interior scene (shaft of light, incense glows, a stave
 * drawing itself in) at ceremonial intensity, not a dimmed
 * scrim. It names the singer and their voice, and offers the kamerton at the
 * centre: the honest A every rehearsal starts from (tap to ring, tap to
 * silence), never a synthesised stand-in for "how the ensemble sounds". Any
 * setup nudges (install, finish configuration) sit quietly below the ceremony —
 * offered after the warmth, never as a wall of permission asks before it.
 *
 * When the vocal-range prompt is owed next, the welcome does not fade out to
 * the dashboard. Its words leave at once, the scene stays until the refreshed
 * user lets the prompt open, and the prompt's words arrive over the same lit
 * scene. Fading the whole moment first would flash the dashboard for the
 * length of a round trip; holding the words until then would cut them.
 * @module features/dashboard/components/WelcomeMoment
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { artistRoleLabel } from "@/shared/lib/voiceTypes";
import type { VoiceType } from "@/shared/types";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Calendar, Download, MapPin, Settings, Sparkles } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/app/providers/AuthProvider";
import { BodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { useFocusTrap } from "@/shared/lib/dom/useFocusTrap";
import { EASE } from "@/shared/ui/kinematics/motion-presets";
import { NaveScene } from "@/shared/ui/kinematics/NaveScene";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { ACCENT_BADGE } from "@/shared/ui/primitives/accents";
import { Eyebrow } from "@/shared/ui/primitives/typography/Eyebrow";
import { Heading } from "@/shared/ui/primitives/typography/Heading";
import { Text } from "@/shared/ui/primitives/typography/Text";
import { useWelcomeTone } from "@/shared/ui/instruments/useWelcomeTone";
import { useProjectInvitationQueue } from "@/features/notifications/hooks/useProjectInvitationQueue";
import { useInstallPrompt } from "@/shared/pwa/useInstallPrompt";
import { getSectionPresentation } from "@/features/artists/constants/voiceSections";
import { settingsService } from "@/features/settings/api/settings.service";
import { isVocalRangePromptPending } from "@/features/vocal-range/hooks/useVocalRangePromptDue";

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
  const invitation = useProjectInvitationQueue();
  const { canPrompt, isInstalled, promptInstall } = useInstallPrompt();
  const reduceMotion = useReducedMotion() ?? false;
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // The flag is server-authoritative: null = the member has never completed the
  // welcome on any device. Local `dismissed` only smooths the exit animation.
  const seenAt = user?.profile?.welcome_seen_at ?? null;
  const show = Boolean(user) && seenAt === null && !dismissed;
  const handsOver = isVocalRangePromptPending(user);
  const handingOver = leaving && handsOver;

  useFocusTrap(dialogRef, show && mounted);

  const dismiss = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    // The component stays mounted through the exit animation, so a ringing
    // kamerton must be silenced explicitly — unmount cleanup never fires here.
    stop();
    // With the prompt to follow, only the words leave now: the scene stays up
    // until the refreshed user closes it and opens the prompt in the same
    // render. Without one it fades at once.
    if (!handsOver) setDismissed(true);
    // Stamp it once, server-side, then settle the in-memory user so a remount
    // doesn't greet again. The local dismissal closes whatever is left: an
    // empty scene if the refresh brought no new user, the whole welcome if the
    // stamp failed. The flag simply gets another chance next session.
    void settingsService
      .markWelcomeSeen()
      .then(() => refreshUser())
      .then(() => setDismissed(true))
      .catch(() => setDismissed(true));
  }, [handsOver, leaving, refreshUser, stop]);

  const voiceType = user?.voice_type ?? null;
  const voicePresentation = getSectionPresentation(voiceType);
  const voiceLabel = voiceType
    ? artistRoleLabel(t, voiceType as VoiceType, user?.instrument)
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
          ref={dialogRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: EASE.buttery }}
          className="fixed inset-0 z-focus-trap outline-none"
          role="dialog"
          aria-modal="true"
          aria-label={t("dashboard.artist.welcome.eyebrow", "Witamy w zespole")}
          // Takes a click on its bare scene, so focus never drops to the page
          // behind and out of the focus trap's reach.
          tabIndex={-1}
        >
          <BodyScrollLock />
          <NaveScene isToneRinging={isPlaying} reduceMotion={reduceMotion} />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={dismiss}
            className={cn(
              "absolute right-5 top-5 z-20 transition-opacity duration-300",
              handingOver && "pointer-events-none opacity-0",
            )}
          >
            {t("dashboard.artist.welcome.overlay_skip", "Pomiń")}
          </Button>

          {/* Scroll region separate from the scene: on a short viewport the
              words scroll, the light stays. `m-auto` (not items-center) so an
              overflowing column never clips its own first line. */}
          <div className="relative z-10 flex h-full overflow-y-auto px-5 py-10">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 22 }}
              animate={
                handingOver
                  ? {
                      opacity: 0,
                      y: reduceMotion ? 0 : -8,
                      transition: { duration: 0.35, ease: EASE.buttery },
                    }
                  : { opacity: 1, y: 0 }
              }
              transition={{ duration: 0.8, delay: 0.1, ease: EASE.buttery }}
              className={cn(
                "m-auto flex w-full max-w-xl flex-col items-center text-center",
                handingOver && "pointer-events-none",
              )}
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
                <span className="mt-5 inline-flex items-center gap-2">
                  <Eyebrow color="muted">
                    {t("dashboard.artist.welcome.voice_label", "Twój głos")}
                  </Eyebrow>
                  <Badge
                    casing="natural"
                    variant={
                      voicePresentation
                        ? ACCENT_BADGE[voicePresentation.accent]
                        : "outline"
                    }
                  >
                    {voiceLabel}
                  </Badge>
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
                      : "border-ethereal-incense/30 bg-ethereal-marble/60 shadow-glass-ethereal hover:scale-105 hover:border-ethereal-gold/50 hover:bg-ethereal-gold/8 active:scale-100",
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

              <Eyebrow color="gold" as="p" className="mt-5">
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

              {/* ── A pending concert invitation, offered as an act inside the
                  ceremony — not a second takeover stacked on top of it. Quiet,
                  in the overlay's own language; full details stay one tap away in
                  the panel afterwards. ── */}
              {invitation.current && (
                <div className="mt-8 w-full max-w-md rounded-surface border border-ethereal-gold/30 bg-ethereal-marble/55 p-4 text-left shadow-glass-ethereal">
                  <div className="flex items-center gap-2">
                    <Eyebrow color="gold">
                      {t(
                        "dashboard.artist.welcome.invitation.eyebrow",
                        "Czeka na Ciebie zaproszenie",
                      )}
                    </Eyebrow>
                    {invitation.pendingCount > 1 && (
                      <Badge variant="neutral" casing="natural" className="tabular-nums">
                        1 / {invitation.pendingCount}
                      </Badge>
                    )}
                  </div>

                  <Heading
                    as="h2"
                    size="xl"
                    weight="bold"
                    className="mt-1 leading-tight break-words"
                  >
                    {invitation.current.metadata.project_name}
                  </Heading>

                  {(invitation.current.metadata.date_range ||
                    invitation.current.metadata.location) && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {invitation.current.metadata.date_range && (
                        <div className="flex items-center gap-2.5 text-ethereal-graphite">
                          <Calendar
                            size={15}
                            className="shrink-0 text-ethereal-sage"
                            aria-hidden="true"
                          />
                          <Text size="sm">
                            {invitation.current.metadata.date_range}
                          </Text>
                        </div>
                      )}
                      {invitation.current.metadata.location && (
                        <div className="flex items-center gap-2.5 text-ethereal-graphite">
                          <MapPin
                            size={15}
                            className="shrink-0 text-ethereal-gold"
                            aria-hidden="true"
                          />
                          <Text size="sm" className="truncate">
                            {invitation.current.metadata.location}
                          </Text>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="touch"
                      onClick={invitation.decline}
                      className="flex-1 text-ethereal-crimson hover:bg-ethereal-crimson/10"
                    >
                      {t("notifications.invitation_toast.decline")}
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="touch"
                      onClick={invitation.accept}
                      className="flex-1"
                    >
                      {t("notifications.invitation_toast.accept")}
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    fullWidth
                    onClick={invitation.defer}
                    className="mt-2"
                  >
                    {t(
                      "dashboard.artist.welcome.invitation.later",
                      "Zdecyduję później",
                    )}
                  </Button>
                </div>
              )}

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
                    className="inline-flex items-center gap-2 rounded-full border border-ethereal-incense/25 bg-ethereal-marble/40 px-4 py-2 text-xs font-semibold text-ethereal-graphite transition-colors hover:border-ethereal-gold/45 hover:text-ethereal-ink"
                  >
                    <Download size={14} strokeWidth={2} className="text-ethereal-gold" aria-hidden="true" />
                    {t("dashboard.artist.welcome.install_cta", "Zainstaluj aplikację")}
                  </button>
                )}
                <Link
                  to="/panel/settings"
                  onClick={dismiss}
                  className="group inline-flex items-center gap-2 rounded-full border border-dashed border-ethereal-incense/30 bg-ethereal-marble/25 px-4 py-2 text-xs font-semibold text-ethereal-graphite transition-colors hover:border-ethereal-gold/40 hover:text-ethereal-ink"
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
