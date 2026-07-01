/**
 * @file ProjectProgramPage.tsx
 * @description Route wrapper for the program / setlist work area of a project.
 * Mounts the setlist editor and a thin status bridge to the score-book cockpit
 * (which now lives in its own "Partytura" work area) — the adjacency stays, the
 * heavy generator no longer sits buried beneath the editor.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectProgramPage
 */

import React from "react";
import { useOutletContext } from "react-router-dom";

import type { ProjectHubContext } from "./ProjectHubLayout";
import { ScorePackageBridge } from "./components/ScorePackageBridge";
import { ProgramTab } from "./editors/tabs/ProgramTab";

export default function ProjectProgramPage(): React.JSX.Element {
  const { project, setDirty } = useOutletContext<ProjectHubContext>();
  return (
    <div className="flex flex-col gap-6">
      <ProgramTab projectId={project.id} onDirtyStateChange={setDirty} />
      <ScorePackageBridge projectId={String(project.id)} />
    </div>
  );
}
