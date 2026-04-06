/**
 * @file crew.dto.ts
 * @description Feature-local DTOs and option metadata for the Crew domain.
 */

import type { CollaboratorSpecialty } from '../../../shared/types';

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
    label: string;
}

export const SPECIALTY_CHOICES: CrewSpecialtyOption[] = [
    { value: 'SOUND', label: 'Reżyseria Dźwięku' },
    { value: 'LIGHT', label: 'Reżyseria Świateł' },
    { value: 'VISUALS', label: 'Sztuka Wizualna' },
    { value: 'INSTRUMENT', label: 'Instrumentalista' },
    { value: 'LOGISTICS', label: 'Logistyka' },
    { value: 'OTHER', label: 'Inne' },
];
