/**
 * @file sections.ts
 * @description Single source of truth for the settings IA: section ids, icons,
 * i18n keys and the Konto / Preferencje / Połączenia / Dane grouping rendered
 * by SettingsLayout. Section ids double as URL segments
 * (/panel/settings/:section) so every pane is deep-linkable.
 * @module features/settings/constants/sections
 */

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarDays,
  Fingerprint,
  ShieldCheck,
  Shirt,
  User,
} from "lucide-react";

export type SettingsSectionId =
  | "profile"
  | "security"
  | "notifications"
  | "logistics"
  | "calendar"
  | "privacy";

export interface SettingsSectionDef {
  readonly id: SettingsSectionId;
  readonly icon: LucideIcon;
  readonly labelKey: string;
  readonly labelFallback: string;
  readonly shortKey: string;
  readonly shortFallback: string;
}

export interface SettingsGroupDef {
  readonly id: string;
  readonly labelKey: string;
  readonly labelFallback: string;
  readonly sections: readonly SettingsSectionDef[];
}

export const SETTINGS_GROUPS: readonly SettingsGroupDef[] = [
  {
    id: "account",
    labelKey: "settings.nav.groups.account",
    labelFallback: "Konto",
    sections: [
      {
        id: "profile",
        icon: User,
        labelKey: "settings.sections.profile.label",
        labelFallback: "Profil",
        shortKey: "settings.sections.profile.short",
        shortFallback: "Profil",
      },
      {
        id: "security",
        icon: ShieldCheck,
        labelKey: "settings.sections.security.label",
        labelFallback: "Bezpieczeństwo i logowanie",
        shortKey: "settings.sections.security.short",
        shortFallback: "Logowanie",
      },
    ],
  },
  {
    id: "preferences",
    labelKey: "settings.nav.groups.preferences",
    labelFallback: "Preferencje",
    sections: [
      {
        id: "notifications",
        icon: Bell,
        labelKey: "settings.sections.notifications.label",
        labelFallback: "Powiadomienia",
        shortKey: "settings.sections.notifications.short",
        shortFallback: "Alerty",
      },
      {
        id: "logistics",
        icon: Shirt,
        labelKey: "settings.sections.logistics.label",
        labelFallback: "Logistyka sceniczna",
        shortKey: "settings.sections.logistics.short",
        shortFallback: "Stroje",
      },
    ],
  },
  {
    id: "connections",
    labelKey: "settings.nav.groups.connections",
    labelFallback: "Połączenia",
    sections: [
      {
        id: "calendar",
        icon: CalendarDays,
        labelKey: "settings.sections.calendar.label",
        labelFallback: "Kalendarz",
        shortKey: "settings.sections.calendar.short",
        shortFallback: "Kalendarz",
      },
    ],
  },
  {
    id: "data",
    labelKey: "settings.nav.groups.data",
    labelFallback: "Dane i prywatność",
    sections: [
      {
        id: "privacy",
        icon: Fingerprint,
        labelKey: "settings.sections.privacy.label",
        labelFallback: "Prywatność (RODO)",
        shortKey: "settings.sections.privacy.short",
        shortFallback: "RODO",
      },
    ],
  },
];

export const SETTINGS_SECTIONS: readonly SettingsSectionDef[] =
  SETTINGS_GROUPS.flatMap((group) => group.sections);

export const isSettingsSection = (
  value: string | undefined,
): value is SettingsSectionId =>
  SETTINGS_SECTIONS.some((section) => section.id === value);
