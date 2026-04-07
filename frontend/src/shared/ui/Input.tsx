/**
 * @file Input.tsx
 * @description Standardized input field with built-in glassmorphism aesthetics,
 * optional icon slots, and strict type safety.
 * @module ui/Input
 */

import React, { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Optional icon component rendered on the left side */
  leftIcon?: React.ReactNode;
  /** Optional element (e.g., currency label) rendered on the right side */
  rightElement?: React.ReactNode;
  /** Applies error state styling if true */
  hasError?: boolean;
  /** Toggles a darker, high-contrast aesthetic */
  isDark?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      leftIcon,
      rightElement,
      hasError = false,
      isDark = false,
      className = "",
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "w-full text-sm rounded-xl focus:outline-none focus:ring-2 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";
    const themeStyles = isDark
      ? "text-white bg-white/5 backdrop-blur-md border border-white/10 focus:ring-blue-500/50 hover:bg-white/10 font-bold"
      : "text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 focus:ring-[#002395]/20 focus:border-[#002395]/40";
    const errorStyles = hasError
      ? "border-red-400 focus:ring-red-500/20 text-red-900 bg-red-50"
      : "";

    const paddingLeft = leftIcon ? "pl-11" : "px-4";
    const paddingRight = rightElement ? "pr-12" : "px-4";

    return (
      <div className="relative w-full">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-stone-400">
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          className={`${baseStyles} ${themeStyles} ${errorStyles} ${paddingLeft} ${paddingRight} py-3 ${className}`}
          {...props}
        />

        {rightElement && (
          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-stone-400 text-xs font-bold">
            {rightElement}
          </div>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
