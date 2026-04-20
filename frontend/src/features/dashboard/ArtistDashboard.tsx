/**
 * @file ArtistDashboard.tsx
 * @description The Artist's Sanctuary.
 * Synchronized with the Ethereal UI 2026 Admin standards. Zero Lucide vectors.
 * Kinetic typography, fluid masking, and Roman numeral directives.
 * @module panel/dashboard/ArtistDashboard
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/app/providers/AuthProvider";
import { useArtistDashboardData } from "./hooks/useArtistDashboardData";

import { SystemModuleCard } from "@/shared/widgets/domain/SystemModuleCard";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { UserLocalClock } from "@/shared/widgets/utility/UserLocalClock";

import { ArtistNextRehearsalWidget } from "./components/ArtistNextRehearsalWidget";
import { ArtistNextProjectWidget } from "./components/ArtistNextProjectWidget";
import { ArtistEmptyState } from "./components/ArtistEmptyState";

export default function ArtistDashboard(): React.JSX.Element {
  const { user } = useAuth();
  const { t } = useTranslation();

  const { isLoading, upNextRehearsal, upNextProject, greeting } =
    useArtistDashboardData(user?.artist_profile_id ?? undefined);

  const ARTIST_DIRECTIVES = useMemo(
    () => [
      {
        id: "schedule",
        romanNumeral: "I",
        accentClass: "bg-ethereal-gold",
        title: t("dashboard.artist.module_schedule_title", "Harmonogram"),
        description: t(
          "dashboard.artist.module_schedule_desc",
          "Próby, koncerty i zarządzanie absencją.",
        ),
        path: "/panel/schedule",
      },
      {
        id: "materials",
        romanNumeral: "II",
        accentClass: "bg-ethereal-sage",
        title: t("dashboard.artist.module_materials_title", "Repertuar"),
        description: t(
          "dashboard.artist.module_materials_desc",
          "Partytury PDF i referencyjne ścieżki audio.",
        ),
        path: "/panel/materials",
      },
      {
        id: "resources",
        romanNumeral: "III",
        accentClass: "bg-ethereal-incense",
        title: t("dashboard.artist.module_resources_title", "Doktryna"),
        description: t(
          "dashboard.artist.module_resources_desc",
          "Wytyczne katedralne, dress-code i logistyka.",
        ),
        path: "/panel/resources",
      },
    ],
    [t],
  );

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center">
        <EtherealLoader
          message={t("dashboard.shared.syncing", "Strojenie Rezonansu...")}
        />
      </div>
    );
  }

  return (
    <StaggeredBentoContainer className="mx-auto w-full max-w-[1600px] px-0 pb-24 md:px-6 lg:px-10">
      {/* HEADER STRATUM */}
      <StaggeredBentoItem>
        <PageHeader
          size="dashboard"
          roleText={t("dashboard.artist.title_main", "Przestrzeń chórzysty")}
          title={greeting}
          titleHighlight={user?.first_name || t("common.artist_generic", "Artysty")}
          rightContent={<UserLocalClock />}
        />
      </StaggeredBentoItem>

      {/* CORE BENTO GRID */}
      <div className="grid grid-cols-1 gap-4 xl:gap-8 lg:grid-cols-12 xl:grid-cols-13">
        {(!upNextRehearsal && !upNextProject) && (
          <StaggeredBentoItem className="col-span-1 lg:col-span-12 xl:col-span-13">
            <SectionHeader
              title={t("dashboard.artist.next_challenges", "Bezpośrednie Wytyczne")}
              className="px-5 md:px-0"
            />
            <ArtistEmptyState />
          </StaggeredBentoItem>
        )}

        {(upNextRehearsal || upNextProject) && (
          <StaggeredBentoItem className="col-span-1 lg:col-span-12 xl:col-span-13">
            <SectionHeader
              title={t("dashboard.artist.next_challenges", "Bezpośrednie Wytyczne")}
              className="px-5 md:px-0"
            />
          </StaggeredBentoItem>
        )}

        {upNextProject && (
          <StaggeredBentoItem className={upNextRehearsal ? "col-span-1 md:col-span-7 xl:col-span-8 lg:min-h-[400px]" : "col-span-1 md:col-span-12 xl:col-span-13"}>
            <ArtistNextProjectWidget project={upNextProject} />
          </StaggeredBentoItem>
        )}

        {upNextRehearsal && (
          <StaggeredBentoItem className={upNextProject ? "col-span-1 md:col-span-5 xl:col-span-5 lg:min-h-[400px]" : "col-span-1 md:col-span-12 xl:col-span-13"}>
            <ArtistNextRehearsalWidget rehearsal={upNextRehearsal} />
          </StaggeredBentoItem>
        )}

        {/* DIRECTIVES DIRECTORY */}
        <StaggeredBentoItem className="mt-4 col-span-1 lg:col-span-12 xl:col-span-13">
          <SectionHeader
            title={t("dashboard.artist.personal_modules", "Katalog Modułów")}
            withFluidDivider={false}
            className="px-5 md:px-0"
          />
          <nav aria-label={t("dashboard.artist.nav_aria", "Nawigacja artysty")}>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-3 md:auto-rows-[180px]">
              {ARTIST_DIRECTIVES.map((mod) => (
                <li key={mod.id} className="h-full">
                  <SystemModuleCard {...mod} />
                </li>
              ))}
            </ul>
          </nav>
        </StaggeredBentoItem>
      </div>
    </StaggeredBentoContainer>
  );
}
