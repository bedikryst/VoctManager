import React from "react";
import { Eyebrow, Heading } from "@/shared/ui/primitives/typography";

export type VoiceType = "S" | "A" | "T" | "B" | "ALL";

interface VoiceFilterButtonProps {
  voiceType: VoiceType;
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

const VOICE_VARIANTS: Record<
  VoiceType,
  { bg: string; border: string; activeBorder: string; activeBg: string; colorText: "crimson" | "amethyst" | "gold" | "sage" | "graphite" | "default" }
> = {
  S: {
    bg: "bg-ethereal-alabaster",
    border: "border-ethereal-crimson/20",
    activeBorder: "border-ethereal-crimson/50 ring-1 ring-ethereal-crimson/30",
    activeBg: "bg-ethereal-marble",
    colorText: "crimson",
  },
  A: {
    bg: "bg-ethereal-alabaster",
    border: "border-ethereal-amethyst/20",
    activeBorder: "border-ethereal-amethyst/50 ring-1 ring-ethereal-amethyst/30",
    activeBg: "bg-ethereal-marble",
    colorText: "amethyst",
  },
  T: {
    bg: "bg-ethereal-alabaster",
    border: "border-ethereal-gold/20",
    activeBorder: "border-ethereal-gold/50 ring-1 ring-ethereal-gold/30",
    activeBg: "bg-ethereal-marble",
    colorText: "gold",
  },
  B: {
    bg: "bg-ethereal-alabaster",
    border: "border-ethereal-sage/20",
    activeBorder: "border-ethereal-sage/50 ring-1 ring-ethereal-sage/30",
    activeBg: "bg-ethereal-marble",
    colorText: "sage",
  },
  ALL: {
    bg: "bg-transparent",
    border: "border-transparent",
    activeBorder: "border-ethereal-incense/30 ring-1 ring-ethereal-incense/20",
    activeBg: "bg-ethereal-alabaster",
    colorText: "graphite",
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
  const baseClasses = "px-5 py-2.5 rounded-2xl flex flex-col items-center min-w-[80px] transition-all active:scale-95 cursor-pointer border shadow-glass-ethereal";

  const appliedBg = isActive ? variant.activeBg : variant.bg;
  const appliedBorder = isActive ? variant.activeBorder : variant.border;
  const opacity = !isActive && voiceType === "ALL" ? "opacity-50 hover:opacity-100" : "";

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${appliedBg} ${appliedBorder} ${opacity}`}
      aria-pressed={isActive}
    >
      <Eyebrow color={variant.colorText}>
        {label}
      </Eyebrow>
      <Heading as="span" size="sm" weight="bold" color={isActive ? "default" : "graphite"} className="mt-1.5">
        {count}
      </Heading>
    </button>
  );
};
