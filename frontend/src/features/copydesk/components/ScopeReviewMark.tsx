/**
 * @file ScopeReviewMark.tsx
 * @description "I have read this page" — the one act that writes a reader's
 * watermark, and therefore the only thing that moves a page between the two
 * halves of the contents list.
 *
 * **At the foot of the column, deliberately.** The gesture asserts that the page
 * was read, and the foot is where a reader who has actually read one is
 * standing — a control in the rail would be pressable from the first paragraph
 * and would mean nothing. The desk's other rail control (`SittingClosure`) is
 * there for the opposite reason: it belongs to the sitting rather than to any
 * one page, and it is an accelerator nobody loses anything by missing. This one
 * is per page and the reader's own claim, so it sits where the claim becomes
 * true.
 *
 * It never gates and never saves: the words were on the server as they were
 * typed. All it does is clear a page off a list.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/components/ScopeReviewMark
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Caption } from "@/shared/ui/primitives/typography";

import { useMarkScopeSeen } from "../api/copydesk.queries";
import { isPendingReview, seenOnDate } from "../lib/scopeGroups";
import type { CopyDeskScopeSummary } from "../types/copydesk.dto";

interface ScopeReviewMarkProps {
  readonly scope: string;
  /**
   * This page's line of the contents payload. Absent while the corpus is being
   * refreshed, or for a scope the mirror does not hold — the offer then simply
   * does not appear, rather than guessing at a state.
   */
  readonly summary: CopyDeskScopeSummary | undefined;
  readonly language: string;
}

export const ScopeReviewMark = ({
  scope,
  summary,
  language,
}: ScopeReviewMarkProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const mark = useMarkScopeSeen(scope);

  if (!summary) return null;

  const pending = isPendingReview(summary);
  const seenOn = summary.seen_at ? seenOnDate(summary.seen_at, language) : null;

  const press = (): void => {
    mark.mutate(undefined, {
      onSuccess: () =>
        toast.success(
          t(
            "copy_desk.review_mark.done",
            "Zapisane. Ta strona jest teraz wśród przejrzanych.",
          ),
        ),
      // Nothing was at stake: the mark is bookkeeping about a list, and the
      // words it sits under were saved as they were written.
      onError: () =>
        toast.error(
          t(
            "copy_desk.review_mark.failed",
            "Nie udało się tego zapisać. Spróbuj ponownie za chwilę.",
          ),
        ),
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-3">
      {pending ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            isLoading={mark.isPending}
            leftIcon={<CheckCircle2 size={13} aria-hidden="true" />}
            onClick={press}
          >
            {t("copy_desk.review_mark.action", "Przejrzane")}
          </Button>
          <Caption color="graphite" className="min-w-0 flex-1">
            {seenOn
              ? t("copy_desk.review_mark.again_note", {
                  date: seenOn,
                  defaultValue:
                    "Czytałeś tę stronę {{date}}; od tego czasu tekst się ruszył. Kliknij, kiedy przejdziesz przez zmiany — strona wróci wtedy do przejrzanych.",
                })
              : t(
                  "copy_desk.review_mark.first_note",
                  "Kliknij, kiedy przejdziesz przez całą stronę — zniknie wtedy ze spisu „do przejrzenia”. Nic tu nie wysyłasz; tekst zapisuje się sam.",
                )}
          </Caption>
        </>
      ) : (
        <Caption color="graphite" className="flex items-center gap-1.5">
          <CheckCircle2 size={13} aria-hidden="true" className="shrink-0" />
          {t("copy_desk.review_mark.settled", {
            date: seenOn ?? "",
            defaultValue:
              "Przejrzane {{date}}. Ta strona wróci do spisu sama, kiedy jej tekst się zmieni.",
          })}
        </Caption>
      )}
    </div>
  );
};
