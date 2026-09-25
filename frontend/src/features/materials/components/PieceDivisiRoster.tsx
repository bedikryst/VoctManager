/**
 * @file PieceDivisiRoster.tsx
 * @description Who sings what in one piece of the reader's concert: the choir
 * lines, then the solos. A solo is listed apart from the lines because it is a
 * duty added to a singer, not a line of the choir — the same person can stand
 * on Tenor 1 above and hold two solos below. An open solo position is listed
 * too: which passages are still unassigned is part of the casting.
 * @architecture Enterprise SaaS 2026
 * @module features/materials/components/PieceDivisiRoster
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";

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

  const divisiGroups = castings.reduce<Record<string, MaterialsCasting[]>>(
    (acc, c) => {
      // The server names the line inside this piece's arrangement — an
      // undivided family drops its index there. Nothing on the client may
      // re-derive it from the code: the code always carries the number.
      const label =
        c.voice_line_display ||
        c.voice_line ||
        t("materials.piece.other_voice", "Inne");
      if (!acc[label]) acc[label] = [];
      acc[label].push(c);
      return acc;
    },
    {},
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
          {Object.entries(divisiGroups).map(([label, groupCastings]) => (
            <div key={label} className="space-y-1.5">
              <Eyebrow color="muted">{label}</Eyebrow>
              <ul className="space-y-1">
                {groupCastings.map((c) => (
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
          ))}
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
