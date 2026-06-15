/**
 * @file PasswordInput.tsx
 * @description Password field built on the Ethereal `Input` primitive, adding a
 * visibility toggle, optional Caps-Lock awareness and inline error/hint copy.
 * Shared by the auth flow (login, activation) and security settings so the
 * password UX stays identical everywhere a secret is entered.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/primitives/PasswordInput
 */

import React, { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { Input } from "@/shared/ui/primitives/Input";
import { Caption } from "@/shared/ui/primitives/typography";
import { DURATION, EASE } from "@/shared/ui/kinematics/motion-presets";

interface PasswordInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label?: string;
  readonly placeholder?: string;
  readonly autoComplete: string;
  readonly name?: string;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly autoFocus?: boolean;
  readonly id?: string;
  /** Defaults to a key glyph; pass `null` to drop the left icon. */
  readonly leftIcon?: React.ReactNode | null;
  /** Surface a "Caps Lock is on" whisper while the field is focused. */
  readonly capsLockHint?: boolean;
}

export const PasswordInput = ({
  value,
  onChange,
  label,
  placeholder = "••••••••",
  autoComplete,
  name,
  error,
  disabled,
  required,
  autoFocus,
  id,
  leftIcon,
  capsLockHint = false,
}: PasswordInputProps): React.JSX.Element => {
  const { t } = useTranslation();
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const [visible, setVisible] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  const trackCaps = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!capsLockHint) return;
    setCapsOn(event.getModifierState?.("CapsLock") ?? false);
  };

  const resolvedLeftIcon =
    leftIcon === null ? undefined : (leftIcon ?? <KeyRound className="h-4 w-4" />);

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="ml-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ethereal-graphite antialiased"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <Input
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={trackCaps}
          onKeyDown={trackCaps}
          onBlur={() => setCapsOn(false)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          hasError={Boolean(error)}
          disabled={disabled}
          required={required}
          className="pr-12"
          leftIcon={resolvedLeftIcon}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={
            visible
              ? t("password.hide", "Ukryj hasło")
              : t("password.show", "Pokaż hasło")
          }
          className="absolute inset-y-0 right-2 my-auto flex h-8 w-8 items-center justify-center rounded-lg text-ethereal-graphite/50 transition-colors hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
        >
          {visible ? (
            <EyeOff size={16} aria-hidden="true" />
          ) : (
            <Eye size={16} aria-hidden="true" />
          )}
        </button>
      </div>

      <AnimatePresence>
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE.buttery }}
          >
            <Caption role="alert" color="crimson" className="pl-1">
              {error}
            </Caption>
          </motion.div>
        ) : (
          capsLockHint &&
          capsOn && (
            <motion.div
              key="caps"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: DURATION.fast, ease: EASE.buttery }}
            >
              <Caption color="incense" className="pl-1">
                {t("password.caps_lock", "Caps Lock jest włączony")}
              </Caption>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
};
