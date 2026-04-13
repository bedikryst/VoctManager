/**
 * @file Input.tsx
 * @description Enterprise-grade input field with integrated label and error handling.
 * Optimised for react-hook-form and Zod validation schemas.
 * @module shared/ui/primitives/Input
 */

import React, { InputHTMLAttributes, forwardRef, useId } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const inputVariants = cva(
  "w-full rounded-xl text-sm transition-all duration-300 placeholder:text-stone-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        glass:
          "bg-white/40 backdrop-blur-md border border-stone-200/60 text-stone-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] focus:border-brand/40 focus:ring-brand/10",
        dark: "bg-white/5 backdrop-blur-xl border border-white/10 text-white shadow-2xl focus:border-blue-500/50 focus:ring-blue-500/20 hover:bg-white/10",
        ghost:
          "bg-transparent border-transparent hover:bg-stone-100 focus:bg-white focus:border-stone-200",
      },
      hasError: {
        true: "border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-500/10 text-red-900",
      },
    },
    defaultVariants: {
      variant: "glass",
      hasError: false,
    },
  },
);

export interface InputProps
  extends
    Omit<InputHTMLAttributes<HTMLInputElement>, "variant">,
    VariantProps<typeof inputVariants> {
  /** Text label displayed above the input */
  label?: string;
  /** Error message derived from validation schema */
  error?: string;
  /** Optional icon rendered on the left flank */
  leftIcon?: React.ReactNode;
  /** Optional element (e.g., unit, currency) on the right flank */
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, variant, leftIcon, rightElement, className, id, ...props },
    ref,
  ) => {
    const internalId = useId();
    const inputId = id || internalId;
    const errorId = `${inputId}-error`;
    const hasError = Boolean(error);

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="ml-1 text-[10px] font-bold uppercase tracking-[0.1em] text-stone-500 antialiased"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div
              className="absolute left-4 flex items-center justify-center text-stone-400"
              aria-hidden="true"
            >
              {/* Refactored to eliminate 'any' type violation */}
              {React.isValidElement(leftIcon)
                ? React.cloneElement(
                    leftIcon as React.ReactElement<{
                      size?: number;
                      strokeWidth?: number;
                    }>,
                    { size: 18, strokeWidth: 1.5 },
                  )
                : leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            className={cn(
              inputVariants({ variant, hasError, className }),
              leftIcon ? "pl-11" : "px-4",
              rightElement ? "pr-12" : "px-4",
              "py-3",
            )}
            {...props}
          />

          {rightElement && (
            <div
              className="absolute right-4 flex items-center justify-center text-[10px] font-bold text-stone-400 uppercase tracking-tighter"
              aria-hidden="true"
            >
              {rightElement}
            </div>
          )}
        </div>

        {hasError && (
          <span
            id={errorId}
            role="alert"
            className="ml-1 animate-in fade-in slide-in-from-top-1 text-[10px] font-medium text-red-500 duration-300"
          >
            {error}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
