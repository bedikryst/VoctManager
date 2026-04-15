/**
 * @file KineticActionCue.tsx
 * @description Universal interaction cue. Responds to generic 'group' hover states.
 * @architecture Enterprise SaaS 2026
 */
import React from "react";
import { ArrowRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface KineticActionCueProps {
  direction?: "right" | "up-right" | "chevron";
  className?: string;
}

export const KineticActionCue: React.FC<KineticActionCueProps> = ({
  direction = "right",
  className,
}) => {
  const Icon =
    direction === "up-right"
      ? ArrowUpRight
      : direction === "chevron"
        ? ChevronRight
        : ArrowRight;

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ethereal-incense/20 bg-white/5 text-ethereal-graphite shadow-sm backdrop-blur-sm transition-all duration-500",
        "group-hover/alert:border-ethereal-gold/40 group-hover/alert:bg-white/30 group-hover/alert:text-ethereal-ink",
        "group-hover/card:border-ethereal-gold/40 group-hover/card:bg-white/30 group-hover/card:text-ethereal-ink",
        className,
      )}
      aria-hidden="true"
    >
      <Icon
        size={16}
        strokeWidth={1.5}
        className={cn(
          "transform transition-transform duration-500",
          direction === "right" &&
            "group-hover/alert:translate-x-1 group-hover/card:translate-x-1",
          direction === "up-right" &&
            "group-hover/alert:translate-x-[2px] group-hover/alert:-translate-y-[2px] group-hover/card:translate-x-[2px] group-hover/card:-translate-y-[2px]",
        )}
      />
    </div>
  );
};
