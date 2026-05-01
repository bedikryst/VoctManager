/**
 * @file GlassCard.tsx
 * @description High-performance structural container providing hardware-accelerated glassmorphism.
 * Glow particle effect is isolated into a child component so its motion infrastructure
 * (motion values, pointer listeners, getBoundingClientRect) is only mounted when glow={true}.
 * Cards without glow attach zero pointer listeners and skip motion-template evaluation entirely.
 * `will-change` is opt-in via the hover variant — Framer manages compositor promotion for animated subtrees.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/GlassCard
 */

import React, {
  forwardRef,
  ElementType,
  ComponentPropsWithoutRef,
  ReactNode,
  PointerEvent,
  useImperativeHandle,
  useRef,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { cn } from "@/shared/lib/utils";

const glassCardVariants = cva(
  "group relative isolate overflow-hidden rounded-[2.5rem] transform-gpu contain-paint",
  {
    variants: {
      variant: {
        ethereal:
          "bg-glass-surface backdrop-blur-ethereal border border-glass-border shadow-glass-ethereal",
        surface:
          "bg-ethereal-ink/40 backdrop-blur-xl border border-white/5 shadow-glass-ethereal",
        solid:
          "bg-ethereal-alabaster/70 border border-ethereal-ink/10 shadow-glass-solid",
        dark: "bg-ethereal-ink/90 backdrop-blur-ethereal border border-ethereal-incense/20 text-ethereal-marble shadow-glass-solid",
        outline:
          "bg-transparent border border-ethereal-incense/30 hover:border-ethereal-gold hover:shadow-glass-outline-hover",
        light:
          "bg-glass-surface/50 backdrop-blur-[4px] border border-glass-border shadow-glass-ethereal",
      },
      isHoverable: {
        true: "hover:-translate-y-2 hover:scale-[1.002] cursor-pointer hover:shadow-glass-ethereal-hover will-change-transform",
        false: "",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-6 md:p-8",
        lg: "p-8 md:p-12",
      },
      animationEngine: {
        css: "transition-[transform,box-shadow,border-color,background-color] duration-700 ease-out",
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

interface GlowAuraHandle {
  readonly setPointer: (x: number, y: number) => void;
}

const GlowAura = forwardRef<GlowAuraHandle>((_, ref) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const backgroundTemplate = useMotionTemplate`
    radial-gradient(
      150px circle at ${mouseX}px ${mouseY}px,
      rgba(194, 168, 120, 0.07),
      transparent 80%
    )
  `;

  useImperativeHandle(
    ref,
    () => ({
      setPointer: (x, y) => {
        mouseX.set(x);
        mouseY.set(y);
      },
    }),
    [mouseX, mouseY],
  );

  return (
    <motion.div
      className="pointer-events-none absolute -inset-px z-0 hidden rounded-[inherit] opacity-0 transition-opacity duration-700 group-hover:opacity-100 sm:block"
      style={{ background: backgroundTemplate }}
      aria-hidden="true"
    />
  );
});

GlowAura.displayName = "GlowAura";

type LinkLikeMeta = {
  readonly displayName?: string;
  readonly name?: string;
  readonly render?: { readonly displayName?: string };
};

const isLinkLike = (component: ElementType): boolean => {
  if (typeof component === "string") return false;
  const meta = component as unknown as LinkLikeMeta;
  return (
    meta.displayName === "Link" ||
    meta.render?.displayName === "Link" ||
    meta.name === "Link"
  );
};

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
  const isInteractive =
    Component === "button" || Component === "a" || isLinkLike(Component);

  const glowRef = useRef<GlowAuraHandle>(null);
  const forwardedPointerMove = onPointerMove as
    | ((event: PointerEvent<HTMLElement>) => void)
    | undefined;

  const needsPointerHandler = glow || Boolean(forwardedPointerMove);
  const handlePointerMove = needsPointerHandler
    ? (event: PointerEvent<HTMLElement>) => {
        forwardedPointerMove?.(event);
        if (!glow || event.pointerType === "touch") return;
        const { left, top } = event.currentTarget.getBoundingClientRect();
        glowRef.current?.setPointer(
          event.clientX - left,
          event.clientY - top,
        );
      }
    : undefined;

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
        isInteractive &&
          "block w-full text-left appearance-none outline-none select-none",
      )}
      {...rest}
    >
      {glow && <GlowAura ref={glowRef} />}

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

      <div className="relative z-10 min-h-0 flex-1 flex flex-col">
        {children}
      </div>
    </Component>
  );
};

export const GlassCard = forwardRef(GlassCardInner) as <
  C extends ElementType = "div",
>(
  props: GlassCardProps<C> & { ref?: React.ComponentPropsWithRef<C>["ref"] },
) => React.ReactElement;

(GlassCard as React.FC).displayName = "GlassCard";
