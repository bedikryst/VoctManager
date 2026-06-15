/**
 * @file commandActions.ts
 * @description Curated quick-actions surfaced in the command palette. Each one
 * is an intentful navigation to where the task begins (genuine create routes
 * where they exist, e.g. /panel/projects/new; otherwise the operational
 * surface). RBAC-scoped so a chorister never sees a manager-only action.
 * @module widgets/panel-shell/command
 * @architecture Enterprise SaaS 2026
 */

import {
  CalendarCheck,
  CalendarOff,
  Plus,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

export type CommandActionScope = "manager" | "artist" | "all";

export interface CommandActionDef {
  readonly id: string;
  readonly labelKey: string;
  readonly defaultLabel: string;
  readonly icon: LucideIcon;
  readonly to: string;
  readonly scope: CommandActionScope;
}

export const COMMAND_ACTIONS: readonly CommandActionDef[] = [
  {
    id: "new_project",
    labelKey: "dashboard.layout.command.actions.new_project",
    defaultLabel: "Nowy projekt",
    icon: Plus,
    to: "/panel/projects/new",
    scope: "manager",
  },
  {
    id: "mark_attendance",
    labelKey: "dashboard.layout.command.actions.mark_attendance",
    defaultLabel: "Oznacz obecność",
    icon: CalendarCheck,
    to: "/panel/rehearsals",
    scope: "manager",
  },
  {
    id: "new_artist",
    labelKey: "dashboard.layout.command.actions.new_artist",
    defaultLabel: "Nowy artysta",
    icon: UserPlus,
    to: "/panel/artists?new=1",
    scope: "manager",
  },
  {
    id: "report_absence",
    labelKey: "dashboard.layout.command.actions.report_absence",
    defaultLabel: "Zgłoś nieobecność",
    icon: CalendarOff,
    to: "/panel/schedule",
    scope: "artist",
  },
] as const;
