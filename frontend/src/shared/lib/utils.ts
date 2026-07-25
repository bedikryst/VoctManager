/**
 * @file utils.ts
 * @description Core shared utility functions for the application.
 */
import { type ClassValue, clsx } from "clsx";
import { etherealTwMerge } from "./tailwindMerge";

/**
 * Merges Tailwind classes safely, resolving conflicts.
 * Goes through the theme-aware merger — the stock one reads this project's
 * custom tokens as colours and silently deletes them. See `tailwindMerge.ts`.
 * @param inputs - Array of class names, objects, or conditionals.
 * @returns A strictly merged Tailwind class string.
 */
export function cn(...inputs: ClassValue[]): string {
  return etherealTwMerge(clsx(inputs));
}
