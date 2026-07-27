/**
 * @file DateTimeField.tsx
 * @description The panel's date-and-time field. It replaces `datetime-local`,
 * which was the last control in the app still handing its popup to the
 * operating system — a grey Chrome grid in the middle of a parchment form, and
 * a different one on every machine the foundation uses.
 * One field opens one panel: the month above, the clock below, because a
 * concert is a moment and not two unrelated answers. The value never leaves the
 * `yyyy-MM-ddTHH:mm` wall-clock contract the forms already speak, so the venue's
 * timezone keeps owning what the hour means.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/DateTimeField
 */

import React, { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as Popover from "@radix-ui/react-popover";
import { motion } from "framer-motion";
import { CalendarDays } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { getDateFnsLocale } from "@/shared/lib/time/dateFnsLocale";
import { useIsFinePointer } from "@/shared/lib/dom/useMediaQuery";
import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { Button } from "@/shared/ui/primitives/Button";
import {
  fieldShellVariants,
  type FieldShellVariantProps,
} from "@/shared/ui/primitives/fieldShell";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { CalendarGrid, type CalendarMarker } from "./CalendarGrid";
import { TimeSegments } from "./TimeSegments";
import {
  formatClock,
  formatTriggerDate,
  formatWallClock,
  parseClock,
  parseWallClock,
  toFloatingDate,
  todayCalendarDate,
  type CalendarDate,
  type Clock,
} from "./wallClock";

export interface DateTimeFieldProps
  extends Omit<FieldShellVariantProps, "hasError"> {
  /** `yyyy-MM-ddTHH:mm` wall-clock in the event's timezone, or `""`. */
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly label?: string;
  readonly ariaLabel?: string;
  readonly placeholder?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  /** Offers an explicit way back to "not set" — only where empty is a real answer. */
  readonly clearable?: boolean;
  /** Days worth seeing while choosing: the concert, the sessions already booked. */
  readonly markers?: readonly CalendarMarker[];
  /** The hour a first pick lands on when the field is still empty. */
  readonly defaultTime?: string;
  /**
   * The day an empty field opens on, as a full wall-clock value. A call time is
   * set against the concert, not against today, and starting the month on the
   * event saves the producer navigating to it every single time.
   */
  readonly anchorValue?: string;
  readonly id?: string;
  readonly name?: string;
  readonly className?: string;
}

const FALLBACK_CLOCK: Clock = { hours: 12, minutes: 0 };

export const DateTimeField = ({
  value,
  onChange,
  label,
  ariaLabel,
  placeholder,
  error,
  required,
  disabled,
  clearable,
  markers,
  defaultTime,
  anchorValue,
  id,
  name,
  variant,
  className,
}: DateTimeFieldProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const internalId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const isFinePointer = useIsFinePointer();

  const fieldId = id ?? internalId;
  const errorId = `${fieldId}-error`;
  const timeId = `${fieldId}-hours`;
  const hasError = Boolean(error);

  const locale = getDateFnsLocale(i18n.language);
  const parsed = parseWallClock(value);
  const selectedDate: CalendarDate | null = parsed
    ? { year: parsed.year, month: parsed.month, day: parsed.day }
    : null;

  const anchor = parseWallClock(anchorValue);
  const openingDate: CalendarDate =
    selectedDate ??
    (anchor ? { year: anchor.year, month: anchor.month, day: anchor.day } : null) ??
    todayCalendarDate();

  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() =>
    toFloatingDate(openingDate),
  );

  /** Every opening starts on the month the value is in, not where it was left. */
  const handleOpenChange = (next: boolean): void => {
    if (next) {
      setVisibleMonth(toFloatingDate(openingDate));
    }
    setIsOpen(next);
  };

  const handleSelectDay = (date: CalendarDate): void => {
    const clock = parsed ?? parseClock(defaultTime) ?? FALLBACK_CLOCK;
    onChange(
      formatWallClock({
        ...date,
        hours: clock.hours,
        minutes: clock.minutes,
      }),
    );
  };

  const handleTimeChange = (next: string): void => {
    const clock = parseClock(next);
    if (!clock) {
      return;
    }

    onChange(
      formatWallClock({ ...(selectedDate ?? todayCalendarDate()), ...clock }),
    );
  };

  const handleToday = (): void => {
    const today = todayCalendarDate();
    setVisibleMonth(toFloatingDate(today));
    handleSelectDay(today);
  };

  const handleClear = (): void => {
    onChange("");
    handleOpenChange(false);
  };

  const triggerContent = (
    <>
      {parsed ? (
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <Text as="span" size="base" truncate className="min-w-0">
            {formatTriggerDate(parsed, locale)}
          </Text>
          <Text
            as="span"
            size="base"
            weight="medium"
            className="shrink-0 tabular-nums"
          >
            {formatClock(parsed)}
          </Text>
        </span>
      ) : (
        <Text as="span" size="base" color="incense" className="min-w-0 flex-1 truncate">
          {placeholder ??
            t("shared.datetime.placeholder", "Wybierz datę i godzinę")}
        </Text>
      )}

      <CalendarDays
        size={16}
        strokeWidth={1.5}
        className="shrink-0 text-ethereal-graphite/60"
        aria-hidden="true"
      />
    </>
  );

  const triggerClassName = cn(
    fieldShellVariants({ variant, hasError }),
    "relative flex items-center justify-between gap-3 px-4 py-3 text-left",
    className,
  );

  const triggerProps = {
    id: fieldId,
    type: "button" as const,
    disabled,
    "aria-label": ariaLabel,
    "aria-invalid": hasError,
    "aria-describedby": hasError ? errorId : undefined,
    className: triggerClassName,
  };

  const panel = (
    <div
      className={cn("flex flex-col gap-3", isFinePointer ? "w-72" : "w-full")}
    >
      <CalendarGrid
        selected={selectedDate}
        visibleMonth={visibleMonth}
        onVisibleMonthChange={setVisibleMonth}
        onSelect={handleSelectDay}
        locale={locale}
        markers={markers}
        size={isFinePointer ? "md" : "touch"}
      />

      <div className="flex items-center justify-between gap-3 border-t border-hairline pt-3">
        <Eyebrow as="label" htmlFor={timeId} color="muted">
          {t("shared.datetime.time", "Godzina")}
        </Eyebrow>
        <TimeSegments
          layout="roller"
          hoursId={timeId}
          value={parsed ? formatClock(parsed) : ""}
          fallback={defaultTime}
          onChange={handleTimeChange}
        />
      </div>
    </div>
  );

  const actions = (
    <div className="flex items-center justify-between gap-2">
      <Button
        type="button"
        variant="ghost"
        size={isFinePointer ? "sm" : "touch"}
        onClick={handleToday}
      >
        {t("shared.datetime.today", "Dziś")}
      </Button>

      <div className="flex items-center gap-2">
        {clearable && value !== "" && (
          <Button
            type="button"
            variant="ghost"
            size={isFinePointer ? "sm" : "touch"}
            onClick={handleClear}
          >
            {t("common.actions.clear", "Wyczyść")}
          </Button>
        )}
        <Button
          type="button"
          variant="primary"
          size={isFinePointer ? "sm" : "touch"}
          onClick={() => handleOpenChange(false)}
        >
          {t("shared.datetime.done", "Gotowe")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <Eyebrow as="label" htmlFor={fieldId} color="muted" className="ml-1">
          {label}
        </Eyebrow>
      )}

      <div className="relative">
        {isFinePointer ? (
          <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Popover.Trigger asChild>
              <button {...triggerProps}>{triggerContent}</button>
            </Popover.Trigger>

            <Popover.Portal>
              <Popover.Content
                ref={contentRef}
                align="start"
                sideOffset={8}
                collisionPadding={12}
                // Focus lands on the chosen day, not on the "previous month"
                // arrow the DOM order would otherwise hand it.
                onOpenAutoFocus={(event) => {
                  event.preventDefault();
                  contentRef.current
                    ?.querySelector<HTMLButtonElement>(
                      '[data-date-key][tabindex="0"]',
                    )
                    ?.focus();
                }}
                className="z-popover w-auto rounded-nested border border-ethereal-incense/15 bg-ethereal-alabaster/95 p-3 shadow-glass-ethereal backdrop-blur-ethereal"
              >
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="flex flex-col gap-3"
                >
                  {panel}
                  <div className="border-t border-hairline pt-3">{actions}</div>
                </motion.div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : (
          <button {...triggerProps} onClick={() => handleOpenChange(true)}>
            {triggerContent}
          </button>
        )}

        {/*
          A button cannot be `required`, so the constraint rides on a mirror
          input laid over the field: transparent and out of the tab order, but
          still focusable, which is what lets the browser anchor its validation
          bubble on the field instead of refusing to submit in silence.
        */}
        {required && (
          <input
            tabIndex={-1}
            aria-hidden="true"
            name={name}
            required
            value={value}
            onChange={() => undefined}
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          />
        )}
      </div>

      {!isFinePointer && (
        <BottomSheet
          isOpen={isOpen}
          onClose={() => handleOpenChange(false)}
          // A required marker belongs on the field, not in a sheet's heading.
          title={(label ?? t("shared.datetime.time", "Godzina")).replace(
            /\s*\*$/,
            "",
          )}
          footer={actions}
        >
          <div className="pt-1">{panel}</div>
        </BottomSheet>
      )}

      {hasError && (
        <Text
          as="span"
          id={errorId}
          role="alert"
          size="xs"
          color="crimson"
          className="ml-1 font-medium"
        >
          {error}
        </Text>
      )}
    </div>
  );
};
