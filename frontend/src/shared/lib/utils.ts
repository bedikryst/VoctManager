/**
 * @file utils.ts
 * @description Core shared utility functions for the application.
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind classes safely, resolving conflicts.
 * @param inputs - Array of class names, objects, or conditionals.
 * @returns A strictly merged Tailwind class string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
