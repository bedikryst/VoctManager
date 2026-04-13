/**
 * @file StaggeredBentoGrid.tsx
 * @description Kinematic wrapper for high-density dashboard grids.
 * Encapsulates Framer Motion logic strictly utilizing Ethereal UI constants.
 * @module shared/ui/kinematics/StaggeredBentoGrid
 */

import React, { type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  BENTO_CONTAINER_VARIANTS,
  BENTO_ITEM_VARIANTS,
} from "./motion-presets";

export interface StaggeredBentoGridProps {
  children: ReactNode;
  className?: string;
}

export function StaggeredBentoContainer({
  children,
  className,
}: StaggeredBentoGridProps): React.JSX.Element {
  return (
    <motion.div
      variants={BENTO_CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggeredBentoItem({
  children,
  className,
}: StaggeredBentoGridProps): React.JSX.Element {
  return (
    <motion.div variants={BENTO_ITEM_VARIANTS} className={className}>
      {children}
    </motion.div>
  );
}
