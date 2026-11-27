/**
 * @file ListToolbar.tsx
 * @description The toolbar over a `RecordList`: the search and the list's
 * controls on one row, then one line that says what the list holds and how it
 * is narrowed.
 *
 * The row stays a row on a phone. Its controls are `ToolbarButton`s, which keep
 * their label from `md` up and stand as their icon alone below it, so the
 * search never drops to a band of its own with two full-width buttons under it.
 *
 * The census line carries, in order: the count (`ListCensus`, "16 utworów", or
 * "3 z 16" while anything narrows the list), the quick filters as
 * `FilterToggle` chips, and the filters in use as `FilterTokens`. It is the
 * list's one statement of its size, so the page above it states no count of
 * its own.
 *
 * The filters a list keeps out of sight wait in a `ToolbarPanel` between the
 * row and the census line, disclosed by a `ToolbarPanelButton` ("Filtry")
 * that counts those in use. The panel holds labelled `Select`s
 * (`ToolbarPanelField`), the list's order among them where it has one.
 * @module shared/ui/composites/ListToolbar
 */

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button, type ButtonProps } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";

interface ListToolbarProps {
  /** The search field; it takes the row's remaining width. */
  readonly search: React.ReactNode;
  /** `ToolbarButton`s after the search. */
  readonly controls?: React.ReactNode;
  /** The line under the row: `ListCensus`, then toggles, then tokens. */
  readonly census?: React.ReactNode;
  /** Rendered between the row and the census line (a filter panel). */
  readonly children?: React.ReactNode;
}

export const ListToolbar = ({
  search,
  controls,
  census,
  children,
}: ListToolbarProps): React.JSX.Element => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">{search}</div>
      {controls && <div className="flex shrink-0 items-center gap-2">{controls}</div>}
    </div>
    {children}
    {census && (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{census}</div>
    )}
  </div>
);

interface ListCensusProps {
  /** Records in the whole list. */
  readonly total: number;
  /** The plural noun for `total` ("utworów"). */
  readonly noun: string;
  /** "3 z 16", given while a search or a filter narrows the list. */
  readonly narrowed?: string | null;
}

/**
 * The list's size. A whole-list figure over a narrowed list reads as the count
 * of what is on screen, so while anything narrows it, the line says both.
 */
export const ListCensus = ({ total, noun, narrowed }: ListCensusProps): React.JSX.Element => (
  <Text as="span" size="sm" color="graphite" className="tabular-nums">
    {narrowed ? (
      narrowed
    ) : (
      <>
        <Text as="strong" size="sm" weight="semibold" color="default">
          {total}
        </Text>{" "}
        {noun}
      </>
    )}
  </Text>
);

interface ToolbarButtonProps
  extends Omit<ButtonProps, "children" | "leftIcon" | "rightIcon" | "casing" | "asChild"> {
  readonly icon: React.ReactNode;
  readonly label: string;
  /**
   * The pressed look: a mode that is on, or filters in use behind a
   * disclosure. The look only; a toggle also passes `aria-pressed`.
   */
  readonly on?: boolean;
  /** After the label from `md` up (a count, a chevron); dropped below it. */
  readonly trailing?: React.ReactNode;
}

/**
 * A toolbar's or a page header's action: its label from `md` up, its icon alone
 * in a 44 px square below it. The label stays in the accessible name at every
 * width. On is a gold-tinted fill on the outline, the look `FilterToggle`
 * shares, so a mode that is on reads as on without a second variant's glass.
 */
export const ToolbarButton = ({
  icon,
  label,
  on = false,
  trailing,
  variant = "outline",
  className,
  ...props
}: ToolbarButtonProps): React.JSX.Element => (
  <Button
    variant={variant}
    casing="sentence"
    leftIcon={icon}
    className={cn(
      "shrink-0 max-md:size-11 max-md:gap-0 max-md:p-0",
      on && "border-ethereal-gold/50 bg-ethereal-gold/15 text-ethereal-ink hover:bg-ethereal-gold/20",
      className,
    )}
    {...props}
  >
    <span className="max-md:sr-only">{label}</span>
    {trailing && <span className="inline-flex items-center gap-2 max-md:hidden">{trailing}</span>}
  </Button>
);

interface ToolbarPanelButtonProps {
  readonly label: string;
  /** The panel's filters in use: the pressed look and a count beside the label. */
  readonly count: number;
  readonly open: boolean;
  readonly onToggle: () => void;
  /** The `ToolbarPanel`'s id. */
  readonly panelId: string;
}

/** "Filtry": discloses the list's `ToolbarPanel` and counts the filters in use behind it. */
export const ToolbarPanelButton = ({
  label,
  count,
  open,
  onToggle,
  panelId,
}: ToolbarPanelButtonProps): React.JSX.Element => (
  <ToolbarButton
    icon={<SlidersHorizontal size={16} aria-hidden="true" />}
    label={label}
    on={count > 0}
    aria-expanded={open}
    aria-controls={panelId}
    onClick={onToggle}
    trailing={
      <>
        {count > 0 && (
          <Badge variant="warning" casing="natural" className="px-1.5 py-0 tabular-nums">
            {count}
          </Badge>
        )}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn("transition-transform", open && "rotate-180")}
        />
      </>
    }
  />
);

interface ToolbarPanelProps {
  readonly id: string;
  readonly open: boolean;
  /** `ToolbarPanelField`s, three to a row from `md` up. */
  readonly children: React.ReactNode;
}

/**
 * The filters a list keeps behind "Filtry". Opacity and a short drop, on the
 * compositor: the panel pushes the list down at once rather than growing into it.
 */
export const ToolbarPanel = ({ id, open, children }: ToolbarPanelProps): React.JSX.Element => (
  <AnimatePresence initial={false}>
    {open && (
      <motion.div
        id={id}
        initial={{ opacity: 0, transform: "translateY(-4px)" }}
        animate={{ opacity: 1, transform: "translateY(0px)" }}
        exit={{ opacity: 0, transform: "translateY(-4px)" }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="grid gap-3 rounded-nested border border-hairline bg-ethereal-alabaster/40 p-3 md:grid-cols-3">
          {children}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

interface ToolbarPanelFieldProps {
  /** Shown above the control; the control carries the same words as its own name. */
  readonly label: React.ReactNode;
  readonly children: React.ReactNode;
}

/** One labelled control in a `ToolbarPanel`. An unset filter reads "everything" on its placeholder. */
export const ToolbarPanelField = ({ label, children }: ToolbarPanelFieldProps): React.JSX.Element => (
  <div>
    <Text as="span" size="sm" color="graphite" className="mb-1 ml-1 block">
      {label}
    </Text>
    {children}
  </div>
);
