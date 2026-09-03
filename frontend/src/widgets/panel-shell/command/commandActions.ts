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
  PenLine,
  Plus,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

/**
 * Who an action is offered to. Three of these are roles; `copy_editor` is a
 * CAPABILITY (`can_edit_site_copy`), which is the whole reason the copy desk
 * did not become a fourth `AppRole` — an editor is orthogonal to the
 * manager/not-manager split every other gate in the panel is built on.
 */
export type CommandActionScope =
  | "manager"
  | "artist"
  | "copy_editor"
  | "all";

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
  // One of two doorways into the desk; the other is the sidebar footer, beside
  // the settings and log-out that also leave the panel. Neither is a nav item,
  // and that is the constraint: `/redakcja` takes the shell over, so a rail tab
  // pointing at it would be a tab that closes the panel. The address editors
  // are given is a link; this is for the editor who is already inside.
  {
    id: "open_copy_desk",
    labelKey: "dashboard.layout.command.actions.open_copy_desk",
    defaultLabel: "Redakcja tekstów serwisu",
    icon: PenLine,
    to: "/redakcja",
    scope: "copy_editor",
  },
] as const;
