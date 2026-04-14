/**
 * @file StatusBadge.tsx
 * @description A strictly typed, elegant badge for project and domain states.
 * Replaces legacy 'ping dots' with Ethereal UI illuminated borders and subtle glows.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/primitives/StatusBadge
 */

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";
import { motion } from "framer-motion";

const statusBadgeVariants = cva(
  "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full border px-3 py-1 backdrop-blur-md transition-colors duration-500",
  {
    variants: {
      variant: {
        active:
          "border-ethereal-gold/30 bg-ethereal-gold/5 text-ethereal-gold shadow-[0_0_12px_rgba(194,168,120,0.15)]",
        upcoming:
          "border-ethereal-sage/30 bg-ethereal-sage/5 text-ethereal-sage shadow-[0_0_12px_rgba(143,154,138,0.15)]",
        archived:
          "border-ethereal-incense/20 bg-ethereal-incense/5 text-ethereal-graphite/60",
        danger:
          "border-ethereal-amethyst/30 bg-ethereal-amethyst/5 text-ethereal-amethyst shadow-[0_0_12px_rgba(155,138,164,0.15)]",
      },
    },
    defaultVariants: {
      variant: "upcoming",
    },
  },
);

export interface StatusBadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  label: string;
  isPulsing?: boolean; // Subtle inner pulse, not a dot
}

export function StatusBadge({
  variant,
  label,
  isPulsing = false,
  className,
  ...props
}: StatusBadgeProps): React.JSX.Element {
  return (
    <div className={cn(statusBadgeVariants({ variant }), className)} {...props}>
      {/* Subtle background light sweep */}
      {isPulsing && variant !== "archived" && (
        <motion.div
          className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{ x: ["-200%", "200%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          aria-hidden="true"
        />
      )}
      <span className="relative z-10 text-[9px] font-bold uppercase tracking-[0.25em]">
        {label}
      </span>
    </div>
  );
}
