/**
 * @file ProjectDivisiPage.tsx
 * @description Route wrapper for the divisi / micro-casting work area (/divisi).
 * Mounts the existing MicroCastingTab with the project resolved by the hub layout.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectDivisiPage
 */

import React from "react";
import { useOutletContext } from "react-router-dom";

import type { ProjectHubContext } from "./ProjectHubLayout";
import { MicroCastingTab } from "./editors/tabs/MicroCastingTab";

export default function ProjectDivisiPage(): React.JSX.Element {
  const { project, setDirty } = useOutletContext<ProjectHubContext>();
  return (
    <MicroCastingTab projectId={project.id} onDirtyStateChange={setDirty} />
  );
}
