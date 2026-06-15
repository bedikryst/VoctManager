/**
 * @file contractsCsv.ts
 * @description Client-side accounting export for the settlements workspace. Turns
 * the loaded ledger into a Polish-Excel-friendly CSV (`;` separator, UTF-8 BOM,
 * comma decimals) and triggers a download — no backend, no new model.
 * @architecture Enterprise SaaS 2026
 * @module features/contracts/lib/contractsCsv
 */

import type { TFunction } from "i18next";
import type { LedgerEntry } from "../hooks/useContractsData";
import {
  getContractPersonName,
  getContractRoleLabel,
  getContractStatusMeta,
  isBillable,
  isPaid,
  parseFeeValue,
} from "./contractsPresentation";

const SEPARATOR = ";";

const escapeCell = (value: string): string =>
  /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const formatAmount = (value: number | null): string =>
  value == null ? "" : value.toFixed(2).replace(".", ",");

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getFullYear()}`;
};

const resolve = (
  meta: { translationKey: string; fallback: string },
  t: TFunction,
): string => (meta.translationKey ? t(meta.translationKey, meta.fallback) : meta.fallback);

/**
 * Builds the settlement CSV across the supplied ledger entries. Declined cast are
 * skipped (no money owed); everyone else is one row, paid or not.
 */
export const buildSettlementCsv = (
  entries: LedgerEntry[],
  t: TFunction,
): string => {
  const header = [
    t("contracts.csv.person", "Osoba"),
    t("contracts.csv.kind", "Typ"),
    t("contracts.csv.role", "Rola"),
    t("contracts.csv.project", "Projekt"),
    t("contracts.csv.event_date", "Data wydarzenia"),
    t("contracts.csv.amount", "Kwota (PLN)"),
    t("contracts.csv.paid", "Zapłacono"),
    t("contracts.csv.paid_date", "Data płatności"),
    t("contracts.csv.status", "Status"),
  ];

  const yes = t("contracts.csv.yes", "Tak");
  const no = t("contracts.csv.no", "Nie");
  const castLabel = t("contracts.sections.cast", "Obsada");
  const crewLabel = t("contracts.sections.crew", "Ekipa");

  const rows = entries
    .filter((entry) => isBillable(entry.record, entry.type))
    .map((entry) => {
      const { record, type, project } = entry;
      return [
        resolve(getContractPersonName(record, type), t),
        type === "CAST" ? castLabel : crewLabel,
        resolve(getContractRoleLabel(record, type), t),
        project.title,
        formatDate(project.date_time),
        formatAmount(parseFeeValue(record.fee)),
        isPaid(record) ? yes : no,
        formatDate(record.paid_at),
        resolve(getContractStatusMeta(record), t),
      ]
        .map((cell) => escapeCell(String(cell)))
        .join(SEPARATOR);
    });

  // UTF-8 BOM so Excel reads the Polish diacritics; CRLF line endings.
  return "﻿" + [header.map(escapeCell).join(SEPARATOR), ...rows].join("\r\n");
};

export const downloadCsv = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.style.display = "none";
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
};
