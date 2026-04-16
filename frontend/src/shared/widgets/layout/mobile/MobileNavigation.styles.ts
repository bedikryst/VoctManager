/**
 * @file MobileNavigation.styles.ts
 * @description Kinematic styles and spatial variants for mobile navigation elements.
 * Built for 2026 Ethereal UX standards. Focuses on 'Chiaroscuro' light dynamics.
 * @module shared/widgets/layout/mobile
 */

import { cva } from "class-variance-authority";

export const mobileNavLinkVariants = cva(
  "group/moblink relative flex items-center gap-5 rounded-2xl px-6 py-4 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none focus-visible:ring-1 focus-visible:ring-ethereal-gold/50 active:scale-[0.98] will-change-transform overflow-hidden",
  {
    variants: {
      isActive: {
        true: "bg-ethereal-gold/[0.04] shadow-[inset_0_1px_0_rgba(194,168,120,0.15)]",
        false: "bg-transparent hover:bg-white/[0.02]",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);
