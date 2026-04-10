/**
 * @file DualTimeDisplay.tsx
 * @description Enterprise UI Component for dual-timezone time presentation.
 * Automatically handles the display of event timezone vs local user timezone from their profile.
 * @architecture Enterprise SaaS 2026
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { formatLocalizedTime } from "../lib/intl";
import { useAuth } from "../../app/providers/AuthProvider";

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
  primaryTimeClassName = "flex items-center gap-2 font-semibold",
  localTimeClassName = "text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-6 opacity-80",
}) => {
  const { t } = useTranslation();
  const { user } = useAuth(); // 1. Pobieramy profil użytkownika

  if (!value) return null;

  // 2. Bezpieczny fallback dla stref:
  // Czas użytkownika (z profilu) vs Czas wydarzenia (z bazy danych)
  const userTimezone = user?.profile?.timezone || "UTC";
  const eventTimezone = timeZone || "Europe/Warsaw"; // domyślna strefa eventów

  // 3. Porównujemy bezpośrednio profil ze strefą wydarzenia, ignorując zegar sprzętowy przeglądarki
  const hasDiffTz = eventTimezone !== userTimezone;

  const primaryTimeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    ...(hasDiffTz && { timeZoneName: "short" }),
  };

  const localTimeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short", // Pokazujemy skrót dla czasu lokalnego dla jasności (np. EST)
  };

  return (
    <div className={containerClassName}>
      <span className={primaryTimeClassName}>
        {icon}
        {label && <span>{label}</span>}
        {/* Czas GŁÓWNY (Wydarzenia) */}
        {formatLocalizedTime(
          value,
          primaryTimeOptions,
          undefined,
          eventTimezone,
        )}
      </span>
      {hasDiffTz && (
        <span className={localTimeClassName}>
          ({t("common.timezone.local", "Twój czas:")}{" "}
          {/* Czas LOKALNY (Z profilu użytkownika) */}
          {formatLocalizedTime(
            value,
            localTimeOptions,
            undefined,
            userTimezone,
          )}
          )
        </span>
      )}
    </div>
  );
};
