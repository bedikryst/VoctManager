/**
 * @file MobileNavigation.styles.ts
 * @description Kinematic styles and spatial variants for mobile navigation elements.
 * Built for 2026 Ethereal UX standards.
 * @module shared/widgets/layout/mobile
 */

import { cva } from "class-variance-authority";

export const mobileNavLinkVariants = cva(
  "group/moblink relative flex items-center gap-4 rounded-[1.25rem] px-5 py-3.5 transition-all duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 active:scale-[0.97] will-change-transform overflow-hidden",
  {
    variants: {
      isActive: {
        true: "bg-ethereal-gold/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_12px_rgba(0,0,0,0.02)]",
        false: "bg-transparent hover:bg-ethereal-graphite/[0.04]",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);
