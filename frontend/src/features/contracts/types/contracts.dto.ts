/**
 * @file contracts.dto.ts
 * @description View Models for the Contracts module.
 * Extends base domain entities with computed relationship fields returned by DRF.
 * @architecture Enterprise SaaS 2026
 * @module panel/contracts/types
 */

import type { Participation, CrewAssignment } from '../../../shared/types';

export interface EnrichedParticipation extends Participation {
    artist_name?: string;
    artist_voice_type_display?: string;
}

export interface EnrichedCrewAssignment extends CrewAssignment {
    collaborator_name?: string;
    collaborator_specialty_display?: string;
}