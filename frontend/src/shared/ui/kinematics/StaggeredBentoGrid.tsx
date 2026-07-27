/**
 * @file StaggeredBentoGrid.tsx
 * @description The entrance stagger for a dashboard grid: a container that
 * cascades its children in, and an item that carries the fade-and-rise.
 *
 * It owns MOTION and nothing else. The container brings no grid of its own —
 * the caller says whether the page is three columns, two, or a single flex
 * column, because a layout composite that decides the caller's layout is a
 * composite the caller has to fight: the second copy of this file baked in
 * `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` and concatenated `className` as a
 * raw string, so the two workspaces that wanted a column both wrote `!flex` to
 * get out of it and a third re-declared the variants privately rather than try.
 * The variants themselves live in `motion-presets` so one timing governs every
 * dashboard.
 * @module shared/ui/kinematics/StaggeredBentoGrid
 */

import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import {
  BENTO_CONTAINER_VARIANTS,
  BENTO_ITEM_VARIANTS,
} from "./motion-presets";
import { cn } from "@/shared/lib/utils";

/** Everything a `<div>` takes — an item is a scroll anchor as often as it is a
 *  cell (`id` + `scroll-mt-*`), so the wrapper must not swallow its props. */
export type StaggeredBentoGridProps = HTMLMotionProps<"div">;

export function StaggeredBentoContainer({
  children,
  className,
  ...rest
}: StaggeredBentoGridProps): React.JSX.Element {
  return (
    <motion.div
      variants={BENTO_CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
      className={cn(className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggeredBentoItem({
  children,
  className,
  ...rest
}: StaggeredBentoGridProps): React.JSX.Element {
  return (
    <motion.div
      variants={BENTO_ITEM_VARIANTS}
      className={cn(className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
