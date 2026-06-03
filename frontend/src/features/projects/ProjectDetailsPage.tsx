/**
 * @file ProjectDetailsPage.tsx
 * @description Route wrapper for project base metadata + logistics (/details).
 * Mounts the existing DetailsTab with the hydrated project. Leaving the route
 * discards any unsaved draft — consistent with the archive edit-page precedent;
 * the floating save bar surfaces the dirty state.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectDetailsPage
 */

import React from "react";
import { useOutletContext } from "react-router-dom";

import type { ProjectHubContext } from "./ProjectHubLayout";
import { DetailsTab } from "./editors/tabs/DetailsTab";

export default function ProjectDetailsPage(): React.JSX.Element {
  const { project, setDirty } = useOutletContext<ProjectHubContext>();
  return (
    <DetailsTab
      project={project}
      onSuccess={() => undefined}
      onDirtyStateChange={setDirty}
    />
  );
}
