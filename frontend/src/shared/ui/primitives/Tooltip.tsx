import React, { useState, useEffect } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { Label } from "./typography";

export const TooltipProvider = TooltipPrimitive.Provider;

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  side?: "top" | "right" | "bottom" | "left";
  disabled?: boolean;
}

const INITIAL_PROPS = {
  top: { opacity: 0, y: 8, scale: 0.95 },
  right: { opacity: 0, x: -8, scale: 0.95 },
  bottom: { opacity: 0, y: -8, scale: 0.95 },
  left: { opacity: 0, x: 8, scale: 0.95 },
} as const;

const ANIMATE_PROPS = {
  top: { opacity: 1, y: 0, scale: 1 },
  right: { opacity: 1, x: 0, scale: 1 },
  bottom: { opacity: 1, y: 0, scale: 1 },
  left: { opacity: 1, x: 0, scale: 1 },
} as const;

export const Tooltip = ({
  children,
  content,
  side = "right",
  disabled = false,
}: TooltipProps): React.JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);

  // Natychmiastowe zdjęcie Tooltipa, gdy np. Sidebar się rozwinie
  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  const handleOpenChange = (open: boolean) => {
    if (disabled) {
      setIsOpen(false);
      return;
    }
    setIsOpen(open);
  };

  return (
    <TooltipPrimitive.Root
      open={isOpen}
      onOpenChange={handleOpenChange}
      delayDuration={10}
    >
      {/* Trigger pozostaje asChild, bo zawsze otrzymuje czysty, renderowany pojedynczy element (np. <button>) */}
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>

      <AnimatePresence>
        {isOpen && !disabled && (
          <TooltipPrimitive.Portal forceMount key="tooltip-portal">
            {/* Brak asChild! Radix renderuje czysty, techniczny div do pozycjonowania (transform: translate) */}
            <TooltipPrimitive.Content
              forceMount
              side={side}
              sideOffset={14}
              className="z-[100] pointer-events-none"
            >
              {/* motion.div renderuje się niezależnie i zajmuje się wyłącznie animacją (transform: scale) */}
              <motion.div
                initial={INITIAL_PROPS[side]}
                animate={ANIMATE_PROPS[side]}
                exit={INITIAL_PROPS[side]}
                transition={{
                  type: "spring",
                  stiffness: 700,
                  damping: 30,
                  mass: 0.2,
                }}
                className="relative px-3 py-1 rounded-lg border border-ethereal-gold/50 bg-ethereal-parchment/90 backdrop-blur-xl shadow-(--shadow-ethereal-soft) will-change-transform"
              >
                <Label
                  size="sm"
                  color="graphite"
                  className="whitespace-nowrap font-medium tracking-wide"
                >
                  {content}
                </Label>
                {/* Arrow pozycjonuje się poprawnie dzięki className="relative" dodanemu do wyższego motion.div */}
                <TooltipPrimitive.Arrow
                  width={12}
                  height={6}
                  className="fill-ethereal-gold/50"
                />
              </motion.div>
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        )}
      </AnimatePresence>
    </TooltipPrimitive.Root>
  );
};
