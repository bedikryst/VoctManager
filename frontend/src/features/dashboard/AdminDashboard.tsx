/**
 * @file AdminDashboard.tsx
 * @description Refined Mission Control.
 * Fully migrated to Ethereal UI Primitives & Composites (Zero Tech Debt).
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { useAdminDashboardData } from "./hooks/useAdminDashboardData";

import { UserLocalClock } from "@/shared/widgets/utility/UserLocalClock";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";

import { NextRehearsalAlert } from "./components/NextRehearsalAlert";
import { TelemetryWidget } from "./components/TelemetryWidget";
import { SpotlightProjectCard } from "./components/SpotlightProjectCard";
import { AdminModulesDirectory } from "./components/AdminModulesDirectory";

export default function AdminDashboard(): React.JSX.Element {
  const { user } = useAuth();
  const { t } = useTranslation();
  const {
    isLoading,
    adminStats,
    nextProject,
    nextProjectStats,
    nextRehearsal,
    greeting,
  } = useAdminDashboardData();

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center">
        <EtherealLoader
          message={t("dashboard.shared.load", "Synchronizacja Aury...")}
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
          roleText={t("dashboard.admin.role", "Główny Pulpit Dyrygenta")}
          title={greeting}
          titleHighlight={user?.first_name || "Maestro"}
          rightContent={<UserLocalClock />}
        />
      </StaggeredBentoItem>

      {/* CORE BENTO GRID */}
      <div className="grid grid-cols-1 gap-4 md:gap-8 lg:grid-cols-12">
        {nextRehearsal && (
          <StaggeredBentoItem className="lg:col-span-12">
            <NextRehearsalAlert rehearsal={nextRehearsal} />
          </StaggeredBentoItem>
        )}

        <StaggeredBentoItem className="lg:col-span-4 lg:min-h-[400px]">
          <TelemetryWidget adminStats={adminStats} />
        </StaggeredBentoItem>

        <StaggeredBentoItem className="lg:col-span-8 lg:min-h-[400px]">
          <SpotlightProjectCard
            project={nextProject}
            stats={nextProjectStats}
          />
        </StaggeredBentoItem>

        <StaggeredBentoItem className="mt-4 lg:col-span-12 md:mt-0">
          <SectionHeader
            title={t("dashboard.admin.directory_sub", "06 Modułów")}
            withFluidDivider={false}
            className="px-5 md:px-0"
          />
          <AdminModulesDirectory />
        </StaggeredBentoItem>
      </div>
    </StaggeredBentoContainer>
  );
}
