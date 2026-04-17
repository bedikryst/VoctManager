/**
 * @file MobileNavSheet.tsx
 * @description Spatial expanded state of navigation.
 * Implements hardware-accelerated scroll masking, volumetric spring physics,
 * and strict A11y standards. Blur transitions mapped to GPU opacity.
 * @module shared/widgets/layout/mobile
 */

import React, { useRef } from "react";
import {
  motion,
  PanInfo,
  useDragControls,
  useMotionValue,
  Variants,
} from "framer-motion";
import { NavLink } from "react-router-dom";
import { X, Settings, LogOut } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import {
  Heading,
  Eyebrow,
  Label,
  Text,
} from "@/shared/ui/primitives/typography";
import { useFocusTrap } from "@/shared/lib/dom/useFocusTrap";
import { useNavigationAura } from "../hooks/useNavigationAura";
import { mobileNavLinkVariants } from "./MobileNavigation.styles";

const KINEMATICS = {
  SHEET_SPRING: { type: "spring", stiffness: 320, damping: 35, mass: 0.9 },
  SWIPE_THRESHOLD: 100,
  VELOCITY_THRESHOLD: 400,
  DRAG_ELASTICITY: 0.05,
} as const;

const STAGGER_VARIANTS: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

const ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
};

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
  const containerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const y = useMotionValue(0);

  useFocusTrap(containerRef, true);

  const handleDragEnd = (
    _: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ) => {
    if (
      info.offset.y > KINEMATICS.SWIPE_THRESHOLD ||
      info.velocity.y > KINEMATICS.VELOCITY_THRESHOLD
    ) {
      onClose();
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 z-[calc(var(--z-nav-sheet)-1)] bg-ethereal-ink/40 backdrop-blur-md md:hidden will-change-[opacity]"
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={aura.t(
          "nav.sheet.accessibility_label",
          "Expanded mobile navigation",
        )}
        className="fixed bottom-0 left-0 right-0 z-[var(--z-nav-sheet)] max-h-[94dvh] h-full outline-none md:hidden flex flex-col justify-end pt-8 will-change-transform"
        style={{ y, touchAction: "none" }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={KINEMATICS.DRAG_ELASTICITY}
        onDragEnd={handleDragEnd}
        initial={{
          y: "100%",
          borderTopLeftRadius: "0px",
          borderTopRightRadius: "0px",
        }}
        animate={{
          y: 0,
          borderTopLeftRadius: "40px",
          borderTopRightRadius: "40px",
        }}
        exit={{ y: "100%", transition: { duration: 0.25, ease: "circIn" } }}
        transition={KINEMATICS.SHEET_SPRING}
      >
        <GlassCard
          variant="solid"
          padding="none"
          withNoise={true}
          isHoverable={false}
          glow={false}
          className="w-full h-full overflow-hidden border-t border-white/20 shadow-[0_-4px_24px_rgba(0,0,0,0.15)] bg-gradient-to-b from-white/85 to-white/65 contain-strict"
        >
          <div className="flex flex-col w-full h-full relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-ethereal-gold/10 blur-[40px] pointer-events-none rounded-full will-change-transform transform-gpu" />

            <div
              className="w-full flex justify-center py-6 cursor-grab active:cursor-grabbing touch-none shrink-0 relative z-10"
              onPointerDown={(e) => dragControls.start(e)}
              aria-hidden="true"
            >
              <div className="w-14 h-1.5 rounded-full bg-ethereal-graphite/20 shadow-inner" />
            </div>

            <header className="flex items-center justify-between px-8 pb-6 shrink-0 relative z-10">
              <Heading as="span" size="3xl" className="tracking-tight">
                <span className="font-light text-ethereal-graphite">Voct</span>
                <Text
                  as="span"
                  color="gold"
                  size="3xl"
                  className="italic font-medium ml-1"
                >
                  Manager
                </Text>
              </Heading>
              <button
                onClick={onClose}
                aria-label={aura.t("common.actions.close", "Close navigation")}
                className="flex items-center justify-center min-w-[48px] min-h-[48px] rounded-full bg-white/40 shadow-sm border border-white/50 active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold transition-transform"
              >
                <X size={20} className="text-ethereal-graphite/70" />
              </button>
            </header>

            <motion.div
              data-scroll-lock-ignore="true"
              variants={STAGGER_VARIANTS}
              initial="hidden"
              animate="visible"
              className="flex-1 min-h-0 mb-5 overflow-y-auto px-6 touch-pan-y overscroll-contain no-scrollbar relative z-10"
            >
              <nav className="flex flex-col gap-8 py-4 pb-24">
                {aura.navGroups.map((group) => (
                  <motion.section key={group.labelKey} variants={ITEM_VARIANTS}>
                    <Eyebrow className="mb-4 pl-6 tracking-[0.25em] uppercase text-[0.65rem] text-ethereal-graphite/50 font-bold">
                      {aura.t(group.labelKey)}
                    </Eyebrow>
                    <ul className="space-y-1 list-none p-0 m-0">
                      {group.links.map((link) => {
                        const Icon = link.icon;
                        return (
                          <li key={link.to}>
                            <NavLink
                              to={link.to}
                              onClick={onClose}
                              className={({ isActive }) =>
                                cn(mobileNavLinkVariants({ isActive }))
                              }
                            >
                              {({ isActive }) => (
                                <>
                                  <div className="relative flex items-center justify-center w-8 h-8">
                                    <Icon
                                      size={22}
                                      strokeWidth={isActive ? 2.5 : 1.5}
                                      className={cn(
                                        "transition-colors duration-300 relative z-10",
                                        isActive
                                          ? "text-ethereal-gold"
                                          : "text-ethereal-graphite/60",
                                      )}
                                    />
                                    {isActive && (
                                      <div className="absolute inset-0 bg-ethereal-gold/20 blur-md rounded-full pointer-events-none" />
                                    )}
                                  </div>
                                  <Text
                                    weight={isActive ? "semibold" : "medium"}
                                    className={cn(
                                      "tracking-wide transition-colors duration-300",
                                      isActive
                                        ? "text-ethereal-ink"
                                        : "text-ethereal-graphite/70",
                                    )}
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
                  </motion.section>
                ))}
              </nav>
            </motion.div>

            <motion.footer
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.2,
                type: "spring",
                stiffness: 200,
                damping: 20,
              }}
              className="absolute bottom-8 left-6 right-6 shrink-0 z-20"
            >
              <div className="flex items-center justify-between p-3.5 rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                {/* Identity Cluster (Initials + Names) */}
                <div className="flex items-center gap-3 overflow-hidden pl-1 pr-3">
                  {/* Initials Avatar Badge (Sourced from DesktopSidebar) */}
                  <div className="flex flex-shrink-0 h-[36px] w-[36px] items-center justify-center rounded-[10px] bg-gradient-to-br from-ethereal-gold/20 to-transparent border border-ethereal-gold/30 shadow-sm transform-gpu">
                    <Label
                      color="gold"
                      size="sm"
                      weight="semibold"
                      className="leading-none m-0"
                    >
                      {aura.initials}
                    </Label>
                  </div>

                  {/* User Data */}
                  <div className="flex flex-col overflow-hidden">
                    <Label className="text-[0.95rem] leading-tight mb-0.5 truncate text-ethereal-ink font-semibold">
                      {aura.userFullName}
                    </Label>
                    <Eyebrow
                      color="incense"
                      size="xs"
                      className="truncate font-medium opacity-80"
                    >
                      {aura.roleLabel}
                    </Eyebrow>
                  </div>
                </div>

                {/* Action Cluster */}
                <div className="flex gap-1.5 shrink-0">
                  <NavLink
                    to="/panel/settings"
                    onClick={onClose}
                    aria-label={aura.t("nav.settings", "Ustawienia")}
                    className="flex items-center justify-center w-11 h-11 rounded-[14px] bg-ethereal-graphite/5 border border-transparent hover:bg-white/80 hover:shadow-sm hover:text-ethereal-gold text-ethereal-graphite/70 transition-all active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold"
                  >
                    <Settings size={20} strokeWidth={2} />
                  </NavLink>
                  <button
                    onClick={logout}
                    aria-label={aura.t("auth.logout", "Wyloguj się")}
                    className="flex items-center justify-center w-11 h-11 rounded-[14px] bg-ethereal-crimson/5 border border-transparent hover:bg-ethereal-crimson/10 text-ethereal-crimson/80 transition-all active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-crimson"
                  >
                    <LogOut size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </motion.footer>
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-white/95 via-white/60 to-transparent pointer-events-none z-10 rounded-b-[40px]" />
          </div>
        </GlassCard>
      </motion.div>
    </>
  );
};
