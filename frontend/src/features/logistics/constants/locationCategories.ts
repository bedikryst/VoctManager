/**
 * @file locationCategories.ts
 * @description Domain dictionary for logistics location categories.
 * Centralises i18n keys, lucide icons, and the shared accent so every
 * downstream surface (rows, chips, filters, atlas pins) speaks the same dialect.
 *
 * Ten categories, five accents — deliberately. The accent says what KIND of
 * place this is (a stage, a sanctuary, our own rooms, a transfer point, a place
 * that hosts us); the icon says which one. Chasing a distinct colour per
 * category is what put a hotel in `ethereal-crimson`, so every hotel pin on the
 * atlas wore the colour this product reserves for something being wrong.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/constants/locationCategories
 */

import type { TFunction } from "i18next";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  Church,
  CircleParking,
  Hotel,
  MapPin,
  Music,
  Plane,
  TrainFront,
  UtensilsCrossed,
} from "lucide-react";

import type { LocationCategory } from "@/shared/types";
import {
  ACCENT_MARKER,
  type EtherealAccent,
} from "@/shared/ui/primitives/accents";

interface LocationCategoryDefinition {
  value: LocationCategory;
  labelKey: string;
  defaultLabel: string;
  pluralKey: string;
  defaultPlural: string;
  descriptionKey: string;
  defaultDescription: string;
  icon: LucideIcon;
  accent: EtherealAccent;
}

export interface LocationCategoryOption {
  value: LocationCategory;
  label: string;
  plural: string;
  description: string;
  icon: LucideIcon;
  accent: EtherealAccent;
  /** The accent as a raw colour, for the Google Maps pins a class cannot style. */
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
    accent: "incense",
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
    accent: "graphite",
  },
  {
    value: "RESTAURANT",
    labelKey: "logistics.categories.restaurant",
    defaultLabel: "Restauracja",
    pluralKey: "logistics.categories_plural.restaurant",
    defaultPlural: "Restauracje",
    descriptionKey: "logistics.category_descriptions.restaurant",
    defaultDescription: "Miejsca posiłków zespołu w dniu wyjazdu.",
    icon: UtensilsCrossed,
    accent: "incense",
  },
  {
    value: "PARKING",
    labelKey: "logistics.categories.parking",
    defaultLabel: "Parking",
    pluralKey: "logistics.categories_plural.parking",
    defaultPlural: "Parkingi",
    descriptionKey: "logistics.category_descriptions.parking",
    defaultDescription: "Miejsca postoju i punkty odbioru autokaru.",
    icon: CircleParking,
    accent: "graphite",
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
    }) => ({
      value,
      label: t(labelKey, defaultLabel),
      plural: t(pluralKey, defaultPlural),
      description: t(descriptionKey, defaultDescription),
      icon,
      accent,
      atlasMarker: ACCENT_MARKER[accent],
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
