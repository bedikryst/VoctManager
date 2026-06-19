/**
 * @file AdminDashboard.tsx
 * @description The conductor's command console — a tablet- and desktop-polished
 * operations cockpit (not a mobile-scaled grid). A commanding header, the most
 * time-sensitive alerts up top, then a focus row (next concert + ensemble
 * balance), an actionable production pipeline, and a dense module strip.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarPlus } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { useAdminDashboardData } from "./hooks/useAdminDashboardData";
import { artistKeys } from "@/features/artists/api/artist.queries";
import { ArtistService } from "@/features/artists/api/artist.service";

import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";

import { NextRehearsalAlert } from "./components/NextRehearsalAlert";
import { TelemetryWidget } from "./components/TelemetryWidget";
import { SpotlightProjectCard } from "./components/SpotlightProjectCard";
import { ProductionPipeline } from "./components/ProductionPipeline";
import { AdminQuickModules } from "./components/AdminQuickModules";
import { DashboardErrorState } from "./components/DashboardErrorState";
import { UnreadMessagesAlert } from "./components/UnreadMessagesAlert";

const ANONYMOUS_ARTIST_QUERY_ID = "anonymous";

export default function AdminDashboard(): React.JSX.Element {
  const { user } = useAuth();
  const { t } = useTranslation();
  const adminArtistProfileId = user?.artist_profile_id;
  const {
    isLoading,
    isError,
    refetch,
    adminStats,
    invitationStats,
    pipelineProjects,
    nextProject,
    nextProjectStats,
    nextRehearsal,
    greeting,
  } = useAdminDashboardData();

  const { data: adminArtistProfile } = useQuery({
    queryKey: artistKeys.artists.details(
      adminArtistProfileId ?? ANONYMOUS_ARTIST_QUERY_ID,
    ),
    queryFn: () => ArtistService.getById(adminArtistProfileId!),
    enabled: !!adminArtistProfileId,
    staleTime: 1000 * 60 * 5,
  });

  const adminFirstNameVocative = adminArtistProfile?.first_name_vocative || null;

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center">
        <EtherealLoader
          message={t("dashboard.shared.load", "Synchronizacja Aury...")}
        />
      </div>
    );
  }

  if (isError) {
    return <DashboardErrorState onRetry={refetch} />;
  }

  const highlight =
    user?.profile?.language === "pl" && adminFirstNameVocative
      ? adminFirstNameVocative
      : user?.first_name || "Maestro";

  return (
    <PageTransition>
      {/* Full-bleed to the shell's 1500px cap — this is a wide console, not a
          single-column feed. Polished from tablet (lg split) through desktop. */}
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 pb-6 pt-4 sm:gap-6 sm:pt-6">
        <PageHeader
          size="dashboard"
          className="!mb-0"
          roleText={t("dashboard.admin.role", "Główny Pulpit Dyrygenta")}
          title={greeting}
          titleHighlight={highlight}
        />

        <UnreadMessagesAlert />

        {nextRehearsal && <NextRehearsalAlert rehearsal={nextRehearsal} />}

        {/* ── focus row: next concert + ensemble balance ─────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-7">
            {nextProject ? (
              <SpotlightProjectCard
                project={nextProject}
                stats={nextProjectStats}
              />
            ) : (
              <StatePanel
                className="h-full"
                icon={<CalendarPlus size={22} aria-hidden="true" />}
                eyebrow={t("dashboard.admin.spotlight.empty_eyebrow", "Brak nadchodzących koncertów")}
                title={t("dashboard.admin.spotlight.empty_title", "Czysty horyzont")}
                description={t(
                  "dashboard.admin.spotlight.empty_desc",
                  "Nie masz zaplanowanego żadnego nadchodzącego koncertu. To dobry moment, by przygotować kolejny występ.",
                )}
                actions={
                  <Button variant="primary" asChild>
                    <Link to="/panel/projects">
                      {t("dashboard.admin.spotlight.empty_cta", "Zaplanuj koncert")}
                    </Link>
                  </Button>
                }
              />
            )}
          </div>
          <div className="lg:col-span-5">
            <TelemetryWidget adminStats={adminStats} />
          </div>
        </div>

        {/* ── actionable production pipeline ─────────────────────────────── */}
        <ProductionPipeline stats={invitationStats} projects={pipelineProjects} />

        {/* ── dense operational module strip ─────────────────────────────── */}
        <AdminQuickModules />
      </div>
    </PageTransition>
  );
}
