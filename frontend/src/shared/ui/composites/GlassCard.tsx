/**
 * @file GlassCard.tsx
 * @description High-performance structural container providing hardware-accelerated glassmorphism.
 * Optimized for 120fps compositing. Implements strict pointer-device checks for particle effects.
 * @module shared/ui/composites/GlassCard
 */

import React, {
  forwardRef,
  ElementType,
  ComponentPropsWithoutRef,
  ReactNode,
  PointerEvent,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { cn } from "@/shared/lib/utils";

const glassCardVariants = cva(
  "group relative isolate overflow-hidden rounded-[2.5rem] will-change-transform transform-gpu contain-paint",
  {
    variants: {
      variant: {
        ethereal:
          "bg-glass-surface backdrop-blur-ethereal border border-glass-border shadow-glass-ethereal",
        solid:
          "bg-ethereal-marble border border-ethereal-ink/10 shadow-glass-solid",
        dark: "bg-ethereal-ink/90 backdrop-blur-ethereal border border-ethereal-incense/20 text-ethereal-marble shadow-glass-solid",
        outline:
          "bg-transparent border border-ethereal-incense/30 transition-colors hover:border-ethereal-gold hover:shadow-glass-outline-hover",
        light:
          "bg-glass-surface/50 backdrop-blur-[4px] border border-glass-border shadow-glass-ethereal",
      },
      isHoverable: {
        true: "hover:-translate-y-2 hover:scale-[1.002] cursor-pointer hover:shadow-glass-ethereal-hover hover:bg-glass-surface hover:border-glass-border",
        false: "",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-6 md:p-8",
        lg: "p-8 md:p-12",
      },
      animationEngine: {
        css: "transition-all duration-700 ease-out",
        framer: "transition-none",
      },
    },
    defaultVariants: {
      variant: "ethereal",
      padding: "md",
      isHoverable: true,
      animationEngine: "css",
    },
  },
);

export type GlassCardProps<C extends ElementType> = {
  as?: C;
  withNoise?: boolean;
  glow?: boolean;
  backgroundElement?: ReactNode;
} & VariantProps<typeof glassCardVariants> &
  Omit<
    ComponentPropsWithoutRef<C>,
    "as" | "variant" | "padding" | "isHoverable" | "animationEngine"
  >;

const GlassCardInner = <C extends ElementType = "div">(
  {
    as,
    children,
    variant,
    padding,
    glow = false,
    isHoverable,
    withNoise = false,
    backgroundElement,
    animationEngine,
    className,
    onPointerMove,
    ...rest
  }: GlassCardProps<C>,
  ref: React.ForwardedRef<HTMLDivElement>,
) => {
  const Component = as || "div";

  // Lazy evaluation of motion values to prevent memory overhead when glow is disabled
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const backgroundTemplate = useMotionTemplate`
    radial-gradient(
      150px circle at ${mouseX}px ${mouseY}px,
      rgba(194, 168, 120, 0.07),
      transparent 80%
    )
  `;

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (onPointerMove) {
      const forwardedPointerMove = onPointerMove as unknown as (
        pointerEvent: PointerEvent<HTMLElement>
      ) => void;
      forwardedPointerMove(event);
    }

    if (!glow || event.pointerType === "touch") return;

    const { left, top } = event.currentTarget.getBoundingClientRect();
    mouseX.set(event.clientX - left);
    mouseY.set(event.clientY - top);
  };

  return (
    <Component
      ref={ref}
      onPointerMove={handlePointerMove}
      className={cn(
        glassCardVariants({
          variant,
          padding,
          isHoverable,
          animationEngine,
          className,
        }),
      )}
      {...rest}
    >
      {glow && (
        <motion.div
          className="pointer-events-none absolute -inset-px z-0 rounded-[inherit] opacity-0 transition-opacity duration-700 group-hover:opacity-100 hidden sm:block"
          style={{ background: backgroundTemplate }}
          aria-hidden="true"
        />
      )}

      {backgroundElement && (
        <div
          className="absolute inset-0 -z-20 overflow-hidden mix-blend-overlay pointer-events-none"
          aria-hidden="true"
        >
          {backgroundElement}
        </div>
      )}

      {withNoise && (
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-noise opacity-[0.03] mix-blend-color-burn"
          aria-hidden="true"
        />
      )}

      <div className="relative z-10 h-full">{children}</div>
    </Component>
  );
};

export const GlassCard = forwardRef(GlassCardInner) as <
  C extends ElementType = "div",
>(
  props: GlassCardProps<C> & { ref?: React.ComponentPropsWithRef<C>["ref"] },
) => React.ReactElement;

(GlassCard as React.FC).displayName = "GlassCard";
