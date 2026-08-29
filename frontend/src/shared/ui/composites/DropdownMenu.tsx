/**
 * @file DropdownMenu.tsx
 * @description Themed, accessible dropdown menu built on `@radix-ui/react-dropdown-menu`.
 * Wraps the headless primitive in the Ethereal glass language (tokens only — no raw
 * colors or magic z-index) so feature surfaces get keyboard nav, focus management and
 * portalling for free. Use for occasional, grouped actions (exports, overflow) that
 * would otherwise crowd a header, or — via the radio group — for a setting that
 * belongs beside them rather than in a settings page.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/DropdownMenu
 */

import React from "react";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

/** Shared by the action item and the radio item, so one menu reads as one list. */
const MENU_ROW_CLASS =
  "group flex cursor-pointer select-none gap-2.5 rounded-control px-3 py-2 outline-none transition-colors focus:bg-ethereal-marble/70 data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export const DropdownMenu = RadixDropdown.Root;
export const DropdownMenuTrigger = RadixDropdown.Trigger;

export interface DropdownMenuContentProps {
  children: React.ReactNode;
  /** Preferred side of the trigger to render against. */
  side?: RadixDropdown.DropdownMenuContentProps["side"];
  /** Alignment along the trigger edge. */
  align?: RadixDropdown.DropdownMenuContentProps["align"];
  className?: string;
}

export const DropdownMenuContent = ({
  children,
  side = "bottom",
  align = "end",
  className,
}: DropdownMenuContentProps): React.JSX.Element => (
  <RadixDropdown.Portal>
    <RadixDropdown.Content
      side={side}
      align={align}
      sideOffset={8}
      className={cn(
        "z-popover min-w-56 origin-(--radix-dropdown-menu-content-transform-origin) rounded-nested border border-ethereal-incense/15 bg-ethereal-alabaster/95 p-1.5 shadow-glass-ethereal backdrop-blur-ethereal",
        "popover-motion",
        className,
      )}
    >
      {children}
    </RadixDropdown.Content>
  </RadixDropdown.Portal>
);

export interface DropdownMenuItemProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  /**
   * Second line under the label, for menus whose entries are hard to tell apart
   * by name alone (several documents about the same concert). Kept out of the
   * item's `textValue` so keyboard typeahead still matches the label only.
   */
  description?: string;
  onSelect?: () => void;
  disabled?: boolean;
  /** Renders the item in the destructive (crimson) register. */
  destructive?: boolean;
  className?: string;
}

export const DropdownMenuItem = ({
  children,
  icon,
  description,
  onSelect,
  disabled,
  destructive,
  className,
}: DropdownMenuItemProps): React.JSX.Element => (
  <RadixDropdown.Item
    disabled={disabled}
    onSelect={onSelect}
    textValue={typeof children === "string" ? children : undefined}
    className={cn(
      MENU_ROW_CLASS,
      description ? "items-start" : "items-center",
      destructive
        ? "text-ethereal-crimson focus:bg-ethereal-crimson/10"
        : "text-ethereal-graphite focus:text-ethereal-ink",
      className,
    )}
  >
    {icon && (
      <span
        className={cn(
          "shrink-0",
          description && "mt-0.5",
          destructive ? "text-ethereal-crimson" : "text-ethereal-graphite/60",
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
    )}
    <span className="flex min-w-0 flex-1 flex-col">
      <Text as="span" size="sm" weight="medium" color="inherit">
        {children}
      </Text>
      {description && <Caption color="muted">{description}</Caption>}
    </span>
  </RadixDropdown.Item>
);

export const DropdownMenuRadioGroup = RadixDropdown.RadioGroup;

export interface DropdownMenuRadioItemProps {
  /**
   * The label, as a node rather than a string: an entry that has to be DRAWN at
   * the size it sets (a reading-size control) cannot have typography imposed on
   * it here. Everything else in the row — the row itself, the tick, the column
   * the tick holds open — is this component's.
   */
  children: React.ReactNode;
  value: string;
  /**
   * Leave the menu open after the choice. For a setting whose effect is visible
   * behind the menu, closing on the first pick makes comparing the options cost
   * three round trips through the trigger.
   */
  keepOpen?: boolean;
  disabled?: boolean;
  className?: string;
}

export const DropdownMenuRadioItem = ({
  children,
  value,
  keepOpen,
  disabled,
  className,
}: DropdownMenuRadioItemProps): React.JSX.Element => (
  <RadixDropdown.RadioItem
    value={value}
    disabled={disabled}
    onSelect={(event) => {
      if (keepOpen) event.preventDefault();
    }}
    className={cn(
      MENU_ROW_CLASS,
      "items-center text-ethereal-graphite focus:text-ethereal-ink",
      className,
    )}
  >
    {/* The column is held whether or not the tick is drawn, so the labels do not
        shift sideways as the choice moves down the group. */}
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center self-center text-ethereal-gold"
      aria-hidden="true"
    >
      <RadixDropdown.ItemIndicator>
        <Check size={14} />
      </RadixDropdown.ItemIndicator>
    </span>
    <span className="min-w-0 flex-1">{children}</span>
  </RadixDropdown.RadioItem>
);

export const DropdownMenuSeparator = (): React.JSX.Element => (
  <RadixDropdown.Separator className="my-1 h-px bg-ethereal-incense/15" />
);

export const DropdownMenuLabel = ({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element => (
  <RadixDropdown.Label className="px-3 pb-1 pt-2">
    <Eyebrow color="muted">{children}</Eyebrow>
  </RadixDropdown.Label>
);
