/**
 * @file NotifyChoirButton.tsx
 * @description "Powiadom chór": tells a project's live cast which pieces carry
 * choir marks they have not been told about. The choir is never told on its own,
 * so this button is the only way a mark becomes news outside the app.
 *
 * It names how many pieces it would send and is disabled when there are none,
 * when nobody in the cast can receive it, or while the cooldown after the last
 * notice runs. Sending pages the whole choir, so it takes two taps: the first
 * says how many people will hear, the second sends.
 *
 * Two surfaces: `page` for the book cockpit and the project's materials, and
 * `chrome` for the annotation toolbar over a score. Mount it only for a reader
 * who may press it (a manager or the podium conductor); the server refuses
 * everyone else.
 * @module features/annotations/components
 */

import React, { useEffect, useState } from "react";
import { Check, Megaphone } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";

import { useMarksNews, useNotifyChoir } from "../api/choirMarks.queries";

interface NotifyChoirButtonProps {
  projectId: string;
  surface: "page" | "chrome";
  className?: string;
}

/** How long a first tap stays armed before it lets go on its own. */
const ARMED_MS = 3500;

export const NotifyChoirButton = ({
  projectId,
  surface,
  className,
}: NotifyChoirButtonProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const { data: news } = useMarksNews(projectId, true);
  const notify = useNotifyChoir(projectId);
  const [armed, setArmed] = useState(false);
  // Re-rendered once when the cooldown runs out, so the button wakes up on
  // its own instead of waiting for the next read of the news.
  const [, setCooldownOver] = useState(0);
  const cooldownEnd = news?.next_allowed_at ? new Date(news.next_allowed_at).getTime() : 0;

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), ARMED_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  useEffect(() => {
    const wait = cooldownEnd - Date.now();
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setCooldownOver((n) => n + 1), wait + 250);
    return () => window.clearTimeout(timer);
  }, [cooldownEnd]);

  if (!news) return null;

  const pieceCount = news.pieces.length;
  const coolingDown = cooldownEnd > Date.now();
  const reason = coolingDown
    ? t("annotations.notify.cooling_down")
    : pieceCount === 0
      ? t("annotations.notify.nothing_new")
      : news.recipients === 0
        ? t("annotations.notify.nobody")
        : null;
  const disabled = reason !== null || notify.isPending;
  const titles = news.pieces.map((piece) => piece.title).join(", ");
  const label = armed
    ? t("annotations.notify.confirm", { count: news.recipients })
    : t("annotations.notify.cta");

  const press = (): void => {
    if (disabled) return;
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
        disabled={disabled}
        aria-label={label}
        title={reason ?? titles}
        className={cn(
          "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-40",
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
        <span className={cn(!armed && "hidden sm:inline")}>{label}</span>
        {!armed && pieceCount > 0 && (
          <span className="rounded-full bg-ethereal-gold/90 px-1.5 text-[10px] font-semibold text-surface-inverse">
            {pieceCount}
          </span>
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
        disabled={disabled}
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
