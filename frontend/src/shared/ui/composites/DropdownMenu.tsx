/**
 * @file DropdownMenu.tsx
 * @description Themed, accessible dropdown menu built on `@radix-ui/react-dropdown-menu`.
 * Wraps the headless primitive in the Ethereal glass language (tokens only — no raw
 * colors or magic z-index) so feature surfaces get keyboard nav, focus management and
 * portalling for free. Use for occasional, grouped actions (exports, overflow) that
 * would otherwise crowd a header.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/DropdownMenu
 */

import React from "react";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";

import { cn } from "@/shared/lib/utils";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

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
      "group flex cursor-pointer select-none gap-2.5 rounded-control px-3 py-2 outline-none transition-colors",
      description ? "items-start" : "items-center",
      "focus:bg-ethereal-marble/70 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
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
