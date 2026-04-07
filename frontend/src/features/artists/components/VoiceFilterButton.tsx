/**
 * @file VoiceFilterButton.tsx
 * @description Presentational component for filtering artists by voice type.
 * Implements strict visual variants to eliminate Tailwind bloat in the main view.
 * @module panel/artists/components/VoiceFilterButton
 */

import React from "react";

export type VoiceType = "S" | "A" | "T" | "B" | "ALL";

interface VoiceFilterButtonProps {
  voiceType: VoiceType;
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

// Dictionary mapping voice types to their specific Tailwind color schemas
const VOICE_VARIANTS: Record<
  VoiceType,
  { active: string; inactive: string; text: string; count: string }
> = {
  S: {
    active: "bg-rose-100 border-rose-300 ring-2 ring-rose-500/20",
    inactive: "bg-rose-50/50 border-rose-100/50 hover:bg-rose-100/50",
    text: "text-rose-500",
    count: "text-rose-700",
  },
  A: {
    active: "bg-purple-100 border-purple-300 ring-2 ring-purple-500/20",
    inactive: "bg-purple-50/50 border-purple-100/50 hover:bg-purple-100/50",
    text: "text-purple-500",
    count: "text-purple-700",
  },
  T: {
    active: "bg-sky-100 border-sky-300 ring-2 ring-sky-500/20",
    inactive: "bg-sky-50/50 border-sky-100/50 hover:bg-sky-100/50",
    text: "text-sky-500",
    count: "text-sky-700",
  },
  B: {
    active: "bg-emerald-100 border-emerald-300 ring-2 ring-emerald-500/20",
    inactive: "bg-emerald-50/50 border-emerald-100/50 hover:bg-emerald-100/50",
    text: "text-emerald-500",
    count: "text-emerald-700",
  },
  ALL: {
    active: "opacity-100 bg-stone-100 border-stone-300",
    inactive: "opacity-50 hover:opacity-100 border-transparent",
    text: "text-stone-400",
    count: "text-stone-800",
  },
};

export const VoiceFilterButton: React.FC<VoiceFilterButtonProps> = ({
  voiceType,
  label,
  count,
  isActive,
  onClick,
}) => {
  const variant = VOICE_VARIANTS[voiceType];
  const baseClasses =
    "px-5 py-2.5 rounded-2xl flex flex-col items-center min-w-[80px] transition-all active:scale-95 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]";
  const borderClasses =
    voiceType === "ALL" ? "ml-2 border-l border-stone-200/50" : "border";

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${borderClasses} ${isActive ? variant.active : variant.inactive}`}
      aria-pressed={isActive}
    >
      <span
        className={`text-[9px] font-bold antialiased uppercase tracking-widest ${variant.text}`}
      >
        {label}
      </span>
      <span
        className={`text-xl font-black leading-none mt-1.5 ${variant.count}`}
      >
        {count}
      </span>
    </button>
  );
};
