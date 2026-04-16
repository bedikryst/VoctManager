/**
 * @file MobileNavSheet.tsx
 * @description Expanded state of the mobile gestural navigation (Bottom Sheet).
 * Implements hardware-accelerated scroll masking and rigorous A11y standards.
 */

import React from "react";
import { motion, useDragControls, PanInfo } from "framer-motion";
import { NavLink, useNavigate } from "react-router-dom";
import { X, Settings, LogOut } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import {
  Heading,
  Eyebrow,
  Label,
  Text,
} from "@/shared/ui/primitives/typography";
import { Divider } from "@/shared/ui/primitives/Divider";
import { mobileNavLinkVariants } from "./MobileNavigation.styles"; // Extracted CVA styles
import { useNavigationAura } from "../hooks/useNavigationAura";

interface MobileNavSheetProps {
  readonly onClose: () => void;
  readonly logout: () => void;
  readonly aura: ReturnType<typeof useNavigationAura>;
}

const BrandMark = () => (
  <div className="flex items-center">
    <Heading
      as="span"
      size="lg"
      className="tracking-tight select-none flex items-center"
    >
      <span className="font-medium text-ethereal-ink">Voct</span>
      <Text
        as="span"
        weight="normal"
        color="gold"
        size="2xl"
        className="italic ml-[0.5px]"
      >
        Manager
      </Text>
    </Heading>
  </div>
);

export const MobileNavSheet = ({
  onClose,
  logout,
  aura,
}: MobileNavSheetProps): React.JSX.Element => {
  const navigate = useNavigate();
  const dragControls = useDragControls();

  // Compiler handles optimization. No useCallback needed.
  const handleDragEnd = (_: Event, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  const handleNavigation = (to: string) => {
    onClose();
    setTimeout(() => navigate(to), 150); // Fluid architectural delay for sheet to descend
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        className="fixed inset-0 z-[60] bg-ethereal-ink/30 backdrop-blur-md md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
        initial={{ y: "100%", borderRadius: "40px" }}
        animate={{ y: 0, borderRadius: "32px" }}
        exit={{ y: "100%", borderRadius: "40px" }}
        transition={{ type: "spring", stiffness: 350, damping: 32, mass: 1 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.08}
        onDragEnd={handleDragEnd}
        className="fixed bottom-0 left-0 right-0 z-[70] h-[82dvh] outline-none md:hidden transform-gpu will-change-transform"
      >
        <GlassCard
          variant="ethereal"
          padding="none"
          withNoise={true}
          className="relative flex flex-col w-full h-full overflow-hidden border-t border-white/60 shadow-[var(--shadow-ethereal-deep)]"
        >
          {/* Tactile Drag Handle */}
          <div
            className="w-full flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <div className="w-12 h-1.5 rounded-full bg-ethereal-graphite/20 shadow-inner" />
          </div>

          <header className="flex items-center justify-between px-6 pb-2">
            <BrandMark />
            <button
              onClick={onClose}
              aria-label="Close Navigation"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-ethereal-graphite/5 text-ethereal-graphite hover:bg-ethereal-graphite/10 transition-colors"
            >
              <X size={20} />
            </button>
          </header>

          {/* Scrollable Area with Hardware Accelerated Fade Masks */}
          <div className="relative flex-1 min-h-0">
            {/* Top Fade Overlay */}
            <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-white/80 to-transparent z-10 pointer-events-none" />

            <div className="h-full overflow-y-auto px-5 pb-8 overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <nav className="flex flex-col gap-6 py-4">
                {aura.navGroups.map((group) => (
                  <section
                    key={group.labelKey}
                    aria-labelledby={`nav-group-${group.labelKey}`}
                  >
                    <Eyebrow
                      id={`nav-group-${group.labelKey}`}
                      as="h3"
                      weight="semibold"
                      color="incense"
                      size="sm"
                      className="mb-3 pl-4 tracking-[0.25em] uppercase opacity-60"
                    >
                      {aura.t(group.labelKey)}
                    </Eyebrow>

                    <ul className="space-y-1.5 m-0 p-0 list-none">
                      {group.links.map((link) => {
                        const IconComponent = link.icon;
                        return (
                          <li key={link.to}>
                            <NavLink
                              to={link.to}
                              onClick={(e) => {
                                e.preventDefault();
                                handleNavigation(link.to);
                              }}
                              className={({ isActive }) =>
                                cn(mobileNavLinkVariants({ isActive }))
                              }
                            >
                              {({ isActive }) => (
                                <>
                                  <div
                                    className={cn(
                                      "flex w-8 items-center justify-center",
                                      isActive
                                        ? "text-ethereal-gold"
                                        : "text-ethereal-graphite/70",
                                    )}
                                  >
                                    <IconComponent
                                      size={20}
                                      strokeWidth={isActive ? 2.5 : 1.5}
                                    />
                                  </div>
                                  <Text
                                    as="span"
                                    weight={isActive ? "medium" : "normal"}
                                    className={
                                      isActive
                                        ? "text-ethereal-gold"
                                        : "text-ethereal-graphite/80"
                                    }
                                  >
                                    {aura.t(link.labelKey)}
                                  </Text>
                                </>
                              )}
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </nav>
            </div>

            {/* Bottom Fade Overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white/80 to-transparent z-10 pointer-events-none" />
          </div>

          <footer className="mt-auto px-7 pt-4 pb-safe-offset-6 bg-white/40 backdrop-blur-md relative">
            <Divider
              position="absolute-top"
              variant="fade"
              className="opacity-30"
            />
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col min-w-0">
                <Label
                  as="p"
                  weight="medium"
                  className="truncate text-base text-ethereal-ink leading-none mb-1"
                >
                  {aura.userFullName}
                </Label>
                <Eyebrow
                  as="p"
                  color="incense"
                  className="truncate opacity-60 text-[0.7rem] tracking-widest uppercase"
                >
                  {aura.roleLabel}
                </Eyebrow>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleNavigation("/panel/settings")}
                  aria-label="Settings"
                  className="flex h-11 w-11 items-center justify-center rounded-[1.15rem] bg-ethereal-gold/10 border border-ethereal-gold/20 text-ethereal-graphite"
                >
                  <Settings size={18} />
                </button>
                <button
                  onClick={logout}
                  aria-label="Logout"
                  className="flex h-11 w-11 items-center justify-center rounded-[1.15rem] bg-red-50 text-red-500 border border-red-100"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </footer>
        </GlassCard>
      </motion.div>
    </>
  );
};
