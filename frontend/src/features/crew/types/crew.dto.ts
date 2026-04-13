/**
 * @file crew.dto.ts
 * @description Feature-local DTOs and option metadata for the Crew domain.
 * @architecture Enterprise SaaS 2026
 */

import type { CollaboratorSpecialty } from "@/shared/types";

export interface CrewFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  company_name: string;
  specialty: CollaboratorSpecialty;
}

export type CrewWriteDTO = CrewFormData;

export interface CrewSpecialtyOption {
  value: CollaboratorSpecialty;
  labelKey: string;
}

export const SPECIALTY_CHOICES: CrewSpecialtyOption[] = [
  { value: "SOUND", labelKey: "crew.specialties.SOUND" },
  { value: "LIGHT", labelKey: "crew.specialties.LIGHT" },
  { value: "VISUALS", labelKey: "crew.specialties.VISUALS" },
  { value: "INSTRUMENT", labelKey: "crew.specialties.INSTRUMENT" },
  { value: "LOGISTICS", labelKey: "crew.specialties.LOGISTICS" },
  { value: "OTHER", labelKey: "crew.specialties.OTHER" },
];
