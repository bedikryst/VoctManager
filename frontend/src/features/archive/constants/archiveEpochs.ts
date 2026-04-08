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
];

export const getArchiveEpochOptions = (t: TFunction): ArchiveEpochOption[] => {
  return ARCHIVE_EPOCH_DEFINITIONS.map(({ value, labelKey, defaultLabel }) => ({
    value,
    label: t(labelKey, defaultLabel),
  }));
};
