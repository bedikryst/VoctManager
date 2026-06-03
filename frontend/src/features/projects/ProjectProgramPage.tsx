/**
 * @file ProjectProgramPage.tsx
 * @description Route wrapper for the program / setlist work area of a project.
 * Mounts the existing ProgramTab with the project resolved by the hub layout.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectProgramPage
 */

import React from "react";
import { useOutletContext } from "react-router-dom";

import type { ProjectHubContext } from "./ProjectHubLayout";
import { ProgramTab } from "./editors/tabs/ProgramTab";

export default function ProjectProgramPage(): React.JSX.Element {
  const { project, setDirty } = useOutletContext<ProjectHubContext>();
  return <ProgramTab projectId={project.id} onDirtyStateChange={setDirty} />;
}
