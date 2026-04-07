/**
 * @file Button.tsx
 * @description Enterprise-grade button component handling multiple variants,
 * sizes, and automated loading states.
 * @module ui/Button
 */

import React, { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  /** Disables interactions and displays a loading spinner */
  isLoading?: boolean;
  /** Optional icon placed before the text */
  leftIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      isLoading = false,
      leftIcon,
      className = "",
      disabled,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.15em] font-bold antialiased py-3.5 px-8 rounded-xl transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-60";

    const variants = {
      primary:
        "bg-[#002395] hover:bg-[#001766] text-white shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)]",
      secondary:
        "bg-stone-900 hover:bg-[#002395] text-white shadow-[0_4px_14px_rgba(0,0,0,0.15)]",
      outline:
        "bg-white border border-stone-200/80 text-stone-600 hover:text-[#002395] hover:border-[#002395]/40 shadow-sm",
      danger: "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100",
      ghost:
        "bg-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100",
    };

    return (
      <button
        ref={ref}
        disabled={isLoading || disabled}
        className={`${baseStyles} ${variants[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          leftIcon
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
