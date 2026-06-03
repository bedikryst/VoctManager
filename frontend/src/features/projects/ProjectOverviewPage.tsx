/**
 * @file ProjectOverviewPage.tsx
 * @description Index route of the Project Hub — the conductor's command center for one
 * concert. Reorganised from a symmetric grab-bag of equal cards into an asymmetric "pro
 * tool" layout: a KPI hero strip, a primary work column (what needs attention → rehearsals
 * → program → run sheet) and a narrower context rail (facts, people, materials). On tablet
 * portrait and phones the two columns collapse to a single touch-friendly scroll.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectOverviewPage
 */

import React, { Suspense } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";

import type { ProjectHubContext } from "./ProjectHubLayout";
import { ProjectStatusStrip } from "./ProjectCard/widgets/ProjectStatusStrip";
import { ProjectAttentionPanel } from "./ProjectCard/widgets/ProjectAttentionPanel";
import { RehearsalsWidget } from "./ProjectCard/widgets/RehearsalsWidget";
import { ProgramWidget } from "./ProjectCard/widgets/ProgramWidget";
import { RunSheetWidget } from "./ProjectCard/widgets/RunSheetWidget";
import { ProjectFactsCard } from "./ProjectCard/widgets/ProjectFactsCard";
import { ProjectPeopleCard } from "./ProjectCard/widgets/ProjectPeopleCard";
import { ProjectMaterialsCard } from "./ProjectCard/widgets/ProjectMaterialsCard";

/**
 * Layout-stable placeholder while a data-backed card streams in. Holds the cell shape so
 * neither column reflows as widgets resolve.
 */
const WidgetSkeleton = (): React.JSX.Element => (
  <GlassCard
    variant="solid"
    padding="md"
    isHoverable={false}
    className="flex min-h-44 flex-col gap-4"
  >
    <div className="h-4 w-1/3 animate-pulse rounded-md bg-ethereal-incense/15" />
    <div className="flex-1 space-y-2.5">
      <div className="h-3 w-full animate-pulse rounded bg-ethereal-incense/10" />
      <div className="h-3 w-5/6 animate-pulse rounded bg-ethereal-incense/10" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-ethereal-incense/10" />
    </div>
  </GlassCard>
);

/** Shape-stable placeholder for the four-tile KPI strip. */
const StatusStripSkeleton = (): React.JSX.Element => (
  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
    {[0, 1, 2, 3].map((tile) => (
      <div
        key={tile}
        className="flex min-h-26 flex-col gap-3 rounded-2xl border border-ethereal-ink/6 bg-ethereal-marble p-4"
      >
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-ethereal-incense/15" />
        <div className="h-7 w-1/3 animate-pulse rounded bg-ethereal-incense/15" />
      </div>
    ))}
  </div>
);

export default function ProjectOverviewPage(): React.JSX.Element {
  const { project, openScore } = useOutletContext<ProjectHubContext>();
  const navigate = useNavigate();

  const base = `/panel/projects/${project.id}`;
  const go = (segment: string) => () => navigate(`${base}/${segment}`);

  return (
    <div className="flex flex-col gap-6">
      {/* KPI hero — the four questions a conductor opens a production to answer. */}
      <Suspense fallback={<StatusStripSkeleton />}>
        <ProjectStatusStrip project={project} />
      </Suspense>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        {/* Primary work column */}
        <StaggeredBentoContainer className="flex flex-col gap-5 lg:col-span-2">
          <StaggeredBentoItem>
            <Suspense fallback={<WidgetSkeleton />}>
              <ProjectAttentionPanel project={project} />
            </Suspense>
          </StaggeredBentoItem>
          <StaggeredBentoItem>
            <Suspense fallback={<WidgetSkeleton />}>
              <RehearsalsWidget project={project} onEdit={go("rehearsals")} />
            </Suspense>
          </StaggeredBentoItem>
          <StaggeredBentoItem>
            <Suspense fallback={<WidgetSkeleton />}>
              <ProgramWidget project={project} onEdit={go("program")} />
            </Suspense>
          </StaggeredBentoItem>
          <StaggeredBentoItem>
            <RunSheetWidget project={project} onEdit={go("details")} />
          </StaggeredBentoItem>
        </StaggeredBentoContainer>

        {/* Context rail */}
        <StaggeredBentoContainer className="flex flex-col gap-5">
          <StaggeredBentoItem>
            <Suspense fallback={<WidgetSkeleton />}>
              <ProjectFactsCard project={project} onEdit={go("details")} />
            </Suspense>
          </StaggeredBentoItem>
          <StaggeredBentoItem>
            <Suspense fallback={<WidgetSkeleton />}>
              <ProjectPeopleCard
                project={project}
                onOpenCast={go("cast")}
                onOpenCrew={go("crew")}
              />
            </Suspense>
          </StaggeredBentoItem>
          <StaggeredBentoItem>
            <ProjectMaterialsCard project={project} onOpenScore={openScore} />
          </StaggeredBentoItem>
        </StaggeredBentoContainer>
      </div>
    </div>
  );
}
