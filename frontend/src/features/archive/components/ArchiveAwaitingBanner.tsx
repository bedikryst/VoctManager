/**
 * @file ArchiveAwaitingBanner.tsx
 * @description Top-of-page banner that surfaces editions awaiting conductor
 * review. Hidden when nothing is in AWAI status; otherwise prompts a one-click
 * jump to the first pending piece's AI Review tab.
 *
 * Conductor pain point this solves: with N pieces in the archive and only 2-3
 * with AWAI editions, finding them used to require scrolling + spotting the
 * gold "AI · review" chip on individual cards. Now: dedicated banner up top.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ArchiveAwaitingBanner
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Heading, Text } from "@/shared/ui/primitives/typography";
import {
  INGESTION_STATUS,
  type Piece,
} from "@/shared/types";

interface ArchiveAwaitingBannerProps {
  readonly pieces: readonly Piece[];
  readonly onOpenReview: (piece: Piece) => void;
}

export const ArchiveAwaitingBanner = ({
  pieces,
  onOpenReview,
}: ArchiveAwaitingBannerProps): React.JSX.Element | null => {
  const { t } = useTranslation();

  const piecesAwaiting = useMemo(
    () =>
      pieces.filter((p) =>
        (p.editions ?? []).some(
          (e) => e.ingestion_status === INGESTION_STATUS.AWAITING,
        ),
      ),
    [pieces],
  );

  if (piecesAwaiting.length === 0) return null;

  const first = piecesAwaiting[0];
  const count = piecesAwaiting.length;

  return (
    <section
      role="region"
      aria-label={t(
        "archive.awaiting_banner.aria",
        "Wydania oczekujące na weryfikację",
      )}
      className="relative overflow-hidden rounded-3xl border border-ethereal-gold/40 bg-gradient-to-r from-ethereal-gold/10 via-ethereal-parchment/40 to-transparent p-5 md:p-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-ethereal-gold/50 bg-ethereal-gold/15 text-ethereal-gold"
            aria-hidden="true"
          >
            <Sparkles size={20} strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <Heading as="h2" size="lg" weight="medium">
              {count === 1
                ? t(
                    "archive.awaiting_banner.title_one",
                    "1 wydanie czeka na Twoją weryfikację",
                  )
                : t(
                    "archive.awaiting_banner.title_many",
                    "{{count}} wydań czeka na Twoją weryfikację",
                    { count },
                  )}
            </Heading>
            <Text size="sm" color="graphite" className="mt-1">
              {t(
                "archive.awaiting_banner.body",
                "AI skończyło ekstrakcję metadanych. Sprawdź czy nic nie zmyślił — kompozytor, tytuł, IPA — i zatwierdź, żeby chór dostał materiały.",
              )}
            </Text>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="primary" onClick={() => onOpenReview(first)}>
            {count === 1
              ? t("archive.awaiting_banner.review_one", "Przejrzyj wydanie")
              : t(
                  "archive.awaiting_banner.review_first",
                  "Zacznij od pierwszego",
                )}
          </Button>
        </div>
      </div>
    </section>
  );
};
