/**
 * @file MobileNavigation.tsx
 * @description Root controller for the mobile navigation surface. The bottom tab
 * bar is **always mounted**; the command sheet is an independent overlay that
 * mounts instantly on open. (Previously the two were swapped through a single
 * `AnimatePresence mode="wait"`, so the sheet could not appear until the bar
 * finished its exit spring — a visible open delay. Decoupling them removes it:
 * the sheet slides up immediately and simply covers the static bar.)
 * Owns shell-level concerns: scroll lock, close-watcher (Esc / Android back),
 * haptics on state transitions.
 * @architecture Enterprise SaaS 2026
 * @module widgets/panel-shell/mobile
 */

import React, { useCallback, useState } from "react";
import { AnimatePresence } from "framer-motion";

import { useNavigationAura } from "../hooks/useNavigationAura";
import { MobileNavSheet } from "./MobileNavSheet";
import { MobileNavTrigger } from "./MobileNavTrigger";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { useCloseWatcher } from "@/shared/lib/dom/useCloseWatcher";
import { hapticsService } from "@/shared/lib/hardware/hapticsService";
import type { AuthUser } from "@/shared/auth/auth.types";

interface MobileNavigationProps {
  readonly user: AuthUser | null;
  readonly logout: () => void;
}

export const MobileNavigation = ({
  user,
  logout,
}: MobileNavigationProps): React.JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const aura = useNavigationAura(user);

  useBodyScrollLock(isOpen);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    hapticsService.playEtherealTick();
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    hapticsService.playSoftClose();
  }, []);

  useCloseWatcher(isOpen, handleClose);

  return (
    <>
      <MobileNavTrigger onOpen={handleOpen} isMenuOpen={isOpen} aura={aura} />
      <AnimatePresence>
        {isOpen && (
          <MobileNavSheet
            key="sheet"
            user={user}
            onClose={handleClose}
            aura={aura}
            logout={logout}
          />
        )}
      </AnimatePresence>
    </>
  );
};

MobileNavigation.displayName = "MobileNavigation";
