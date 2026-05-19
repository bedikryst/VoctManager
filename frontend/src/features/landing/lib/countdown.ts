/**
 * @file countdown.ts
 * @description Days-until calculations + Polish-formatted labels for the concert countdown.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/lib/countdown
 */

export function daysUntil(target: Date, from: Date = new Date()): number {
  const eventDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((eventDay.getTime() - today.getTime()) / 86_400_000);
}

export function formatCountdownPL(days: number): string {
  if (days > 1) return `za ${days} dni`;
  if (days === 1) return "jutro";
  if (days === 0) return "dziś";
  return "wybrzmiało";
}
