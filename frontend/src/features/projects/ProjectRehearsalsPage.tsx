/**
 * @file ProjectRehearsalsPage.tsx
 * @description Route wrapper for the rehearsal scheduling work area.
 * Mounts the existing RehearsalsTab with the project resolved by the hub layout.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectRehearsalsPage
 */

import React from "react";
import { useOutletContext } from "react-router-dom";

import type { ProjectHubContext } from "./ProjectHubLayout";
import { RehearsalsTab } from "./editors/tabs/RehearsalsTab";

export default function ProjectRehearsalsPage(): React.JSX.Element {
  const { project } = useOutletContext<ProjectHubContext>();
  return <RehearsalsTab projectId={project.id} />;
}
