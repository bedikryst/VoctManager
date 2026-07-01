/**
 * @file ProjectScorePage.tsx
 * @description The concert score-book work area — the single home that owns
 * `project.score_pdf`. Hosts the auto-assembly cockpit and the hand-upload
 * fallback side by side, so the conductor has one coherent place to produce the
 * book (generate or upload) instead of the old split between the Program tab and
 * the Details upload. Reuses the hub's shared score viewer for preview.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectScorePage
 */

import React from "react";
import { useOutletContext } from "react-router-dom";

import type { ProjectHubContext } from "./ProjectHubLayout";
import { ScorePackagePanel } from "./components/ScorePackagePanel";
import { ScoreManualUploadCard } from "./components/ScoreManualUploadCard";

export default function ProjectScorePage(): React.JSX.Element {
  const { project, openScore } = useOutletContext<ProjectHubContext>();
  return (
    <div className="flex flex-col gap-6">
      <ScorePackagePanel
        projectId={String(project.id)}
        projectTitle={project.title}
      />
      <ScoreManualUploadCard
        projectId={String(project.id)}
        hasScorePdf={Boolean(project.score_pdf)}
        onPreview={openScore}
      />
    </div>
  );
}
