/**
 * @file locationCategories.ts
 * @description Domain dictionary for logistics location categories.
 * Centralises i18n keys, lucide icons, and Ethereal accent tokens so every
 * downstream surface (cards, badges, filters, atlas, editor) speaks the same dialect.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/constants/locationCategories
 */

import type { TFunction } from "i18next";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  Church,
  Hotel,
  MapPin,
  Music,
  Plane,
  TrainFront,
} from "lucide-react";

import type { LocationCategory } from "@/shared/types";

export type LocationCategoryAccent =
  | "gold"
  | "amethyst"
  | "crimson"
  | "sage"
  | "graphite"
  | "incense";

interface LocationCategoryDefinition {
  value: LocationCategory;
  labelKey: string;
  defaultLabel: string;
  pluralKey: string;
  defaultPlural: string;
  descriptionKey: string;
  defaultDescription: string;
  icon: LucideIcon;
  accent: LocationCategoryAccent;
  /** Marker color rendered on the global atlas. Token-driven via CSS variable. */
  atlasMarker: string;
}

export interface LocationCategoryOption {
  value: LocationCategory;
  label: string;
  plural: string;
  description: string;
  icon: LucideIcon;
  accent: LocationCategoryAccent;
  atlasMarker: string;
}

const LOCATION_CATEGORY_DEFINITIONS: LocationCategoryDefinition[] = [
  {
    value: "CONCERT_HALL",
    labelKey: "logistics.categories.concert_hall",
    defaultLabel: "Sala Koncertowa",
    pluralKey: "logistics.categories_plural.concert_hall",
    defaultPlural: "Sale Koncertowe",
    descriptionKey: "logistics.category_descriptions.concert_hall",
    defaultDescription: "Filharmonie, opery i sceny koncertowe.",
    icon: Music,
    accent: "gold",
    atlasMarker: "var(--color-ethereal-gold)",
  },
  {
    value: "CHURCH",
    labelKey: "logistics.categories.church",
    defaultLabel: "Kościół",
    pluralKey: "logistics.categories_plural.church",
    defaultPlural: "Kościoły",
    descriptionKey: "logistics.category_descriptions.church",
    defaultDescription: "Świątynie, bazyliki i sale parafialne.",
    icon: Church,
    accent: "sage",
  atlasMarker: "var(--color-ethereal-sage)",
  },
  {
    value: "REHEARSAL_ROOM",
    labelKey: "logistics.categories.rehearsal_room",
    defaultLabel: "Sala Prób",
    pluralKey: "logistics.categories_plural.rehearsal_room",
    defaultPlural: "Sale Prób",
    descriptionKey: "logistics.category_descriptions.rehearsal_room",
    defaultDescription: "Studia akustyczne i sale przygotowań.",
    icon: Building2,
    accent: "amethyst",
    atlasMarker: "var(--color-ethereal-amethyst)",
  },
  {
    value: "HOTEL",
    labelKey: "logistics.categories.hotel",
    defaultLabel: "Hotel",
    pluralKey: "logistics.categories_plural.hotel",
    defaultPlural: "Hotele",
    descriptionKey: "logistics.category_descriptions.hotel",
    defaultDescription: "Zakwaterowanie zespołu i artystów gościnnych.",
    icon: Hotel,
    accent: "crimson",
    atlasMarker: "var(--color-ethereal-crimson)",
  },
  {
    value: "AIRPORT",
    labelKey: "logistics.categories.airport",
    defaultLabel: "Lotnisko",
    pluralKey: "logistics.categories_plural.airport",
    defaultPlural: "Lotniska",
    descriptionKey: "logistics.category_descriptions.airport",
    defaultDescription: "Porty lotnicze obsługujące transfery zespołu.",
    icon: Plane,
    accent: "graphite",
    atlasMarker: "var(--color-ethereal-graphite)",
  },
  {
    value: "TRANSIT_STATION",
    labelKey: "logistics.categories.transit",
    defaultLabel: "Stacja / Dworzec",
    pluralKey: "logistics.categories_plural.transit",
    defaultPlural: "Dworce i Stacje",
    descriptionKey: "logistics.category_descriptions.transit",
    defaultDescription: "Stacje kolejowe, autobusowe i węzły transferowe.",
    icon: TrainFront,
    accent: "incense",
    atlasMarker: "var(--color-ethereal-incense)",
  },
  {
    value: "WORKSPACE",
    labelKey: "logistics.categories.workspace",
    defaultLabel: "Prywatna Przestrzeń",
    pluralKey: "logistics.categories_plural.workspace",
    defaultPlural: "Prywatne Przestrzenie",
    descriptionKey: "logistics.category_descriptions.workspace",
    defaultDescription: "Biura zespołu, studia i zaplecze produkcyjne.",
    icon: Briefcase,
    accent: "amethyst",
    atlasMarker: "var(--color-ethereal-amethyst)",
  },
  {
    value: "OTHER",
    labelKey: "logistics.categories.other",
    defaultLabel: "Inne",
    pluralKey: "logistics.categories_plural.other",
    defaultPlural: "Pozostałe",
    descriptionKey: "logistics.category_descriptions.other",
    defaultDescription: "Lokacje spoza standardowych grup.",
    icon: MapPin,
    accent: "incense",
    atlasMarker: "var(--color-ethereal-incense)",
  },
];

export const getLocationCategoryOptions = (
  t: TFunction,
): LocationCategoryOption[] =>
  LOCATION_CATEGORY_DEFINITIONS.map(
    ({
      value,
      labelKey,
      defaultLabel,
      pluralKey,
      defaultPlural,
      descriptionKey,
      defaultDescription,
      icon,
      accent,
      atlasMarker,
    }) => ({
      value,
      label: t(labelKey, defaultLabel),
      plural: t(pluralKey, defaultPlural),
      description: t(descriptionKey, defaultDescription),
      icon,
      accent,
      atlasMarker,
    }),
  );

export const getLocationCategoryOption = (
  t: TFunction,
  value: LocationCategory | string | null | undefined,
): LocationCategoryOption => {
  const options = getLocationCategoryOptions(t);
  return (
    options.find((option) => option.value === value) ??
    options[options.length - 1]
  );
};

export const LOCATION_CATEGORY_VALUES: ReadonlyArray<LocationCategory> =
  LOCATION_CATEGORY_DEFINITIONS.map((definition) => definition.value);
