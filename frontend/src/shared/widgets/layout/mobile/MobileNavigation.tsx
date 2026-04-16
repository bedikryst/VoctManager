/**
 * @file MobileNavigation.tsx
 * @description Root controller for the mobile gestural navigation interface.
 * Built for React 19+ (Compiler-optimized).
 */

import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useNavigationAura } from "../hooks/useNavigationAura";
import { MobileNavSheet } from "./MobileNavSheet";
import { MobileNavTrigger } from "./MobileNavTrigger";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { hapticsService } from "@/shared/lib/hardware/hapticsService";
import { useCloseWatcher } from "@/shared/lib/dom/useCloseWatcher"; // <--- Import nowego hooka
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
  const navigationAura = useNavigationAura(user);

  useBodyScrollLock(isOpen);

  const handleOpen = () => {
    setIsOpen(true);
    hapticsService.playEtherealTick();
  };

  const handleClose = () => {
    setIsOpen(false);
    hapticsService.playSoftClose();
  };

  useCloseWatcher(isOpen, handleClose);

  return (
    <>
      <AnimatePresence mode="wait">
        {!isOpen && (
          <MobileNavTrigger onOpen={handleOpen} aura={navigationAura} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <MobileNavSheet
            onClose={handleClose}
            aura={navigationAura}
            logout={logout}
          />
        )}
      </AnimatePresence>
    </>
  );
};
