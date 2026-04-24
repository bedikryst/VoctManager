import React from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import type { MaterialsCasting } from "../types/materials.dto";

interface PieceDivisiRosterProps {
  castings: MaterialsCasting[];
}

export const PieceDivisiRoster = ({
  castings,
}: PieceDivisiRosterProps): React.JSX.Element => {
  const { t } = useTranslation();

  const divisiGroups = castings.reduce<Record<string, MaterialsCasting[]>>(
    (acc, c) => {
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
    <GlassCard variant="ethereal" className="h-full">
      <div className="flex items-center gap-1.5 border-b border-ethereal-marble pb-2 mb-3">
        <Users size={14} className="text-ethereal-graphite" aria-hidden="true" />
        <Eyebrow color="muted">
          {t("materials.piece.cast_divisi", "Obsada utworu (Divisi)")}
        </Eyebrow>
      </div>

      {castings.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 max-h-40 overflow-y-auto pr-2 no-scrollbar">
          {Object.entries(divisiGroups).map(([label, groupCastings]) => (
            <div key={label} className="space-y-1.5">
              <Eyebrow color="muted">{label}</Eyebrow>
              <ul className="space-y-1">
                {groupCastings.map((c) => (
                  <li key={c.id} className="flex items-center gap-1.5">
                    {c.is_me && (
                      <div
                        className="w-1.5 h-1.5 bg-ethereal-gold rounded-full animate-pulse shadow-glass-solid"
                        aria-hidden="true"
                      />
                    )}
                    <Text
                      className={
                        c.is_me
                          ? "text-ethereal-ink font-bold"
                          : "text-ethereal-graphite"
                      }
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
        <Text className="italic text-ethereal-graphite opacity-80">
          {t(
            "materials.piece.no_divisi",
            "Brak zdefiniowanego podziału głosów.",
          )}
        </Text>
      )}
    </GlassCard>
  );
};
