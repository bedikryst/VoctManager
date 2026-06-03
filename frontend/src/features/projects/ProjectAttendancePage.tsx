/**
 * @file ProjectAttendancePage.tsx
 * @description Route wrapper for the attendance matrix work area.
 * Mounts the existing AttendanceMatrixTab with the project resolved by the hub layout.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectAttendancePage
 */

import React from "react";
import { useOutletContext } from "react-router-dom";

import type { ProjectHubContext } from "./ProjectHubLayout";
import { AttendanceMatrixTab } from "./editors/tabs/AttendanceMatrixTab";

export default function ProjectAttendancePage(): React.JSX.Element {
  const { project, setDirty } = useOutletContext<ProjectHubContext>();
  return (
    <AttendanceMatrixTab projectId={project.id} onDirtyStateChange={setDirty} />
  );
}
