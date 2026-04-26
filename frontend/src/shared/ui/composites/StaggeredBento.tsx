import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

export const StaggeredBentoContainer = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 ${className || ""}`}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
StaggeredBentoContainer.displayName = "StaggeredBentoContainer";

export const StaggeredBentoItem = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        variants={itemVariants}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
StaggeredBentoItem.displayName = "StaggeredBentoItem";
