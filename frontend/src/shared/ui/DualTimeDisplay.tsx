/**
 * @file DualTimeDisplay.tsx
 * @description Enterprise UI Component for dual-timezone time presentation.
 * Automatically handles the display of event timezone vs local user timezone.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { formatLocalizedTime, isDifferentTimezone } from "../lib/intl";

export interface DualTimeDisplayProps {
  value: Date | string | number | null | undefined;
  timeZone?: string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  containerClassName?: string;
  primaryTimeClassName?: string;
  localTimeClassName?: string;
}

export const DualTimeDisplay: React.FC<DualTimeDisplayProps> = ({
  value,
  timeZone,
  label,
  icon,
  containerClassName = "flex flex-col gap-1",
  primaryTimeClassName = "flex items-center gap-2",
  localTimeClassName = "text-[10px] font-medium pl-6 opacity-70",
}) => {
  const { t } = useTranslation();

  if (!value) return null;

  // Sprawdzamy, czy strefa wydarzenia różni się od strefy użytkownika
  const hasDiffTz = isDifferentTimezone(timeZone);

  // Dynamiczne opcje formatera - dodajemy skrót (np. CEST) TYLKO gdy strefy się różnią
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    ...(hasDiffTz && { timeZoneName: "short" }),
  };

  return (
    <div className={containerClassName}>
      <span className={primaryTimeClassName}>
        {icon}
        {label && <span>{label}</span>}
        {formatLocalizedTime(value, timeOptions, undefined, timeZone)}
      </span>
      {hasDiffTz && (
        <span className={localTimeClassName}>
          ({t("common.timezone.local", "Twój czas:")}{" "}
          {formatLocalizedTime(value, { hour: "2-digit", minute: "2-digit" })})
        </span>
      )}
    </div>
  );
};
