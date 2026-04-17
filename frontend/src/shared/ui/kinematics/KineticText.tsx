/**
 * @file KineticText.tsx
 * @description Lens-blur text reveal primitive for Ethereal UI 2026.
 * Splits text into words/characters and orchestrates a staggered entrance.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { motion, type Variants } from "framer-motion";

interface KineticTextProps {
  text: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  delay?: number;
  mode?: "words" | "characters";
}

const EtherealEasing = [0.16, 1, 0.3, 1] as const;

export function KineticText({
  text,
  as: Component = "span",
  className = "",
  delay = 0,
  mode = "words",
}: KineticTextProps): React.JSX.Element {
  const elements = mode === "words" ? text.split("") : text.split(" ");

  const container: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: mode === "words" ? 0.08 : 0.03,
        delayChildren: delay,
      },
    },
  };

  const child: Variants = {
    hidden: {
      opacity: 0,
      y: 20,
      filter: "blur(12px)",
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.8,
        ease: EtherealEasing,
      },
    },
  };

  const MotionComponent = motion.create(Component as any);

  return (
    <MotionComponent
      variants={container}
      initial="hidden"
      animate="visible"
      className={className}
      aria-label={text} // A11y: Screen readers get the full text, ignoring spans
    >
      {elements.map((element, index) => (
        <motion.span
          key={`${element}-${index}`}
          variants={child}
          aria-hidden="true"
          className="inline-block whitespace-pre"
        >
          {element === " " && mode === "characters" ? "\u00A0" : element}
        </motion.span>
      ))}
    </MotionComponent>
  );
}
