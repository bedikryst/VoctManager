/**
 * @file AIHallucinationWarning.tsx
 * @description Small inline warning for the contradictions a record can be
 * checked against itself for: composition year vs the composer's lifespan, IPA
 * vs lyric line alignment, and a modern epoch on an arranged (likely
 * traditional) work. Deliberately NOT the model's self-rated confidence, which
 * was a near-constant ~95% and carried no information.
 *
 * It is bound to the CONTRADICTION, not to the edition's status: a piece
 * published with 1741 on a composer born in 1873 goes on being wrong, and a
 * warning that only ever showed during review meant nobody would be told again.
 * `isReviewing` picks the voice, not the visibility — inside a review the
 * contradiction stands between the conductor and an irreversible publication,
 * so it is crimson; at rest it is ordinary work in progress and takes gold,
 * because crimson is spent on the one thing that is actually broken.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/AIHallucinationWarning
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import type { Piece } from "@/shared/types";

interface AIHallucinationWarningProps {
  readonly piece: Piece;
  /** An edition is awaiting approval — the page is a review, not a plain edit. */
  readonly isReviewing: boolean;
}

const parseYear = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = /\d{3,4}/.exec(String(value));
  return match ? parseInt(match[0], 10) : null;
};

export const AIHallucinationWarning = ({
  piece,
  isReviewing,
}: AIHallucinationWarningProps): React.JSX.Element | null => {
  const { t } = useTranslation();

  const reasons: string[] = [];
  const compositionYear = piece.composition_year;
  if (compositionYear && piece.composer) {
    const birth = parseYear(piece.composer.birth_year);
    const death = parseYear(piece.composer.death_year);

    if (birth !== null && compositionYear < birth) {
      reasons.push(
        t(
          "archive.ai_warning.before_birth",
          "Rok kompozycji ({{year}}) jest przed urodzeniem kompozytora ({{birth}}).",
          { year: compositionYear, birth },
        ),
      );
    }
    // Allow posthumous works up to 50 years after death (J.S. Bach manuscripts etc.),
    // but flag anything older than that as suspect.
    if (death !== null && compositionYear > death + 50) {
      reasons.push(
        t(
          "archive.ai_warning.long_after_death",
          "Rok kompozycji ({{year}}) jest dużo po śmierci kompozytora ({{death}}).",
          { year: compositionYear, death },
        ),
      );
    }
  }

  // IPA is supposed to be line-aligned with the sung text; a line-count mismatch
  // is a cheap, high-signal sign the alignment drifted (a near-certain bug to fix).
  const countLines = (value: string | null | undefined): number =>
    (value ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean).length;
  const lyricLines = countLines(piece.lyrics_original);
  const ipaLines = countLines(piece.lyrics_ipa);
  if (lyricLines > 0 && ipaLines > 0 && lyricLines !== ipaLines) {
    reasons.push(
      t(
        "archive.ai_warning.ipa_misaligned",
        "Transkrypcja IPA ma {{ipa}} linii, a tekst {{lyrics}} — wyrównanie wers-do-wersu może być błędne.",
        { ipa: ipaLines, lyrics: lyricLines },
      ),
    );
  }

  // A named arranger's setting tagged with a modern/contemporary epoch is the
  // classic misfire: a traditional carol/hymn arranged today is FOLK (or the
  // origin period), not CON. Epoch should reflect the work's ORIGIN, so nudge
  // the conductor to confirm. This is a real, checkable signal — unlike the
  // model's self-rated confidence, which was a near-constant ~95% and told the
  // conductor nothing.
  if (piece.arranger && (piece.epoch === "CON" || piece.epoch === "M20")) {
    reasons.push(
      t(
        "archive.ai_warning.arrangement_epoch",
        "Utwór ma aranżera, a epokę oznaczono jako współczesną — upewnij się, że to nie opracowanie utworu tradycyjnego (wtedy epoka = pochodzenie oryginału).",
      ),
    );
  }

  if (reasons.length === 0) return null;

  return (
    <div
      // Only the review is an announcement: there the box appears over a
      // decision being made. At rest it is part of the record the reader opened
      // and asserts itself over nothing.
      role={isReviewing ? "alert" : undefined}
      className={cn(
        "flex items-start gap-3 rounded-nested border p-3",
        isReviewing
          ? "border-ethereal-crimson/30 bg-ethereal-crimson/5"
          : "border-ethereal-gold/35 bg-ethereal-gold/5",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-control border",
          isReviewing
            ? "border-ethereal-crimson/40 bg-ethereal-crimson/10 text-ethereal-crimson"
            : "border-ethereal-gold/40 bg-ethereal-gold/10 text-ethereal-gold",
        )}
        aria-hidden="true"
      >
        <AlertTriangle size={14} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <Caption
          color={isReviewing ? "crimson" : "gold"}
          className="block font-semibold"
        >
          {isReviewing
            ? t(
                "archive.ai_warning.title",
                "AI mógł się pomylić — sprawdź dane przed zatwierdzeniem",
              )
            : t(
                "archive.ai_warning.title_resting",
                "Te dane sobie przeczą — warto je poprawić",
              )}
        </Caption>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {reasons.map((reason) => (
            <li key={reason}>
              <Text
                as="span"
                size="xs"
                className={
                  isReviewing
                    ? "text-ethereal-crimson/85"
                    : "text-ethereal-graphite"
                }
              >
                {reason}
              </Text>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
