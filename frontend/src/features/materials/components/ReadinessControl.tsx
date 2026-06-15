/**
 * @file ReadinessControl.tsx
 * @description Three-state practice readiness self-report (segmented control)
 * plus a compact dot used on list rows. Sage = ready, gold = in progress,
 * neutral = untouched — consistent with the Ethereal status palette
 * (crimson stays reserved for alarms).
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck, CircleDashed, CircleDotDashed } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import type { MaterialsReadinessStatus } from "../types/materials.dto";

const STATES: readonly {
  id: MaterialsReadinessStatus;
  labelKey: string;
  fallback: string;
  Icon: typeof CircleDashed;
  activeClass: string;
}[] = [
  {
    id: "NOT_STARTED",
    labelKey: "materials.readiness.not_started",
    fallback: "Nie zaczęte",
    Icon: CircleDashed,
    activeClass:
      "bg-ethereal-marble/70 text-ethereal-graphite border-ethereal-incense/30",
  },
  {
    id: "IN_PROGRESS",
    labelKey: "materials.readiness.in_progress",
    fallback: "Ćwiczę",
    Icon: CircleDotDashed,
    activeClass: "bg-ethereal-gold/15 text-ethereal-gold border-ethereal-gold/30",
  },
  {
    id: "READY",
    labelKey: "materials.readiness.ready",
    fallback: "Znam partię",
    Icon: CircleCheck,
    activeClass: "bg-ethereal-sage/15 text-ethereal-sage border-ethereal-sage/30",
  },
];

interface ReadinessControlProps {
  value: MaterialsReadinessStatus;
  onChange: (next: MaterialsReadinessStatus) => void;
  disabled?: boolean;
  className?: string;
}

export const ReadinessControl = ({
  value,
  onChange,
  disabled = false,
  className,
}: ReadinessControlProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <div
      role="radiogroup"
      aria-label={t("materials.readiness.group_label", "Twoja gotowość")}
      className={cn(
        "flex w-full items-center gap-1 rounded-xl border border-ethereal-incense/20 bg-ethereal-alabaster p-1 shadow-glass-ethereal",
        className,
      )}
    >
      {STATES.map(({ id, labelKey, fallback, Icon, activeClass }) => {
        const isActive = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => {
              if (!isActive) onChange(id);
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-bold uppercase tracking-[0.08em] transition-all duration-200 active:scale-[0.97] disabled:opacity-50",
              isActive
                ? activeClass
                : "border-transparent text-ethereal-graphite/55 hover:bg-ethereal-marble/40 hover:text-ethereal-ink",
            )}
          >
            <Icon size={14} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{t(labelKey, fallback)}</span>
          </button>
        );
      })}
    </div>
  );
};

/** Compact status dot for list rows — readable at a glance, no interaction. */
export const ReadinessDot = ({
  value,
  className,
}: {
  value: MaterialsReadinessStatus;
  className?: string;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const state = STATES.find((entry) => entry.id === value) ?? STATES[0];
  const Icon = state.Icon;

  return (
    <span
      title={t(state.labelKey, state.fallback)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        value === "READY"
          ? "text-ethereal-sage"
          : value === "IN_PROGRESS"
            ? "text-ethereal-gold"
            : "text-ethereal-graphite/35",
        className,
      )}
    >
      <Icon size={15} aria-hidden="true" />
    </span>
  );
};
