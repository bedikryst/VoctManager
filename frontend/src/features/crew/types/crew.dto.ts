/**
 * @file crew.dto.ts
 * @description Feature-local DTOs for the Crew domain.
 * Specialty taxonomy lives in `constants/crewSpecialties.ts`.
 * @module features/crew/types/crew.dto
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

/** The "Kontakt" filter in the crew's panel. Who lacks one is the quick filter instead. */
export type CrewContactCompleteness = "ALL" | "WITH_EMAIL" | "WITH_PHONE" | "FULL_CONTACT";
