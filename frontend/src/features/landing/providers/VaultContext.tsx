/**
 * @file VaultContext.tsx
 * @description Shared state for the donation vault sheet + companion regulamin overlay.
 * Lets any descendant trigger `open()`/`close()` and `openRegulamin()`/`closeRegulamin()`,
 * and lets the give-form publish its `preselect()` API back upward so opening links can
 * pass an amount (data-amount="100" etc.).
 * @architecture Enterprise SaaS 2026
 * @module features/landing/providers/VaultContext
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface VaultPreselectApi {
  readonly preselect: (amount: number) => void;
}

interface VaultContextValue {
  readonly isOpen: boolean;
  readonly isRegulaminOpen: boolean;
  readonly open: (amount?: number) => void;
  readonly close: () => void;
  readonly openRegulamin: () => void;
  readonly closeRegulamin: () => void;
  readonly acceptRegulamin: () => void;
  readonly registerGiveApi: (api: VaultPreselectApi | null) => void;
  readonly registerConsentAcceptor: (acceptor: (() => void) | null) => void;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [isRegulaminOpen, setIsRegulaminOpen] = useState(false);
  const giveApiRef = useRef<VaultPreselectApi | null>(null);
  const acceptorRef = useRef<(() => void) | null>(null);

  const open = useCallback((amount?: number) => {
    if (typeof amount === "number" && Number.isFinite(amount)) {
      giveApiRef.current?.preselect(amount);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const openRegulamin = useCallback(() => setIsRegulaminOpen(true), []);
  const closeRegulamin = useCallback(() => setIsRegulaminOpen(false), []);

  const acceptRegulamin = useCallback(() => {
    acceptorRef.current?.();
    setIsRegulaminOpen(false);
  }, []);

  const registerGiveApi = useCallback((api: VaultPreselectApi | null) => {
    giveApiRef.current = api;
  }, []);

  const registerConsentAcceptor = useCallback((acceptor: (() => void) | null) => {
    acceptorRef.current = acceptor;
  }, []);

  const value = useMemo<VaultContextValue>(
    () => ({
      isOpen,
      isRegulaminOpen,
      open,
      close,
      openRegulamin,
      closeRegulamin,
      acceptRegulamin,
      registerGiveApi,
      registerConsentAcceptor,
    }),
    [
      isOpen,
      isRegulaminOpen,
      open,
      close,
      openRegulamin,
      closeRegulamin,
      acceptRegulamin,
      registerGiveApi,
      registerConsentAcceptor,
    ],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within a VaultProvider");
  return ctx;
}
