/**
 * @file PieceDivisiRoster.tsx
 * @description Who sings what in one piece of the reader's concert: the choir
 * lines, then the solos. A solo is listed apart from the lines because it is a
 * duty added to a singer, not a line of the choir — the same person can stand
 * on Tenor 1 above and hold two solos below. An open solo position is listed
 * too: which passages are still unassigned is part of the casting.
 *
 * The lines read as a score does: one row per voice family, the family's
 * lines side by side in two columns (a third wraps under them), an undivided
 * family in the left cell alone — so Tenor never shares a row with Bas I.
 * Two columns on a phone as well: side by side is the point.
 * @architecture Enterprise SaaS 2026
 * @module features/materials/components/PieceDivisiRoster
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { castRowsByFamily } from "@/shared/lib/voiceFamilies";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { GlossaryTerm } from "@/shared/ui/composites/glossary/GlossaryTerm";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import type { MaterialsCasting, MaterialsSolo } from "../types/materials.dto";

interface PieceDivisiRosterProps {
  castings: MaterialsCasting[];
  solos: MaterialsSolo[];
}

const MeMarker = (): React.JSX.Element => (
  <div
    className="w-1.5 h-1.5 bg-ethereal-gold rounded-full animate-pulse shadow-glass-solid shrink-0"
    aria-hidden="true"
  />
);

export const PieceDivisiRoster = ({
  castings,
  solos,
}: PieceDivisiRosterProps): React.JSX.Element => {
  const { t } = useTranslation();

  const familyRows = useMemo(
    () =>
      castRowsByFamily(
        castings,
        (c) => c.voice_line,
        // The server names the line inside this piece's arrangement — an
        // undivided family drops its index there. Nothing on the client may
        // re-derive it from the code: the code always carries the number.
        (c) =>
          c.voice_line_display ||
          c.voice_line ||
          t("materials.piece.other_voice", "Inne"),
      ),
    [castings, t],
  );

  return (
    <GlassCard variant="ethereal">
      <div className="flex items-center gap-1.5 border-b border-ethereal-marble pb-2 mb-3">
        <Users
          size={13}
          className="text-ethereal-graphite"
          aria-hidden="true"
        />
        <Eyebrow color="muted">
          <GlossaryTerm term="divisi">
            {t("materials.piece.cast_divisi", "Obsada (Divisi)")}
          </GlossaryTerm>
        </Eyebrow>
      </div>

      {castings.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          {familyRows.flatMap((row) =>
            row.lines.map((line, index) => (
              <div
                key={line.code}
                // A family opens a new grid row, whatever column the last one ended in.
                className={cn("min-w-0 space-y-1.5", index === 0 && "col-start-1")}
              >
                <Eyebrow color="muted">{line.label}</Eyebrow>
                <ul className="space-y-1">
                  {line.members.map((c) => (
                    <li key={c.artist_id} className="flex items-center gap-1.5">
                      {c.is_me && <MeMarker />}
                      <Text
                        size="sm"
                        color={c.is_me ? "default" : "graphite"}
                        weight={c.is_me ? "semibold" : "normal"}
                      >
                        {c.artist_name ||
                          t("materials.piece.unknown_artist", "Artysta")}
                      </Text>
                    </li>
                  ))}
                </ul>
              </div>
            )),
          )}
        </div>
      ) : (
        <Text size="sm" color="graphite" className="italic opacity-70">
          {t(
            "materials.piece.no_divisi",
            "Brak zdefiniowanego podziału głosów.",
          )}
        </Text>
      )}

      {solos.length > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-ethereal-marble pt-3">
          <Eyebrow color="amethyst">
            {t("materials.piece.solos", "Solówki")}
          </Eyebrow>
          <ul className="space-y-1.5">
            {solos.map((solo) => (
              <li key={solo.id} className="flex items-start gap-1.5">
                {solo.is_me && <MeMarker />}
                <div className="min-w-0">
                  <Text
                    size="sm"
                    color={solo.is_me ? "default" : "graphite"}
                    weight={solo.is_me ? "semibold" : "normal"}
                  >
                    {solo.label || t("materials.piece.solo_badge", "Solo")}
                    {" — "}
                    {solo.artist_name ??
                      t("materials.piece.solo_open", "jeszcze nieobsadzona")}
                  </Text>
                  {solo.score_reference && (
                    <Text size="xs" color="muted">
                      {solo.score_reference}
                    </Text>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  );
};
