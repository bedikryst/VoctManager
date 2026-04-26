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
        (c.voice_line ? t(`dashboard.layout.roles.${c.voice_line}`) : null) ||
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
          {t("materials.piece.cast_divisi", "Obsada (Divisi)")}
        </Eyebrow>
      </div>

      {castings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 max-h-48 overflow-y-auto no-scrollbar">
          {Object.entries(divisiGroups).map(([label, groupCastings]) => (
            <div key={label} className="space-y-1.5">
              <Eyebrow color="muted">{label}</Eyebrow>
              <ul className="space-y-1">
                {groupCastings.map((c) => (
                  <li key={c.artist_id} className="flex items-center gap-1.5">
                    {c.is_me && (
                      <div
                        className="w-1.5 h-1.5 bg-ethereal-gold rounded-full animate-pulse shadow-glass-solid shrink-0"
                        aria-hidden="true"
                      />
                    )}
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
    </GlassCard>
  );
};
