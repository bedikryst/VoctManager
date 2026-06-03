/**
 * @file ProjectCrewPage.tsx
 * @description Route wrapper for the crew / collaborator work area.
 * Mounts the existing CrewTab with the project resolved by the hub layout.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCrewPage
 */

import React from "react";
import { useOutletContext } from "react-router-dom";

import type { ProjectHubContext } from "./ProjectHubLayout";
import { CrewTab } from "./editors/tabs/CrewTab";

export default function ProjectCrewPage(): React.JSX.Element {
  const { project } = useOutletContext<ProjectHubContext>();
  return <CrewTab projectId={project.id} />;
}
