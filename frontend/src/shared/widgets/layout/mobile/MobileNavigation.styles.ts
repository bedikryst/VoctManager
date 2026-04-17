/**
 * @file MobileNavigation.styles.ts
 * @description Kinematic styles and spatial variants for mobile navigation elements.
 * Built for 2026 Ethereal UX standards. Focuses on 'Chiaroscuro' light dynamics,
 * volumetric shadows, and sub-pixel antialiasing for sacred typography.
 * @module shared/widgets/layout/mobile
 */

import { cva } from "class-variance-authority";

export const mobileNavLinkVariants = cva(
  "group/moblink relative flex items-center gap-5 rounded-[1.25rem] px-6 py-4 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 active:scale-[0.97] will-change-transform overflow-hidden",
  {
    variants: {
      isActive: {
        true: [
          "bg-gradient-to-r from-ethereal-gold/[0.08] to-transparent",
          "shadow-[inset_0_1px_0_rgba(194,168,120,0.2),inset_1px_0_0_rgba(194,168,120,0.1)]",
          "border border-ethereal-gold/10 backdrop-blur-md",
        ],
        false: [
          "bg-transparent border border-transparent",
          "hover:bg-white/[0.03] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        ],
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);
