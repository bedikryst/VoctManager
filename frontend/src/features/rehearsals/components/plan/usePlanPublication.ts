/**
 * @file usePlanPublication.ts
 * @description Where a saved plan stands with the choir, and the send that
 * moves it: shared by the plan's read view and its editor, so the caption and
 * the "Wyślij" button cannot disagree between the two faces of one band. A
 * saved plan is a draft the choir does not see until it is sent (or until
 * the evening starts). Every send goes out at once; what a caption or a
 * toast may claim is what the server says became of the notice
 * (`delivery`), never "sent" for one that waits or was dropped.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/usePlanPublication
 */

import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { toastApiError } from "@/shared/api/errors";
import { formatLocalizedDateTime } from "@/shared/lib/time/intl";
import type { Rehearsal } from "@/shared/types";
import { useAnnouncePlan } from "../../api/plan.queries";
import { isChangedSinceSend } from "../../lib/planPublication";
import type {
  PlanDelivery,
  RehearsalPlanAnnounced,
  RehearsalPlanRead,
} from "../../types/rehearsalPlan.dto";

export interface PlanPublicationCaption {
  readonly text: string;
  /** Something the conductor may want to act on: unsent changes, or a notice that did not go. */
  readonly attention: boolean;
}

export interface PlanPublication {
  readonly isPublished: boolean;
  /** From the downbeat the plan is the evening's record: public, and no longer sent. */
  readonly hasStarted: boolean;
  /** The choir sees the saved plan — it was sent, or the evening has started. */
  readonly isPublic: boolean;
  /**
   * A saved plan the cast has not been sent as it stands, before the downbeat.
   * An editor holding unsaved rows sends from its save bar instead.
   */
  readonly canSend: boolean;
  /** "Wyślij plan", or "Wyślij zmiany" once a send went out. */
  readonly sendLabel: string;
  readonly isSending: boolean;
  /** Null while there is nothing to say: no saved rows, or a read older than `delivery`. */
  readonly caption: PlanPublicationCaption | null;
  /**
   * Announces the saved plan and toasts what became of the notice. False when
   * the server refused it (the toast says so). `wasPublished` is read before a
   * save that precedes the send, so the toast names the act the conductor took.
   */
  readonly send: (wasPublished?: boolean) => Promise<boolean>;
}

export const usePlanPublication = (
  rehearsal: Rehearsal,
  plan: RehearsalPlanRead | undefined,
): PlanPublication => {
  const { t, i18n } = useTranslation();
  const announce = useAnnouncePlan(String(rehearsal.id));

  const announcedAt = plan?.plan_announced_at ?? null;
  const changedAt = plan?.plan_changed_at ?? null;
  // A read restored from a cache older than the field carries none, and a
  // guess would be the false "wysłano" this field exists to end: the caption
  // waits for the refetch instead.
  const delivery: PlanDelivery | null = plan?.delivery ?? null;
  const savedRows = plan?.rows.length ?? 0;
  const isPublished = announcedAt !== null;
  // A plan announced after the downbeat reaches phones already in the room —
  // the server refuses it, and so does the button.
  const hasStarted = new Date(rehearsal.date_time).getTime() <= Date.now();
  // From the downbeat a tick bumps `plan_changed_at`, so "changed since the
  // send" would flag every debriefed evening; it is said before it only, as
  // the rail says it (`planStateOf`).
  const changedSinceSend = !hasStarted && isChangedSinceSend(announcedAt, changedAt);

  const deliveryCaption = (when: string): string => {
    switch (delivery) {
      case "queued":
        return t(
          "rehearsals.plan.delivery.queued",
          "Opublikowany {{when}} · powiadomienie czeka na ogłoszenie tej próby",
          { when },
        );
      case "withheld":
        return t(
          "rehearsals.plan.delivery.withheld",
          "Opublikowany {{when}} · projekt jest szkicem, więc nikt nie dostał powiadomienia",
          { when },
        );
      case "discarded":
        return t(
          "rehearsals.plan.delivery.discarded",
          "Opublikowany {{when}} · powiadomienie odrzucono w kolejce ogłoszeń",
          { when },
        );
      default:
        return t("rehearsals.plan.delivery.sent", "Opublikowany · wysłano {{when}}", { when });
    }
  };

  // Who can see it, what became of the last send, and whether the rows moved
  // since. A caption, never a prompt: the decision to send again is the
  // conductor's.
  let caption: PlanPublicationCaption | null = null;
  if (announcedAt) {
    if (delivery) {
      const when = formatLocalizedDateTime(
        announcedAt,
        { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
        i18n.language,
        rehearsal.timezone,
      );
      caption = {
        text: changedSinceSend
          ? t("rehearsals.plan.changed_since_send", "{{state}} · zmieniony po wysłaniu", {
              state: deliveryCaption(when),
            })
          : deliveryCaption(when),
        attention: changedSinceSend || delivery !== "sent",
      };
    }
  } else if (savedRows > 0 && !hasStarted) {
    caption = { text: t("rehearsals.plan.draft", "Szkic — chór go nie widzi"), attention: false };
  }

  // A send waits only behind the evening's own unannounced creation, which a
  // manager publishes from the queue; it is never called sent.
  const deliveryMessage = (
    announced: RehearsalPlanAnnounced["delivery"],
    wasPublished: boolean,
  ): string => {
    if (announced === "withheld") {
      return t(
        "rehearsals.plan.toast.withheld",
        "Projekt jest jeszcze szkicem, więc nikt nie dostał powiadomienia. Chór zobaczy plan razem z projektem.",
      );
    }
    if (announced === "queued") {
      return wasPublished
        ? t(
            "rehearsals.plan.toast.changes_queued_with_rehearsal",
            "Zmiany wyjdą razem z ogłoszeniem tej próby.",
          )
        : t(
            "rehearsals.plan.toast.queued_with_rehearsal",
            "Plan opublikowany. Powiadomienie wyjdzie razem z ogłoszeniem tej próby.",
          );
    }
    return wasPublished
      ? t("rehearsals.plan.toast.changes_sent", "Zmiany wysłane do wezwanych.")
      : t("rehearsals.plan.toast.published", "Plan opublikowany i wysłany do wezwanych.");
  };

  const send = async (wasPublished: boolean = isPublished): Promise<boolean> => {
    try {
      const announced = await announce.mutateAsync();
      toast.success(deliveryMessage(announced.delivery, wasPublished));
      return true;
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t("rehearsals.plan.toast.announce_error", "Nie udało się wysłać planu."),
      });
      return false;
    }
  };

  return {
    isPublished,
    hasStarted,
    isPublic: isPublished || hasStarted,
    canSend: savedRows > 0 && !hasStarted && (!isPublished || changedSinceSend),
    sendLabel: isPublished
      ? t("rehearsals.plan.send_changes", "Wyślij zmiany")
      : t("rehearsals.plan.send", "Wyślij plan"),
    isSending: announce.isPending,
    caption,
    send,
  };
};
