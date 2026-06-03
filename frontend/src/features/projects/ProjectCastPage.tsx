/**
 * @file ProjectCastPage.tsx
 * @description Route wrapper for the main casting work area of a project.
 * Mounts the existing CastTab with the project resolved by the hub layout.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCastPage
 */

import React from "react";
import { useOutletContext } from "react-router-dom";

import type { ProjectHubContext } from "./ProjectHubLayout";
import { CastTab } from "./editors/tabs/CastTab";

export default function ProjectCastPage(): React.JSX.Element {
  const { project } = useOutletContext<ProjectHubContext>();
  return <CastTab projectId={project.id} />;
}
