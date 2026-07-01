import type { TFunction } from "i18next";

interface ArchiveEpochDefinition {
  value: string;
  labelKey: string;
  defaultLabel: string;
}

export interface ArchiveEpochOption {
  value: string;
  label: string;
}

const ARCHIVE_EPOCH_DEFINITIONS: ArchiveEpochDefinition[] = [
  {
    value: "MED",
    labelKey: "archive.form.epochs.med",
    defaultLabel: "Średniowiecze",
  },
  {
    value: "REN",
    labelKey: "archive.form.epochs.ren",
    defaultLabel: "Renesans",
  },
  {
    value: "BAR",
    labelKey: "archive.form.epochs.bar",
    defaultLabel: "Barok",
  },
  {
    value: "CLA",
    labelKey: "archive.form.epochs.cla",
    defaultLabel: "Klasycyzm",
  },
  {
    value: "ROM",
    labelKey: "archive.form.epochs.rom",
    defaultLabel: "Romantyzm",
  },
  {
    value: "M20",
    labelKey: "archive.form.epochs.m20",
    defaultLabel: "XX wiek",
  },
  {
    value: "CON",
    labelKey: "archive.form.epochs.con",
    defaultLabel: "Muzyka Współczesna",
  },
  {
    value: "POP",
    labelKey: "archive.form.epochs.pop",
    defaultLabel: "Rozrywka",
  },
  {
    value: "FOLK",
    labelKey: "archive.form.epochs.folk",
    defaultLabel: "Folk / Ludowa",
  },
  {
    value: "OTH",
    labelKey: "archive.form.epochs.oth",
    defaultLabel: "Inne",
  },
];

export const getArchiveEpochOptions = (t: TFunction): ArchiveEpochOption[] => {
  return ARCHIVE_EPOCH_DEFINITIONS.map(({ value, labelKey, defaultLabel }) => ({
    value,
    label: t(labelKey, defaultLabel),
  }));
};

const EPOCH_DEFINITION_BY_VALUE = new Map(
  ARCHIVE_EPOCH_DEFINITIONS.map((definition) => [definition.value, definition]),
);

/** Localised label for a single epoch code (e.g. "FOLK" → "Folk / Ludowa").
 *  Falls back to the raw code for an unknown value so nothing renders blank. */
export const getArchiveEpochLabel = (
  code: string | null | undefined,
  t: TFunction,
): string => {
  if (!code) return "";
  const definition = EPOCH_DEFINITION_BY_VALUE.get(code);
  return definition ? t(definition.labelKey, definition.defaultLabel) : code;
};
