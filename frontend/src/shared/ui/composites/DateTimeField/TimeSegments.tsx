/**
 * @file TimeSegments.tsx
 * @description The clock half of the date field: two typed segments rather than
 * a wheel. It keeps the one thing the native control was good at — typing 19:30
 * straight from the keyboard, and a numeric keypad on a phone — while the
 * chevrons give the same value a pointer-only path. Figures are sans and
 * tabular here by rule: this is a clock, not a display metric, and the digits
 * must not shift width as they change.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/DateTimeField
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { FIELD_TEXT_SCALE } from "@/shared/ui/primitives/fieldShell";
import {
  formatClock,
  parseClock,
  wrapHours,
  wrapMinutes,
  type Clock,
} from "./wallClock";

interface TimeSegmentsProps {
  /** `HH:mm`, or `""` when nothing is set yet. */
  readonly value: string;
  /** Always called with a complete `HH:mm`. */
  readonly onChange: (next: string) => void;
  /** Fires once focus leaves the whole control, not on every segment hop. */
  readonly onBlur?: () => void;
  readonly disabled?: boolean;
  /**
   * The clock a first keystroke lands on when the field is empty — only its
   * untouched half is used, so typing an hour into a blank field does not
   * invent a minute the user never chose.
   */
  readonly fallback?: string;
  /**
   * `roller` stacks a chevron above and below each segment (the panel and the
   * sheet); `inline` is the bare pair for a field cell in a dense row.
   */
  readonly layout?: "inline" | "roller";
  readonly hoursId?: string;
}

/** Arrow keys move minutes in fives — the resolution a rehearsal is planned at. */
const MINUTE_STEP = 5;
const DEFAULT_FALLBACK = "12:00";

const pad = (value: number): string => String(value).padStart(2, "0");

const digitsOnly = (raw: string): string => raw.replace(/\D/g, "").slice(0, 2);

export const TimeSegments = ({
  value,
  onChange,
  onBlur,
  disabled,
  fallback = DEFAULT_FALLBACK,
  layout = "inline",
  hoursId,
}: TimeSegmentsProps): React.JSX.Element => {
  const { t } = useTranslation();
  const hoursRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const isEditingRef = useRef(false);
  const [hoursText, setHoursText] = useState("");
  const [minutesText, setMinutesText] = useState("");

  const isRoller = layout === "roller";

  /**
   * The committed value owns the display except while the control is being
   * typed into — a half-typed "1" must survive the parent's re-render, or every
   * second keystroke is swallowed.
   */
  useEffect(() => {
    if (isEditingRef.current) {
      return;
    }

    const clock = parseClock(value);
    setHoursText(clock ? pad(clock.hours) : "");
    setMinutesText(clock ? pad(clock.minutes) : "");
  }, [value]);

  const baseClock = (): Clock => parseClock(value) ?? parseClock(fallback) ?? { hours: 12, minutes: 0 };

  const commit = (next: Clock): void => {
    onChange(
      formatClock({
        hours: wrapHours(next.hours),
        minutes: wrapMinutes(next.minutes),
      }),
    );
  };

  const handleHoursInput = (raw: string): void => {
    const digits = digitsOnly(raw);
    isEditingRef.current = true;

    if (digits === "") {
      setHoursText("");
      return;
    }

    const typed = Number(digits);

    // A first digit above 2 can only be a single-digit hour, so it completes
    // the segment on its own — the same shortcut the native field takes.
    if (digits.length === 1 && typed > 2) {
      setHoursText(pad(typed));
      commit({ ...baseClock(), hours: typed });
      minutesRef.current?.focus();
      minutesRef.current?.select();
      return;
    }

    const hours = Math.min(typed, 23);
    setHoursText(digits);
    commit({ ...baseClock(), hours });

    if (digits.length === 2) {
      minutesRef.current?.focus();
      minutesRef.current?.select();
    }
  };

  const handleMinutesInput = (raw: string): void => {
    const digits = digitsOnly(raw);
    isEditingRef.current = true;

    if (digits === "") {
      setMinutesText("");
      return;
    }

    const typed = Number(digits);

    if (digits.length === 1 && typed > 5) {
      setMinutesText(pad(typed));
      commit({ ...baseClock(), minutes: typed });
      return;
    }

    const minutes = Math.min(typed, 59);
    setMinutesText(digits);
    commit({ ...baseClock(), minutes });
  };

  const stepHours = (delta: number): void => {
    const base = baseClock();
    commit({ ...base, hours: base.hours + delta });
  };

  const stepMinutes = (delta: number): void => {
    const base = baseClock();
    commit({ ...base, minutes: base.minutes + delta });
  };

  const handleSegmentKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    segment: "hours" | "minutes",
  ): void => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }

    event.preventDefault();
    isEditingRef.current = false;
    const direction = event.key === "ArrowUp" ? 1 : -1;

    if (segment === "hours") {
      stepHours(direction);
      return;
    }

    stepMinutes(direction * (event.shiftKey ? 1 : MINUTE_STEP));
  };

  /** Focus hopping between the two segments must not read as leaving the field. */
  const handleBlurCapture = (event: React.FocusEvent<HTMLDivElement>): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    isEditingRef.current = false;
    const clock = parseClock(value);
    setHoursText(clock ? pad(clock.hours) : "");
    setMinutesText(clock ? pad(clock.minutes) : "");
    onBlur?.();
  };

  const segmentClassName = cn(
    "bg-transparent text-center tabular-nums text-ethereal-ink caret-ethereal-gold focus:outline-none disabled:cursor-not-allowed",
    isRoller
      ? "w-12 text-2xl font-medium"
      : `w-9 ${FIELD_TEXT_SCALE.sm} font-medium`,
  );

  const chevronClassName =
    "flex h-6 w-full items-center justify-center rounded-chip text-ethereal-graphite/50 transition-colors hover:bg-ethereal-parchment/70 hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 disabled:pointer-events-none disabled:opacity-40";

  const renderSegment = (segment: "hours" | "minutes"): React.JSX.Element => {
    const isHours = segment === "hours";
    const label = isHours
      ? t("shared.datetime.hours", "Godziny")
      : t("shared.datetime.minutes", "Minuty");

    return (
      <div className="flex flex-col items-center">
        {isRoller && (
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label={t("shared.datetime.step_up", "Zwiększ {{segment}}", {
              segment: label.toLowerCase(),
            })}
            onClick={() =>
              isHours ? stepHours(1) : stepMinutes(MINUTE_STEP)
            }
            className={chevronClassName}
          >
            <ChevronUp size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}

        <input
          ref={isHours ? hoursRef : minutesRef}
          id={isHours ? hoursId : undefined}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          disabled={disabled}
          aria-label={label}
          placeholder="--"
          value={isHours ? hoursText : minutesText}
          onChange={(event) =>
            isHours
              ? handleHoursInput(event.target.value)
              : handleMinutesInput(event.target.value)
          }
          onKeyDown={(event) => handleSegmentKeyDown(event, segment)}
          onFocus={(event) => event.target.select()}
          className={segmentClassName}
        />

        {isRoller && (
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label={t("shared.datetime.step_down", "Zmniejsz {{segment}}", {
              segment: label.toLowerCase(),
            })}
            onClick={() =>
              isHours ? stepHours(-1) : stepMinutes(-MINUTE_STEP)
            }
            className={chevronClassName}
          >
            <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      onBlur={handleBlurCapture}
      className={cn(
        "flex items-center justify-center",
        isRoller ? "gap-1" : "gap-0.5",
      )}
    >
      {renderSegment("hours")}
      <span
        aria-hidden="true"
        className={cn(
          "text-ethereal-graphite/50",
          // Tracks the digits either side of it, including their touch size.
          isRoller ? "pb-0.5 text-xl" : FIELD_TEXT_SCALE.sm,
        )}
      >
        :
      </span>
      {renderSegment("minutes")}
    </div>
  );
};
