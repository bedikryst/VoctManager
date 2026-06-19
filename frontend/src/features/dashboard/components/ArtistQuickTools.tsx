/**
 * @file ArtistQuickTools.tsx
 * @description The chorister's home toolkit. Not a navigation directory (the tab
 * bar and sidebar already do that) — a small set of high-intent, big-tap targets
 * led by an instant Kamerton (Web Audio pitch pipe in a bottom sheet) so a singer
 * can take a reference pitch anywhere, plus curated jumps into the deep surfaces.
 * @module features/dashboard/components/ArtistQuickTools
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookMarked, CalendarClock, Music2, Radio } from "lucide-react";

import { Eyebrow } from "@/shared/ui/primitives/typography";
import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { PitchPipe } from "@/shared/ui/instruments/PitchPipe";
import { QuickTile } from "./QuickTile";

export const ArtistQuickTools = (): React.JSX.Element => {
  const { t } = useTranslation();
  const [isPitchPipeOpen, setIsPitchPipeOpen] = useState(false);

  return (
    <section aria-label={t("dashboard.artist.tools.aria", "Narzędzia chórzysty")}>
      <Eyebrow color="muted" className="mb-3 block px-1">
        {t("dashboard.artist.tools.title", "Pod ręką")}
      </Eyebrow>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickTile
          Icon={Radio}
          accent="gold"
          label={t("dashboard.artist.tools.tuning_fork", "Kamerton")}
          hint={t("dashboard.artist.tools.tuning_fork_hint", "Daj sobie ton")}
          onClick={() => setIsPitchPipeOpen(true)}
          opensDialog
          expanded={isPitchPipeOpen}
        />
        <QuickTile
          to="/panel/materials"
          Icon={Music2}
          accent="sage"
          label={t("dashboard.artist.tools.songbook", "Śpiewnik")}
          hint={t("dashboard.artist.tools.songbook_hint", "Nuty i audio")}
        />
        <QuickTile
          to="/panel/schedule"
          Icon={CalendarClock}
          accent="incense"
          label={t("dashboard.artist.tools.schedule", "Harmonogram")}
          hint={t("dashboard.artist.tools.schedule_hint", "Próby i koncerty")}
        />
        <QuickTile
          to="/panel/resources"
          Icon={BookMarked}
          accent="amethyst"
          label={t("dashboard.artist.tools.my_card", "Moja Karta")}
          hint={t("dashboard.artist.tools.my_card_hint", "Zespół i niezbędnik")}
        />
      </div>

      <BottomSheet
        isOpen={isPitchPipeOpen}
        onClose={() => setIsPitchPipeOpen(false)}
        title={t("dashboard.artist.tools.tuning_fork", "Kamerton")}
        subtitle={t(
          "dashboard.artist.tools.tuning_fork_sheet_subtitle",
          "Nastrój głos w każdej chwili",
        )}
      >
        <PitchPipe className="mt-1 border-0 bg-transparent !p-0 shadow-none" />
      </BottomSheet>
    </section>
  );
};
