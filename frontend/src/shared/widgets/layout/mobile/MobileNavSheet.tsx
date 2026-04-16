/**
 * @file MobileNavSheet.tsx
 * @description Spatial expanded state of navigation.
 * Implements Hero transitions from the Dock and hardware-accelerated scroll masking.
 */

import React, { useRef } from "react";
import { motion, PanInfo, useDragControls } from "framer-motion";
import { useNavigate, NavLink } from "react-router-dom";
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
import { mobileNavLinkVariants } from "./MobileNavigation.styles";
import { useNavigationAura } from "../hooks/useNavigationAura";
import { useFocusTrap } from "@/shared/lib/dom/useFocusTrap";

interface MobileNavSheetProps {
  readonly onClose: () => void;
  readonly logout: () => void;
  readonly aura: ReturnType<typeof useNavigationAura>;
}

export const MobileNavSheet = ({
  onClose,
  logout,
  aura,
}: MobileNavSheetProps): React.JSX.Element => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // A11y: Trap focus inside the sheet
  useFocusTrap(containerRef, true);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) onClose();
  };

  const handleNavigation = (to: string) => {
    onClose();
    setTimeout(() => navigate(to), 120); // 2026 Fluid Delay
  };

  return (
    <>
      {/* Backdrop with modern blurring */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-(--z-nav-sheet) bg-ethereal-ink/10 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />

      <motion.div
        ref={containerRef}
        layoutId="mobile-nav-container"
        role="dialog"
        aria-modal="true"
        aria-label="Expanded Navigation"
        className="fixed bottom-0 left-0 right-0 z-[var(--z-nav-sheet)] h-sheet-expanded outline-none md:hidden overflow-hidden will-change-transform"
        onDragEnd={handleDragEnd}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.05}
      >
        <GlassCard
          variant="ethereal"
          padding="none"
          withNoise={true}
          className="flex flex-col w-full h-full rounded-t-[2.5rem] border-t border-white/40 shadow-2xl"
        >
          {/* Tactile Grab Handle */}
          <div
            className="w-full flex justify-center py-4 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <div className="w-12 h-1.5 rounded-full bg-ethereal-graphite/20" />
          </div>

          <header className="flex items-center justify-between px-8 pb-4">
            <Heading as="span" size="lg" className="tracking-tight">
              <span className="font-medium">Voct</span>
              <Text as="span" color="gold" size="2xl" className="italic ml-0.5">
                Manager
              </Text>
            </Heading>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-ethereal-graphite/5 transition-transform active:scale-90"
            >
              <X size={22} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 overscroll-contain">
            <nav className="flex flex-col gap-8 py-6">
              {aura.navGroups.map((group) => (
                <section key={group.labelKey}>
                  <Eyebrow className="mb-4 pl-4 opacity-50 tracking-[0.2em] uppercase">
                    {aura.t(group.labelKey)}
                  </Eyebrow>
                  <ul className="space-y-2 list-none p-0 m-0">
                    {group.links.map((link) => {
                      const Icon = link.icon;
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
                                <Icon
                                  size={22}
                                  className={
                                    isActive
                                      ? "text-ethereal-gold"
                                      : "text-graphite/50"
                                  }
                                />
                                <Text weight={isActive ? "medium" : "normal"}>
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

          <footer className="mt-auto px-8 pt-6 pb-safe-offset-8 bg-white/30 backdrop-blur-md border-t border-white/20">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <Label className="text-lg leading-none mb-1">
                  {aura.userFullName}
                </Label>
                <Eyebrow color="incense" size="xs">
                  {aura.roleLabel}
                </Eyebrow>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleNavigation("/panel/settings")}
                  className="p-3 rounded-2xl bg-gold/10 border border-gold/20"
                >
                  <Settings size={20} />
                </button>
                <button
                  onClick={logout}
                  className="p-3 rounded-2xl bg-red-50 text-red-500 border border-red-100"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </footer>
        </GlassCard>
      </motion.div>
    </>
  );
};
