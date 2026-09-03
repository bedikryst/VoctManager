/**
 * @file SittingClosure.tsx
 * @description "I have finished" — the desk's only way of telling the publisher
 * anything, and deliberately not a submit button.
 *
 * The desk autosaves, so the work is on the server before this is ever pressed,
 * and the digest goes out on the clock thirty minutes after the last keystroke
 * whether or not anybody finds this control. What it buys is the half the clock
 * cannot give: the editor learns that their evening arrived somewhere. That
 * asymmetry is the whole design — an unnoticed accelerator costs a little time,
 * where an unnoticed SUBMIT would leave a finished sitting sitting unseen.
 *
 * It appears only once this visit has actually written something, and comes
 * back if the editor carries on writing after pressing it: work nobody has been
 * told about is the exception the button exists for, and an offer that is
 * always on screen is a control nobody reads.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/components/SittingClosure
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Send } from "lucide-react";

import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";

import { useNotifyReviewers } from "../api/copydesk.queries";
import { useCopyDeskSitting } from "../model/sittingStore";

export const SittingClosure = (): React.JSX.Element | null => {
  const { t } = useTranslation();
  const edits = useCopyDeskSitting((state) => state.edits);
  const announced = useCopyDeskSitting((state) => state.announced);
  const noteAnnounced = useCopyDeskSitting((state) => state.noteAnnounced);
  const notify = useNotifyReviewers();

  if (edits === 0) return null;

  if (edits === announced) {
    return (
      <Badge variant="success" icon={<Check size={12} aria-hidden="true" />}>
        {t("copy_desk.sitting.announced", "Zgłoszone")}
      </Badge>
    );
  }

  const raiseDigest = (): void => {
    notify.mutate(undefined, {
      onSuccess: (result) => {
        noteAnnounced();
        if (result.proposals === 0) {
          toast.success(
            t(
              "copy_desk.sitting.nothing_new",
              "Wydawca wie już o wszystkim, co tu zapisałeś.",
            ),
          );
          return;
        }
        toast.success(
          t("copy_desk.sitting.sent", {
            count: result.proposals,
            defaultValue: "Wydawca dostał zestawienie: {{count}} zmian.",
          }),
        );
      },
      // The words are safe whatever happens here — they were saved as they were
      // typed — so a failed digest is a delay, not a loss, and it says so.
      onError: () =>
        toast.error(
          t(
            "copy_desk.sitting.failed",
            "Nie udało się powiadomić teraz. Zmiany są zapisane i tak trafią do wydawcy.",
          ),
        ),
    });
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      isLoading={notify.isPending}
      leftIcon={<Send size={13} aria-hidden="true" />}
      onClick={raiseDigest}
    >
      {t("copy_desk.sitting.finish", "Skończyłem")}
    </Button>
  );
};
