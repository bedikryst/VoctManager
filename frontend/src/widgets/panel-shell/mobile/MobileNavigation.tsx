/**
 * @file MobileNavigation.tsx
 * @description Root controller for the mobile navigation surface. Mounts a single
 * child at a time (collapsed dock or expanded sheet) and owns shell-level concerns:
 * scroll lock, close-watcher (Esc / Android back), haptics on state transitions.
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
    <AnimatePresence initial={false} mode="wait">
      {isOpen ? (
        <MobileNavSheet
          key="sheet"
          onClose={handleClose}
          aura={aura}
          logout={logout}
        />
      ) : (
        <MobileNavTrigger key="trigger" onOpen={handleOpen} aura={aura} />
      )}
    </AnimatePresence>
  );
};

MobileNavigation.displayName = "MobileNavigation";
