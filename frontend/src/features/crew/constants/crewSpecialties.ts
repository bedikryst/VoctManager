/**
 * @file crewSpecialties.ts
 * @description Domain dictionary for collaborator specialties.
 * Centralises i18n keys, lucide icons, and Ethereal accent tokens so every
 * downstream surface (cards, badges, filters, hero) speaks the same dialect.
 * @architecture Enterprise SaaS 2026
 * @module features/crew/constants/crewSpecialties
 */

import type { TFunction } from "i18next";
import type { LucideIcon } from "lucide-react";
import {
  AudioWaveform,
  Lightbulb,
  Music2,
  PackageCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

import type { CollaboratorSpecialty } from "@/shared/types";

export type CrewSpecialtyAccent =
  | "gold"
  | "amethyst"
  | "crimson"
  | "sage"
  | "graphite"
  | "incense";

interface CrewSpecialtyDefinition {
  value: CollaboratorSpecialty;
  labelKey: string;
  defaultLabel: string;
  descriptionKey: string;
  defaultDescription: string;
  icon: LucideIcon;
  accent: CrewSpecialtyAccent;
}

export interface CrewSpecialtyOption {
  value: CollaboratorSpecialty;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: CrewSpecialtyAccent;
}

const CREW_SPECIALTY_DEFINITIONS: CrewSpecialtyDefinition[] = [
  {
    value: "SOUND",
    labelKey: "crew.specialties.SOUND",
    defaultLabel: "Dźwięk",
    descriptionKey: "crew.specialty_descriptions.SOUND",
    defaultDescription: "Realizacja dźwięku, miks i nagłośnienie sceniczne.",
    icon: AudioWaveform,
    accent: "gold",
  },
  {
    value: "LIGHT",
    labelKey: "crew.specialties.LIGHT",
    defaultLabel: "Światło",
    descriptionKey: "crew.specialty_descriptions.LIGHT",
    defaultDescription: "Reżyseria świateł, oprawa wizualna sceny.",
    icon: Lightbulb,
    accent: "amethyst",
  },
  {
    value: "VISUALS",
    labelKey: "crew.specialties.VISUALS",
    defaultLabel: "Wizualizacje",
    descriptionKey: "crew.specialty_descriptions.VISUALS",
    defaultDescription: "Multimedia, projekcje, materiał ekranowy.",
    icon: Sparkles,
    accent: "crimson",
  },
  {
    value: "INSTRUMENT",
    labelKey: "crew.specialties.INSTRUMENT",
    defaultLabel: "Instrumenty",
    descriptionKey: "crew.specialty_descriptions.INSTRUMENT",
    defaultDescription: "Instrumentaliści zewnętrzni i obsługa instrumentów.",
    icon: Music2,
    accent: "sage",
  },
  {
    value: "LOGISTICS",
    labelKey: "crew.specialties.LOGISTICS",
    defaultLabel: "Logistyka",
    descriptionKey: "crew.specialty_descriptions.LOGISTICS",
    defaultDescription: "Transport, scena, zabezpieczenie produkcji.",
    icon: PackageCheck,
    accent: "graphite",
  },
  {
    value: "OTHER",
    labelKey: "crew.specialties.OTHER",
    defaultLabel: "Inne",
    descriptionKey: "crew.specialty_descriptions.OTHER",
    defaultDescription: "Współpracownicy spoza standardowych kategorii.",
    icon: Wrench,
    accent: "incense",
  },
];

export const getCrewSpecialtyOptions = (t: TFunction): CrewSpecialtyOption[] =>
  CREW_SPECIALTY_DEFINITIONS.map(
    ({
      value,
      labelKey,
      defaultLabel,
      descriptionKey,
      defaultDescription,
      icon,
      accent,
    }) => ({
      value,
      label: t(labelKey, defaultLabel),
      description: t(descriptionKey, defaultDescription),
      icon,
      accent,
    }),
  );

export const getCrewSpecialtyOption = (
  t: TFunction,
  value: CollaboratorSpecialty | string | null | undefined,
): CrewSpecialtyOption => {
  const options = getCrewSpecialtyOptions(t);
  return (
    options.find((option) => option.value === value) ??
    options[options.length - 1]
  );
};
