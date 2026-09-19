/**
 * @file DelegationBriefingModal.tsx
 * @description The moment somebody learns they are running a rehearsal in the
 * conductor's place — and what that actually opens for them.
 *
 * Same stage as the concert invitation, deliberately: it arrives from outside
 * whatever the member was doing, so it is a scrimmed centre-stage takeover on
 * `z-toast` rather than a corner toast easy to miss. Where it parts company with
 * the invitation is the footer. An invitation waits for a DECISION and so has
 * two answers; a delegation has already happened, so there is one way forward
 * and a quieter way to close — a pair of equal buttons here would be two slabs
 * shouting the same volume at somebody who has nothing to choose.
 *
 * The body is a list of what was granted and nothing else. A withheld scope
 * renders no row: the row IS the permission, and there is no greyed-out version
 * of a door that is locked. One sentence at the foot states the boundary, once,
 * because "you are running the rehearsal" is easily heard as "you are now a
 * manager of this project" — and that is exactly what it is not.
 * @module features/notifications/components
 */

import React, { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarClock,
  ClipboardCheck,
  FileMusic,
  Hourglass,
  Info,
  PencilLine,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";

import { useDelegationBriefingQueue } from "../hooks/useDelegationBriefingQueue";
import { useProjectInvitationQueue } from "../hooks/useProjectInvitationQueue";
import { formatEventMoment } from "../lib/notificationFormat";

/** One granted scope, as the briefing states it. */
interface ScopeRow {
  key: string;
  Icon: typeof UserCheck;
  title: string;
  body: string;
}

export const DelegationBriefingModal: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { current, pendingCount, acknowledge, defer } =
    useDelegationBriefingQueue();
  // An invitation is a question waiting for an answer; this is an instruction.
  // The question goes first, and this one waits its turn rather than stacking a
  // second takeover on top of it.
  const { current: invitationOnStage } = useProjectInvitationQueue();
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  useEffect(() => setMounted(true), []);

  const onStage = !!current && !invitationOnStage;
  useBodyScrollLock(onStage);

  useEffect(() => {
    if (!onStage) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") defer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onStage, defer]);

  if (!mounted) return null;

  const metadata = current?.metadata;
  const nextRehearsal = metadata?.next_rehearsal ?? null;
  const nextMoment = nextRehearsal
    ? formatEventMoment(nextRehearsal, i18n.language, t)
    : undefined;

  const openSchedule = (): void => {
    acknowledge();
    navigate(
      nextRehearsal
        ? `/panel/schedule/lead/${nextRehearsal.rehearsal_id}`
        : "/panel/schedule",
    );
  };

  // Only what was actually granted. Order runs from the thing that changes how
  // they prepare, through what they will do in the room, to what they can open.
  const scopes: ScopeRow[] = [];
  if (metadata?.can_see_leader_marks) {
    scopes.push({
      key: "marks",
      Icon: PencilLine,
      title: t("notifications.delegation.scope_marks", "Oznaczenia dyrygenta"),
      body: t(
        "notifications.delegation.scope_marks_body",
        "Na nutach tego projektu zobaczysz wskazówki, które dyrygent zapisał dla prowadzącego próbę. Nikt inny w chórze ich nie widzi.",
      ),
    });
  }
  if (metadata?.can_take_roll_call) {
    scopes.push({
      key: "roll_call",
      Icon: ClipboardCheck,
      title: t("notifications.delegation.scope_roll_call", "Obecność"),
      body: t(
        "notifications.delegation.scope_roll_call_body",
        "Odhaczysz obecność na próbach tego projektu — także za innych śpiewaków.",
      ),
    });
  }
  if (metadata?.can_open_materials) {
    scopes.push({
      key: "materials",
      Icon: FileMusic,
      title: t("notifications.delegation.scope_materials", "Materiały"),
      body: t(
        "notifications.delegation.scope_materials_body",
        "Otworzysz nuty i program projektu, nawet jeśli sam w nim nie śpiewasz.",
      ),
    });
  }
  if (metadata?.can_mark_for_choir) {
    scopes.push({
      key: "choir_marks",
      Icon: Users,
      title: t("notifications.delegation.scope_choir_marks", "Uwagi dla chóru"),
      body: t(
        "notifications.delegation.scope_choir_marks_body",
        "To, co napiszesz na warstwie „Widoczne dla chóru”, zobaczy każdy śpiewak tego projektu — tak jak uwagi dyrygenta.",
      ),
    });
  }

  return createPortal(
    <AnimatePresence>
      {onStage && metadata && (
        <div className="fixed inset-0 z-toast flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/55 backdrop-blur-md"
            onClick={defer}
            aria-hidden="true"
          />

          <motion.div
            key={current.notificationId}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="relative flex w-full max-w-md flex-col overflow-hidden rounded-surface border border-ethereal-amethyst/30 bg-ethereal-marble shadow-glass-solid"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            {/* Amethyst rail, the hue the leader layer already wears on the
                score — the one place this person meets the delegation again. */}
            <div className="h-1 w-full bg-linear-to-r from-ethereal-amethyst/70 via-ethereal-amethyst to-ethereal-amethyst/70" />

            <button
              type="button"
              onClick={defer}
              aria-label={t("common.actions.close", "Zamknij")}
              className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-full text-ethereal-graphite/50 outline-none transition-colors hover:bg-ethereal-ink/5 hover:text-ethereal-ink focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
            >
              <X size={16} strokeWidth={2} aria-hidden="true" />
            </button>

            <div className="no-scrollbar flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-6">
              <div className="flex items-start gap-4 pr-8">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-control bg-ethereal-amethyst/12 text-ethereal-amethyst">
                  <UserCheck size={22} strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Eyebrow color="amethyst">
                      {t("notifications.delegation.eyebrow", "Jesteś liderem projektu")}
                    </Eyebrow>
                    {pendingCount > 1 && (
                      <Caption color="muted" className="tabular-nums">
                        1 / {pendingCount}
                      </Caption>
                    )}
                  </div>
                  <Heading
                    as="h3"
                    id={titleId}
                    size="xl"
                    weight="bold"
                    className="mt-1 leading-tight wrap-break-word"
                  >
                    {metadata.project_name}
                  </Heading>
                  <Text as="p" size="sm" color="muted" className="mt-1">
                    {metadata.granted_by_name
                      ? t("notifications.delegation.asked_by_lede", {
                          name: metadata.granted_by_name,
                          defaultValue:
                            "{{name}} mianował(a) Cię liderem tego projektu.",
                        })
                      : t(
                          "notifications.delegation.asked_lede",
                          "Od teraz jesteś liderem tego projektu.",
                        )}
                  </Text>
                </div>
              </div>

              {/* The conductor's own words, where he left any. */}
              {metadata.note && (
                <div className="rounded-nested border border-hairline bg-ethereal-alabaster/70 p-3">
                  <Text as="p" size="sm" className="italic">
                    {metadata.note}
                  </Text>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Eyebrow as="p" color="muted">
                  {t("notifications.delegation.opens", "Co to otwiera")}
                </Eyebrow>
                <ul className="flex flex-col gap-2.5 rounded-nested border border-hairline bg-ethereal-alabaster/70 p-4">
                  {scopes.map(({ key, Icon, title, body }) => (
                    <li key={key} className="flex items-start gap-2.5">
                      <Icon
                        size={15}
                        className="mt-0.5 shrink-0 text-ethereal-amethyst"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <Text as="p" size="sm" weight="semibold">
                          {title}
                        </Text>
                        <Caption color="muted" className="block">
                          {body}
                        </Caption>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-2">
                {nextMoment && (
                  <div className="flex items-center gap-2.5 text-ethereal-graphite">
                    <CalendarClock
                      size={15}
                      className="shrink-0 text-ethereal-sage"
                      aria-hidden="true"
                    />
                    <Text as="span" size="sm">
                      {t("notifications.delegation.next", {
                        when: nextMoment,
                        defaultValue: "Najbliższa próba: {{when}}",
                      })}
                    </Text>
                  </div>
                )}
                <div className="flex items-center gap-2.5 text-ethereal-graphite">
                  <Hourglass
                    size={15}
                    className="shrink-0 text-ethereal-incense"
                    aria-hidden="true"
                  />
                  <Text as="span" size="sm">
                    {metadata.expires_at_display
                      ? t("notifications.delegation.until", {
                          when: metadata.expires_at_display,
                          defaultValue: "Do {{when}}",
                        })
                      : t(
                          "notifications.delegation.until_close",
                          "Do zakończenia projektu",
                        )}
                  </Text>
                </div>
              </div>

              {/* The boundary, said once. "You are running the rehearsal" is
                  easily heard as "you now manage this project". */}
              <div className="flex items-start gap-2.5 rounded-nested bg-ethereal-ink/4 p-3">
                <Info
                  size={14}
                  className="mt-0.5 shrink-0 text-ethereal-graphite/60"
                  aria-hidden="true"
                />
                <Caption color="muted" className="block">
                  {t(
                    "notifications.delegation.boundary",
                    "Nie rozpatrujesz usprawiedliwień i nie edytujesz obsady — to zostaje u menedżerów.",
                  )}
                </Caption>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 border-t border-ethereal-incense/15 bg-ethereal-alabaster px-6 py-4">
              <Button variant="primary" fullWidth onClick={openSchedule}>
                {nextRehearsal
                  ? t("notifications.delegation.open_lead_sheet", "Otwórz kartę wieczoru")
                  : t("notifications.delegation.open_schedule", "Zobacz harmonogram")}
              </Button>
              <button
                type="button"
                onClick={acknowledge}
                className="rounded-md px-2 py-1 text-ethereal-graphite transition-colors hover:text-ethereal-ink"
              >
                <Text as="span" size="sm" color="inherit">
                  {t("notifications.delegation.acknowledge", "Rozumiem")}
                </Text>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
