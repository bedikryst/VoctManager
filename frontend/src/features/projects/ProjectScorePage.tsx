/**
 * @file ProjectScorePage.tsx
 * @description The concert score-book work area — the single home that owns
 * `project.score_pdf`. One cockpit produces the book by either route: the
 * generator assembles it, and the hand-upload alternative rides the cockpit's
 * own footer, because both write the same field and the cockpit's status hero
 * already describes whichever book exists.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectScorePage
 */

import React from "react";
import { useOutletContext } from "react-router-dom";

import type { ProjectHubContext } from "./ProjectHubLayout";
import { ScorePackagePanel } from "./components/ScorePackagePanel";

export default function ProjectScorePage(): React.JSX.Element {
  const { project } = useOutletContext<ProjectHubContext>();
  return (
    <ScorePackagePanel
      projectId={String(project.id)}
      projectTitle={project.title}
    />
  );
}
