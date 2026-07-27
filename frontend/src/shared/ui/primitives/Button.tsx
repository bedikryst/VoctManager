/**
 * @file Button.tsx
 * @description Enterprise-grade button primitive for VoctEnsemble.
 * Employs strict Ethereal UI tokens. Exports variants for polymorphic usage.
 * @module shared/ui/primitives/Button
 */

import React, { ButtonHTMLAttributes, forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

export const buttonVariants = cva(
  // Control type: the overline sizes at the control tracking (0.1em). The wider
  // 0.14em is the `Eyebrow` role and stays out of here — a button label sits
  // beside chips and inputs, not beside headings. No `!important` on the size:
  // a caller that needs a different one must be able to say so.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-overline uppercase tracking-[0.1em] font-bold antialiased transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-ethereal-gold text-ethereal-graphite border border-ethereal-gold/30 shadow-button-primary hover:shadow-button-primary-hover hover:bg-ethereal-gold/90 hover:border-ethereal-ink/20 hover:text-ethereal-ink",
        secondary:
          "bg-white/50 backdrop-blur-md border border-ethereal-incense/20 text-ethereal-ink shadow-sm hover:border-ethereal-gold/50 hover:bg-white/80 hover:text-ethereal-gold",
        outline:
          "bg-transparent text-ethereal-graphite border border-ethereal-incense/30 hover:border-ethereal-gold hover:text-ethereal-ink hover:bg-white/40",
        ghost:
          "bg-transparent text-ethereal-graphite hover:text-ethereal-ink hover:bg-ethereal-incense/10 shadow-none",
        destructive:
          "bg-ethereal-crimson/8 text-ethereal-crimson border border-ethereal-crimson/25 hover:bg-ethereal-crimson/15 hover:border-ethereal-crimson/40",
        icon: "bg-transparent text-ethereal-graphite hover:text-ethereal-gold hover:bg-ethereal-incense/10",
      },
      size: {
        default: "px-5 py-2.5",
        sm: "px-4 py-2 text-overline-sm",
        // `touch` guarantees a >=44px hit area for thumb-driven primary actions
        // (schedule RSVP, sheet footers) without shrinking the type like `sm`.
        touch: "min-h-11 px-5 py-3",
        lg: "px-8 py-3.5 text-xs",
        // 44px, not 40: an icon-only control is the smallest target on the
        // screen and has no label to widen it, so it is exactly where the touch
        // floor matters most.
        icon: "h-11 w-11 flex items-center justify-center p-0",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /**
   * Render the styling onto the caller's own element (a `Link`, an `<a>`) via
   * Radix `Slot`. The icon and loading slots keep working: the composition is
   * cloned INTO that element rather than being dropped, which is what used to
   * happen — ten link-buttons across archive, projects and schedule asked for a
   * back arrow or an external-link glyph and rendered none of it, silently,
   * because `Slot` only forwards props and the caller's child owned the
   * children. A prop a component accepts and then ignores is a prop that lies.
   */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = isLoading || disabled;

    // Only a plain-text label can be truncated, and only a plain-text label is
    // safe inside a text box: Preflight sets `svg { display: block }`, so a
    // caller who composed its own children — every `asChild` link that puts a
    // glyph next to its text — got that glyph laid out as a block, on its own
    // line above the label. A composed label gets a flex row of its own instead,
    // so it stays ONE item of the button's row and the icon slots keep their
    // spacing.
    const isPlainText = (node: React.ReactNode): boolean =>
      typeof node === "string" || typeof node === "number";

    const compose = (label: React.ReactNode): React.JSX.Element => (
      <>
        {isLoading && (
          <Loader2
            size={14}
            strokeWidth={1.5}
            className="animate-spin text-current shrink-0"
            aria-hidden="true"
          />
        )}
        {!isLoading && leftIcon && (
          <span className="shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        {isPlainText(label) ? (
          <span className="truncate">{label}</span>
        ) : (
          <span className="inline-flex min-w-0 items-center gap-2">{label}</span>
        )}
        {!isLoading && rightIcon && (
          <span className="shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </>
    );

    const slotted = asChild
      ? (() => {
          const child = React.Children.only(children) as React.ReactElement<{
            children?: React.ReactNode;
          }>;
          return React.cloneElement(
            child,
            undefined,
            compose(child.props.children),
          );
        })()
      : null;

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        {...props}
      >
        {asChild ? slotted : compose(children)}
      </Comp>
    );
  },
);

Button.displayName = "Button";
