/**
 * @file GlassCard.tsx
 * @description High-performance structural container providing hardware-accelerated glassmorphism.
 * Glow particle effect is isolated into a child component so its motion infrastructure
 * (motion values, pointer listeners, getBoundingClientRect) is only mounted when glow={true}.
 * Cards without glow attach zero pointer listeners and skip motion-template evaluation entirely.
 * `will-change` is opt-in via the hover variant — Framer manages compositor promotion for animated subtrees.
 * Children live in a content wrapper that stacks above the decorative layers; `className` styles the
 * card surface, `contentClassName` styles that wrapper (see the prop docs).
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
  // `contain-paint` confines repaints to the card's own box (cheap, keeps it).
  // We deliberately do NOT force `transform-gpu` here: promoting all ~130 cards
  // to their own compositor layer up-front is a net loss (GPU memory + compositing
  // overhead, worse scrolling). The browser promotes a card only when it actually
  // animates (hover lift), which is exactly when promotion pays off.
  "group relative isolate overflow-hidden rounded-3xl contain-paint",
  {
    variants: {
      // backdrop-filter is kept ONLY where a card floats over real CONTENT
      // (`surface` — e.g. the PDF toolbar over a document). The in-flow tiles
      // (`ethereal`, `dark`) sit over the near-empty ambient background, so a
      // live blur re-samples ~nothing every frame while you scroll — pure cost,
      // no visible effect — and is dropped. `dark` is 90% opaque anyway, so its
      // blur was invisible. Floating overlays that genuinely need frosting
      // (command palette, bottom sheet, dropdown) carry their own backdrop-blur
      // at their own call sites, where it is transient rather than scrolled-over.
      variant: {
        ethereal:
          "bg-glass-surface border border-glass-border shadow-glass-ethereal",
        surface:
          "bg-ethereal-ink/40 backdrop-blur-xl border border-white/5 shadow-glass-ethereal",
        solid:
          "bg-ethereal-alabaster border border-ethereal-ink/6 shadow-glass-solid",
        dark: "bg-ethereal-ink/90 border border-ethereal-incense/20 text-ethereal-marble shadow-glass-solid",
        outline:
          "bg-transparent border border-ethereal-incense/30 hover:border-ethereal-gold hover:shadow-glass-outline-hover",
        light:
          "bg-glass-surface/50 backdrop-blur-[4px] border border-glass-border shadow-glass-ethereal",
      },
      isHoverable: {
        // No static `will-change-transform`: it permanently reserves a compositor
        // layer on every hoverable card even at rest. The lift is a simple
        // transform the browser composites fine on hover-intent without it.
        true: "hover:-translate-y-1 cursor-pointer hover:shadow-glass-ethereal-hover",
        false: "",
      },
      padding: {
        none: "p-0",
        sm: "p-3.5",
        md: "p-5 md:p-6",
        lg: "p-7 md:p-10",
      },
      animationEngine: {
        // Transition only compositor-cheap / small-paint properties. box-shadow
        // and background-color are deliberately excluded: animating a large
        // blurry shadow repaints every frame for the whole 700ms, and sweeping
        // the pointer across a list of cards stacks those repaints — the dominant
        // cause of hover-induced frame drops across the ~130 cards. The hover
        // shadow still applies; it just snaps (one repaint) under the smooth lift.
        css: "transition-[transform,border-color] duration-700 ease-out",
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
  /**
   * Classes for the content wrapper — the box the children actually live in.
   * `className` reaches the card SURFACE only, and the surface has exactly one
   * child (this wrapper), so alignment/gap/flex-direction passed there never
   * reaches the content: `items-*` shrink-wraps the wrapper instead of centering
   * anything, and `gap-*` is a no-op. Those classes belong here.
   * The wrapper is already `flex flex-col` — pass `flex-row` to switch axis.
   */
  contentClassName?: string;
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
    contentClassName,
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

      <div
        className={cn(
          "relative z-10 min-h-0 flex-1 flex flex-col",
          contentClassName,
        )}
      >
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
