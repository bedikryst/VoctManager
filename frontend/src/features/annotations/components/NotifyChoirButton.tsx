/**
 * @file NotifyChoirButton.tsx
 * @description "Powiadom chór": tells a project's live cast which pieces carry
 * choir marks they have not been told about. The choir is never told on its own,
 * so this button is the only way a mark becomes news outside the app.
 *
 * It names how many pieces it would send and is held back, with the reason in
 * words, when there is no network, while the cooldown after the last notice
 * runs (with the minutes left), when there is nothing new, when the new marks
 * are all for sections nobody in the cast can be told in (named), or when
 * nobody in the cast can receive it. Sending pages the whole choir, so it takes
 * two taps: the first says how many people will hear, the second sends.
 *
 * The cooldown is the server's: the button counts down from how long the
 * server said was left, on this device's clock, and when that runs out it asks
 * the server again instead of deciding by itself that the time has come.
 *
 * Two surfaces: `page` for the book cockpit and the project's materials, with
 * the reason printed under the button, and `chrome` for the annotation toolbar
 * over a score, where there is no room for a line of text — a press on a held
 * chip says why instead. Mount it only for a reader who may press it (a manager
 * or the podium conductor, never inside a member preview); the server refuses
 * everyone else.
 * @module features/annotations/components
 */

import React, { useEffect, useState } from "react";
import { Check, Megaphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useIsOnline } from "@/shared/lib/dom/useIsOnline";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";

import { useMarksNews, useNotifyChoir } from "../api/choirMarks.queries";
import { VOICE_SECTIONS } from "../lib/voices";
import { VOICE_SECTION_NAMES } from "./MarkVoicePicker";

interface NotifyChoirButtonProps {
  projectId: string;
  surface: "page" | "chrome";
  className?: string;
}

/** How long a first tap stays armed before it lets go on its own. */
const ARMED_MS = 3500;

/** How often the minutes left are redrawn while the cooldown runs. */
const COOLDOWN_TICK_MS = 15_000;

/** One toast for every held press, so a reader tapping twice reads it once. */
const REASON_TOAST_ID = "notify-choir-reason";

export const NotifyChoirButton = ({
  projectId,
  surface,
  className,
}: NotifyChoirButtonProps): React.JSX.Element | null => {
  const { t, i18n } = useTranslation();
  const isOnline = useIsOnline();
  const { data: news, dataUpdatedAt, refetch } = useMarksNews(projectId, true);
  const notify = useNotifyChoir(projectId);
  const [armed, setArmed] = useState(false);
  // Re-renders while the cooldown runs, so the minutes left keep moving.
  const [, setTick] = useState(0);
  // On this device's clock: when the answer arrived, plus what the server
  // said was left. Both ends are read off the same clock, so its error cancels.
  const cooldownEnd =
    news?.cooldown_ms != null ? dataUpdatedAt + news.cooldown_ms : 0;

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), ARMED_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  useEffect(() => {
    const wait = cooldownEnd - Date.now();
    if (wait <= 0) return;
    const tick = window.setInterval(() => setTick((n) => n + 1), COOLDOWN_TICK_MS);
    const wake = window.setTimeout(() => {
      setTick((n) => n + 1);
      void refetch();
    }, wait + 1000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(wake);
    };
  }, [cooldownEnd, refetch]);

  if (!news) return null;

  const pieceCount = news.pieces.length;
  const coolingFor = cooldownEnd - Date.now();
  // A cached answer from a server that predates the field has none to name.
  const unreachedLetters = news.unreached_sections ?? "";
  const unreached = VOICE_SECTIONS.filter((section) => unreachedLetters.includes(section));
  const unreachedNames = unreached
    .map((section) => {
      const [key, fallback] = VOICE_SECTION_NAMES[section];
      return t(key, fallback).toLocaleLowerCase(i18n.language);
    })
    .join(", ");
  const reason = !isOnline
    ? t("annotations.notify.offline")
    : coolingFor > 0
      ? t("annotations.notify.cooling_down_for", {
          count: Math.max(1, Math.ceil(coolingFor / 60_000)),
        })
      : pieceCount === 0
        ? unreached.length > 0
          ? t("annotations.notify.unreached", {
              count: unreached.length,
              voices: unreachedNames,
            })
          : t("annotations.notify.nothing_new")
        : news.recipients === 0
          ? t("annotations.notify.nobody")
          : null;
  const held = reason !== null || notify.isPending;
  const titles = news.pieces.map((piece) => piece.title).join(", ");
  const label = armed
    ? t("annotations.notify.confirm", { count: news.recipients })
    : t("annotations.notify.cta");

  const press = (): void => {
    if (reason !== null) {
      toast.info(reason, { id: REASON_TOAST_ID });
      return;
    }
    if (held) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    notify.mutate();
  };

  if (surface === "chrome") {
    return (
      <button
        type="button"
        onClick={press}
        // Held, not disabled: a disabled button takes no tap, and the tap is
        // the only way the reason reaches a reader on a tablet.
        aria-disabled={held}
        aria-label={reason ? `${label}. ${reason}` : label}
        title={reason ?? titles}
        className={cn(
          "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 transition-colors aria-disabled:opacity-40",
          armed
            ? "bg-ethereal-gold/90 text-surface-inverse"
            : "bg-ink-on-inverse/10 text-ink-on-inverse hover:bg-ink-on-inverse/20",
          className,
        )}
      >
        {armed ? (
          <Check size={14} aria-hidden="true" />
        ) : (
          <Megaphone size={14} aria-hidden="true" />
        )}
        <Text
          as="span"
          size="sm"
          weight="medium"
          color="inherit"
          className={cn(!armed && "hidden sm:inline")}
        >
          {label}
        </Text>
        {!armed && pieceCount > 0 && (
          <Text
            as="span"
            size="xs"
            weight="semibold"
            color="inherit"
            className="rounded-full bg-ethereal-gold/90 px-1.5 text-surface-inverse"
          >
            {pieceCount}
          </Text>
        )}
      </button>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Button
        variant={armed ? "primary" : "secondary"}
        size="touch"
        leftIcon={
          armed ? <Check size={14} aria-hidden="true" /> : <Megaphone size={14} aria-hidden="true" />
        }
        onClick={press}
        disabled={held}
        isLoading={notify.isPending}
        className="w-full sm:w-auto"
      >
        {armed
          ? label
          : pieceCount > 0
            ? t("annotations.notify.cta_count", { count: pieceCount })
            : label}
      </Button>
      <Text size="xs" color="muted">
        {reason ?? t("annotations.notify.pieces", { titles })}
      </Text>
    </div>
  );
};
