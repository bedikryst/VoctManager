/**
 * @file SearchSelect.tsx
 * @description A select for a list the reader searches rather than scans: long
 * labels, many of them beginning alike. The field opens a filter over the
 * options; an option may carry a second line that tells two similar labels
 * apart, and the list may end in an action that creates the entry the filter
 * did not find. Labels wrap instead of truncating — the label is the answer,
 * and a clipped one is a guess.
 * Same field shell as `Select` and `DateTimeField`, and the same split as the
 * date field: a popover under a fine pointer, a bottom sheet under a finger.
 * @module shared/ui/composites/SearchSelect
 */

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { foldDiacritics } from "@/shared/lib/text";
import { useIsFinePointer } from "@/shared/lib/dom/useMediaQuery";
import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import {
  FIELD_TEXT_SCALE,
  fieldShellVariants,
  type FieldShellVariantProps,
} from "@/shared/ui/primitives/fieldShell";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

/** Vertical density, matching `Select`: `sm` for a control packed into a dense row. */
const TRIGGER_SIZE = {
  default: "py-3",
  sm: "py-1.5",
} as const;

export interface SearchSelectOption {
  readonly value: string;
  readonly label: string;
  /** A second line under the label — what tells two similar labels apart. */
  readonly description?: string;
}

export interface SearchSelectAction {
  readonly label: string;
  readonly icon?: React.ReactNode;
  /** Receives the filter's text, so the new entry can start from what was typed. */
  readonly onSelect: (query: string) => void;
}

export interface SearchSelectProps
  extends Omit<FieldShellVariantProps, "hasError"> {
  readonly options: readonly SearchSelectOption[];
  /** `""` means nothing is selected — the placeholder shows instead. */
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly label?: string;
  readonly ariaLabel?: string;
  readonly placeholder?: string;
  readonly searchPlaceholder?: string;
  /**
   * Adds an entry that returns the field to "nothing selected" — only where
   * empty is a real answer, as on `Select`.
   */
  readonly clearLabel?: string;
  /** A last row that acts instead of choosing: creating what was not found. */
  readonly action?: SearchSelectAction;
  readonly leftIcon?: React.ReactNode;
  readonly size?: keyof typeof TRIGGER_SIZE;
  readonly error?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly name?: string;
  readonly className?: string;
}

type Entry =
  | { readonly kind: "clear" }
  | { readonly kind: "option"; readonly option: SearchSelectOption }
  | { readonly kind: "action" };

/**
 * Every word of the query must appear somewhere in the label or its second
 * line, in any order: "wizytek krakowskie" finds the church by its name and its
 * street at once, which a single substring never would.
 */
const matchesQuery = (
  option: SearchSelectOption,
  terms: readonly string[],
): boolean => {
  if (terms.length === 0) return true;
  const haystack = foldDiacritics(`${option.label} ${option.description ?? ""}`);
  return terms.every((term) => haystack.includes(term));
};

export const SearchSelect = ({
  options,
  value,
  onValueChange,
  label,
  ariaLabel,
  placeholder,
  searchPlaceholder,
  clearLabel,
  action,
  leftIcon,
  size = "default",
  error,
  required,
  disabled,
  id,
  name,
  variant,
  className,
}: SearchSelectProps): React.JSX.Element => {
  const { t } = useTranslation();
  const internalId = useId();
  const isFinePointer = useIsFinePointer();
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const fieldId = id ?? internalId;
  const errorId = `${fieldId}-error`;
  const listboxId = `${fieldId}-listbox`;
  const hasError = Boolean(error);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((option) => option.value === value) ?? null;
  const trimmedQuery = query.trim();

  const entries = useMemo<readonly Entry[]>(() => {
    const terms = foldDiacritics(trimmedQuery).split(/\s+/).filter(Boolean);
    const matches = options
      .filter((option) => matchesQuery(option, terms))
      .map((option): Entry => ({ kind: "option", option }));
    return [
      // Clearing is not something one searches for; it leaves the list once a
      // query is typed, so the first row is always the best match.
      ...(clearLabel && terms.length === 0 ? [{ kind: "clear" } as const] : []),
      ...matches,
      ...(action ? [{ kind: "action" } as const] : []),
    ];
  }, [options, trimmedQuery, clearLabel, action]);

  const optionEntryCount = entries.filter((entry) => entry.kind === "option").length;
  const actionIndex = action ? entries.length - 1 : -1;

  const handleOpenChange = (next: boolean): void => {
    if (next) {
      // Every opening starts on the chosen row, not where the last one left off.
      const selectedIndex = entries.findIndex(
        (entry) => entry.kind === "option" && entry.option.value === value,
      );
      setActiveIndex(Math.max(0, selectedIndex));
    } else {
      setQuery("");
    }
    setIsOpen(next);
  };

  const handleQueryChange = (next: string): void => {
    setQuery(next);
    setActiveIndex(0);
  };

  const choose = (entry: Entry): void => {
    const typed = trimmedQuery;
    handleOpenChange(false);
    if (entry.kind === "action") {
      action?.onSelect(typed);
      return;
    }
    onValueChange(entry.kind === "clear" ? "" : entry.option.value);
  };

  useEffect(() => {
    if (!isOpen) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-entry-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ): void => {
    const count = entries.length;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (count === 0 ? 0 : (current + 1) % count));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        count === 0 ? 0 : (current - 1 + count) % count,
      );
    } else if (event.key === "Enter") {
      // The list is portalled out of the form, but Enter is still not a submit.
      event.preventDefault();
      const entry = entries[activeIndex];
      if (entry) choose(entry);
    }
  };

  /**
   * Arrows open the list, and a letter typed on the closed field opens it with
   * the filter already holding that letter — the field is searched, so typing
   * at it is the expected first move. Space and Enter stay the button's own.
   */
  const handleTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ): void => {
    if (isOpen) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      handleOpenChange(true);
      return;
    }
    const isCharacter =
      event.key.length === 1 &&
      event.key !== " " &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey;
    if (isCharacter && isFinePointer) {
      event.preventDefault();
      handleOpenChange(true);
      handleQueryChange(event.key);
    }
  };

  const textSize = size === "sm" ? "sm" : "base";

  const triggerContent = (
    <>
      {leftIcon && (
        <span
          className="pointer-events-none absolute left-4 hidden text-ethereal-graphite/55 sm:flex"
          aria-hidden="true"
        >
          {React.isValidElement(leftIcon)
            ? React.cloneElement(
                leftIcon as React.ReactElement<{
                  size?: number;
                  strokeWidth?: number;
                }>,
                { size: 16, strokeWidth: 1.5 },
              )
            : leftIcon}
        </span>
      )}

      {selected ? (
        // The label keeps its full width while it fits; the second line yields
        // first, so a long address never pushes the name out of the field.
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <Text
            as="span"
            size={textSize}
            color="inherit"
            truncate
            className="min-w-0 max-w-full shrink-0"
          >
            {selected.label}
          </Text>
          {selected.description && (
            <Caption truncate className="min-w-0 flex-1">
              {selected.description}
            </Caption>
          )}
        </span>
      ) : (
        <Text
          as="span"
          size={textSize}
          color="incense"
          truncate
          className="min-w-0 flex-1"
        >
          {placeholder}
        </Text>
      )}

      <ChevronDown
        size={16}
        strokeWidth={1.5}
        className={cn(
          "shrink-0",
          variant === "dark"
            ? "text-ink-on-inverse/60"
            : "text-ethereal-graphite/60",
        )}
        aria-hidden="true"
      />
    </>
  );

  const triggerProps = {
    id: fieldId,
    type: "button" as const,
    disabled,
    "aria-label": ariaLabel,
    "aria-haspopup": "listbox" as const,
    "aria-expanded": isOpen,
    "aria-invalid": hasError,
    "aria-describedby": hasError ? errorId : undefined,
    onKeyDown: handleTriggerKeyDown,
    className: cn(
      fieldShellVariants({ variant, hasError }),
      "relative flex items-center justify-between gap-2 text-left",
      TRIGGER_SIZE[size],
      // The icon is hidden on phones, so its inset is only reserved from sm up
      // — same contract as `Input` and `Select`.
      leftIcon ? "pl-4 sm:pl-11" : "pl-4",
      "pr-4",
      className,
    ),
  };

  const activeDescendant =
    entries.length > 0 ? `${listboxId}-${activeIndex}` : undefined;

  const renderEntry = (entry: Entry, index: number): React.JSX.Element => {
    const isActive = index === activeIndex;
    const isSelected = entry.kind === "option" && entry.option.value === value;
    const isAction = entry.kind === "action";

    return (
      <div
        key={entry.kind === "option" ? entry.option.value : entry.kind}
        id={`${listboxId}-${index}`}
        role="option"
        aria-selected={isSelected}
        data-entry-index={index}
        onMouseMove={() => setActiveIndex(index)}
        // Focus stays in the filter: a row is chosen, never focused.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => choose(entry)}
        className={cn(
          "flex cursor-pointer select-none items-start gap-2.5 rounded-control px-3 transition-colors",
          isFinePointer ? "py-2" : "py-3",
          isActive && "bg-ethereal-marble/70",
          isAction
            ? "text-ethereal-gold"
            : entry.kind === "clear"
              ? "italic text-ethereal-graphite/70"
              : "text-ethereal-graphite",
          isActive && !isAction && "text-ethereal-ink",
        )}
      >
        {isAction && action?.icon && (
          <span className="mt-0.5 flex shrink-0" aria-hidden="true">
            {action.icon}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Text as="span" size="sm" weight="medium" color="inherit">
            {entry.kind === "option"
              ? entry.option.label
              : entry.kind === "clear"
                ? clearLabel
                : action?.label}
          </Text>
          {entry.kind === "option" && entry.option.description && (
            <Caption truncate>{entry.option.description}</Caption>
          )}
        </span>
        {isSelected && (
          <Check
            size={14}
            className="mt-0.5 shrink-0 text-ethereal-gold"
            aria-hidden="true"
          />
        )}
      </div>
    );
  };

  const listEntries = entries.filter((entry) => entry.kind !== "action");

  const body = (
    <div className="flex min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2.5 px-3 py-2.5">
        <Search
          size={16}
          strokeWidth={1.75}
          className="shrink-0 text-ethereal-incense"
          aria-hidden="true"
        />
        <input
          ref={searchRef}
          type="text"
          role="combobox"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={
            searchPlaceholder ?? t("shared.search_select.search", "Szukaj…")
          }
          aria-label={
            searchPlaceholder ?? t("shared.search_select.search", "Szukaj…")
          }
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          autoComplete="off"
          className={cn(
            "min-w-0 flex-1 bg-transparent text-ethereal-ink outline-none placeholder:text-ethereal-incense/80",
            FIELD_TEXT_SCALE.search,
          )}
        />
      </div>

      <div
        id={listboxId}
        role="listbox"
        aria-label={label ?? ariaLabel}
        className="flex min-h-0 flex-col border-t border-hairline"
      >
        <div
          ref={listRef}
          className={cn(
            "flex flex-col p-1.5",
            isFinePointer && "no-scrollbar max-h-80 overflow-y-auto overscroll-contain",
          )}
        >
          {listEntries.map((entry) => renderEntry(entry, entries.indexOf(entry)))}

          {optionEntryCount === 0 && trimmedQuery !== "" && (
            <Caption className="px-3 py-2">
              {t("shared.search_select.empty", "Nic nie pasuje do „{{query}}”.", {
                query: trimmedQuery,
              })}
            </Caption>
          )}
        </div>

        {/* Outside the scroll, so creating is in reach however long the list. */}
        {action && (
          <div className="shrink-0 border-t border-hairline p-1.5">
            {renderEntry({ kind: "action" }, actionIndex)}
          </div>
        )}
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
                align="start"
                sideOffset={8}
                collisionPadding={12}
                // The caret goes after the letter the closed field was typed
                // at, not before it, where a bare focus() may leave it.
                onOpenAutoFocus={(event) => {
                  event.preventDefault();
                  const input = searchRef.current;
                  if (!input) return;
                  input.focus();
                  input.setSelectionRange(input.value.length, input.value.length);
                }}
                // Never narrower than the field, and wide enough in a dense row
                // for a two-line name to read without wrapping at every word.
                className="z-popover flex max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) min-w-80 max-w-(--radix-popover-content-available-width) origin-(--radix-popover-content-transform-origin) flex-col overflow-hidden rounded-nested border border-ethereal-incense/15 bg-ethereal-alabaster/95 shadow-glass-ethereal popover-motion"
              >
                {body}
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
          input laid over the field — the same device as `DateTimeField`.
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
          title={(label ?? ariaLabel ?? placeholder ?? "").replace(/\s*\*$/, "")}
        >
          {body}
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
