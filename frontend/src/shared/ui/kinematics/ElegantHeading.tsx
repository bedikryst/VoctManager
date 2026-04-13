/**
 * @file ElegantHeading.tsx
 * @description Sophisticated typography component with integrated iconography.
 * Refactored to eliminate 'any' type violations and enforce strict TS 7.0 standards.
 * @module shared/ui/kinematics/ElegantHeading
 */

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";

interface ElegantHeadingProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}

export const ElegantHeading = ({
  title,
  description,
  icon,
  className,
  align = "left",
}: ElegantHeadingProps) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        align === "center" && "items-center text-center",
        align === "right" && "items-end text-right",
        className,
      )}
    >
      {icon && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-brand mb-2"
        >
          {React.isValidElement(icon)
            ? React.cloneElement(
                icon as React.ReactElement<{
                  size?: number;
                  strokeWidth?: number;
                }>,
                { size: 32, strokeWidth: 1.2 },
              )
            : icon}
        </motion.div>
      )}
      <motion.h2
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="font-serif text-3xl md:text-4xl tracking-tight text-stone-900"
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-stone-500 max-w-2xl leading-relaxed"
        >
          {description}
        </motion.p>
      )}
    </div>
  );
};
