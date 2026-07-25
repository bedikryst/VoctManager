/**
 * @file ProjectInvitationToasts.tsx
 * @description Centre-stage invitation prompt. A project invitation needs a
 * DECISION (accept/decline), so it is presented as a scrimmed, centred modal —
 * not a corner toast that is easy to miss. Dismissible (X / click-scrim / Esc):
 * dismissing only defers the decision for this session; the invitation is still
 * unread, so it resurfaces on the next load (and stays reachable from the
 * notification centre / schedule). Multiple pending invitations are shown one at
 * a time as a queue. The queue/decision logic is shared with the first-run
 * WelcomeMoment via useProjectInvitationQueue; this modal stays silent while the
 * chorister's welcome ceremony owns the screen (it presents the invitation
 * itself), so the two takeovers never double-stack. The export name is kept
 * (`ProjectInvitationToasts`) so the DashboardLayout mount point is untouched.
 * @module features/notifications/components/ProjectInvitationToasts
 */

import React, { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  Clock,
  ListMusic,
  MapPin,
  Music2,
  User as UserIcon,
  X,
} from "lucide-react";

import { useProjectInvitationQueue } from "../hooks/useProjectInvitationQueue";
import { formatEventMoment, voiceLineLabel } from "../lib/notificationFormat";
import { Caption, Text, Heading, Eyebrow } from "@/shared/ui/primitives/typography";
import { Button } from "@/shared/ui/primitives/Button";
import { useAuth } from "@/app/providers/AuthProvider";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";

export const ProjectInvitationToasts: React.FC = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { current, pendingCount, accept, decline, defer } =
    useProjectInvitationQueue();
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  useEffect(() => setMounted(true), []);

  useBodyScrollLock(!!current);

  useEffect(() => {
    if (!current) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") defer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, defer]);

  if (!mounted) return null;

  // The chorister's first-run welcome overlay presents pending invitations itself
  // (see welcome-invitation spec, Part A); showing this modal on top of the
  // ceremony double-stacks two takeovers. The role check keeps manager
  // invitations unaffected — managers reuse welcome_seen_at for the
  // (non-blocking) SeasonSetupConcierge, never this overlay.
  const welcomeOnStage =
    !user?.profile?.is_manager &&
    (user?.profile?.welcome_seen_at ?? null) === null;
  if (welcomeOnStage) return null;

  const metadata = current?.metadata;
  const rehearsals = metadata?.rehearsals ?? [];
  const program = metadata?.program ?? [];
  const voiceParts = (metadata?.voice_lines ?? [])
    .map((code) => voiceLineLabel(t, code))
    .filter(Boolean)
    .join(", ");
  const callTime = metadata
    ? formatEventMoment(
        {
          starts_at: metadata.call_time_at,
          starts_at_display: metadata.call_time_display,
          timezone: metadata.timezone,
        },
        i18n.language,
        t,
      )
    : undefined;

  return createPortal(
    <AnimatePresence>
      {current && metadata && (
        <div className="fixed inset-0 z-(--z-toast) flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ethereal-ink/55 backdrop-blur-md"
            onClick={defer}
            aria-hidden="true"
          />

          <motion.div
            key={current.notificationId}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-ethereal-gold/30 bg-ethereal-marble shadow-glass-solid"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            {/* Gold accent rail — reads as "important / a decision is waiting". */}
            <div className="h-1 w-full bg-linear-to-r from-ethereal-gold/70 via-ethereal-gold to-ethereal-gold/70" />

            <button
              type="button"
              onClick={defer}
              aria-label={t("common.actions.close", "Zamknij")}
              className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-full text-ethereal-graphite/50 outline-none transition-colors hover:bg-ethereal-ink/[0.05] hover:text-ethereal-ink focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
            >
              <X size={16} strokeWidth={2} aria-hidden="true" />
            </button>

            {/* The schedule can run to half a dozen rehearsals; the body scrolls
                so the decision buttons below never leave the viewport. */}
            <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-6 no-scrollbar">
              <div className="flex items-start gap-4 pr-8">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ethereal-gold/12 text-ethereal-gold">
                  <Calendar size={22} strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Eyebrow color="gold" size="caption">
                      {t("notifications.invitation_toast.title")}
                    </Eyebrow>
                    {pendingCount > 1 && (
                      <span className="rounded-full bg-ethereal-ink/[0.06] px-2 py-0.5 text-[11px] font-semibold leading-none text-ethereal-graphite/70">
                        1 / {pendingCount}
                      </span>
                    )}
                  </div>
                  <Heading
                    as="h3"
                    id={titleId}
                    size="xl"
                    weight="bold"
                    className="mt-1 leading-tight break-words"
                  >
                    {metadata.project_name}
                  </Heading>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-2xl border border-ethereal-ink/6 bg-ethereal-alabaster/70 p-4">
                <div className="flex items-center gap-2.5 text-ethereal-graphite">
                  <UserIcon size={15} className="shrink-0 text-ethereal-amethyst" aria-hidden="true" />
                  <Text size="sm">
                    {t("notifications.invitation_toast.invites", {
                      name: metadata.inviter_name || t("common.management", "Zarząd"),
                    })}
                  </Text>
                </div>
                <div className="flex items-center gap-2.5 text-ethereal-graphite">
                  <Calendar size={15} className="shrink-0 text-ethereal-sage" aria-hidden="true" />
                  <Text size="sm">{metadata.date_range}</Text>
                </div>
                <div className="flex items-center gap-2.5 text-ethereal-graphite">
                  <MapPin size={15} className="shrink-0 text-ethereal-gold" aria-hidden="true" />
                  <Text size="sm" className="truncate">
                    {metadata.location}
                  </Text>
                </div>
                {callTime && (
                  <div className="flex items-center gap-2.5 text-ethereal-graphite">
                    <Clock size={15} className="shrink-0 text-ethereal-incense" aria-hidden="true" />
                    <Text size="sm">
                      {t("notifications.invitation_toast.call_time", {
                        time: callTime,
                        defaultValue: "Zbiórka: {{time}}",
                      })}
                    </Text>
                  </div>
                )}
                {voiceParts && (
                  <div className="flex items-center gap-2.5 text-ethereal-graphite">
                    <Music2 size={15} className="shrink-0 text-ethereal-amethyst" aria-hidden="true" />
                    <Text size="sm">
                      {t("notifications.invitation_toast.your_part", {
                        parts: voiceParts,
                        defaultValue: "Twoja partia: {{parts}}",
                      })}
                    </Text>
                  </div>
                )}
                {metadata.description && (
                  <Text
                    size="xs"
                    className="mt-1 italic text-ethereal-graphite/60 line-clamp-3"
                  >
                    {metadata.description}
                  </Text>
                )}
              </div>

              {/* The rehearsals are the real price of saying yes. Under the
                  publication model this is the only message that states them
                  before the answer, so they are shown in full, not summarised. */}
              {rehearsals.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Eyebrow color="muted" size="caption">
                    {t("notifications.invitation_toast.rehearsals", {
                      count: rehearsals.length,
                      defaultValue: "Próby ({{count}})",
                    })}
                  </Eyebrow>
                  <ul className="flex flex-col gap-1.5 rounded-2xl border border-ethereal-ink/6 bg-ethereal-alabaster/70 p-3">
                    {rehearsals.map((rehearsal) => (
                      <li
                        key={rehearsal.rehearsal_id}
                        className="flex items-start gap-2.5 text-ethereal-graphite"
                      >
                        <Calendar
                          size={13}
                          className="mt-1 shrink-0 text-ethereal-sage"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <Text size="sm">
                            {formatEventMoment(rehearsal, i18n.language, t)}
                          </Text>
                          <Caption color="muted" className="block truncate">
                            {[
                              rehearsal.location,
                              rehearsal.focus,
                              rehearsal.is_mandatory === false
                                ? t(
                                    "notifications.invitation_toast.optional",
                                    "nieobowiązkowa",
                                  )
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Caption>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {program.length > 0 && (
                <div className="flex items-start gap-2.5 text-ethereal-graphite">
                  <ListMusic
                    size={15}
                    className="mt-0.5 shrink-0 text-ethereal-incense"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <Eyebrow color="muted" size="caption">
                      {t("notifications.invitation_toast.program", "Program")}
                    </Eyebrow>
                    <Text size="sm" className="mt-0.5">
                      {program.join(" · ")}
                    </Text>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-ethereal-incense/15 bg-ethereal-alabaster px-6 py-4">
              <Button
                variant="ghost"
                onClick={decline}
                className="flex-1 text-ethereal-crimson hover:bg-ethereal-crimson/10"
              >
                {t("notifications.invitation_toast.decline")}
              </Button>
              <Button variant="primary" onClick={accept} className="flex-1">
                {t("notifications.invitation_toast.accept")}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
