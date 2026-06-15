/**
 * @file Avatar.tsx
 * @description Presence primitive: renders a profile picture when one exists,
 * otherwise a graceful initials fallback. One component for every surface that
 * shows a person (settings, shell, roster) so avatars look identical everywhere
 * and gracefully degrade to initials on missing/broken images.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/Avatar
 */

import React, { useEffect, useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

const avatarVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-serif text-ethereal-gold",
  {
    variants: {
      size: {
        xs: "h-7 w-7 text-[11px]",
        sm: "h-9 w-9 text-xs",
        md: "h-12 w-12 text-lg",
        lg: "h-16 w-16 text-xl",
        xl: "h-24 w-24 text-3xl",
      },
      shape: {
        circle: "rounded-full",
        rounded: "rounded-2xl",
      },
    },
    defaultVariants: {
      size: "md",
      shape: "circle",
    },
  },
);

export interface AvatarProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof avatarVariants> {
  /** Absolute URL of the avatar render; null/undefined → initials fallback. */
  readonly src?: string | null;
  /** Full name used to derive initials and the alt text. */
  readonly name?: string;
  /** Tone of the initials fallback chip. */
  readonly tone?: "gold" | "neutral";
}

const initialsFrom = (name?: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const TONE_CLASS: Record<NonNullable<AvatarProps["tone"]>, string> = {
  gold: "border border-ethereal-gold/30 bg-ethereal-gold/10 text-ethereal-gold",
  neutral:
    "border border-ethereal-incense/20 bg-ethereal-alabaster text-ethereal-graphite",
};

export const Avatar = ({
  src,
  name,
  size,
  shape,
  tone = "gold",
  className,
  children,
  ...props
}: AvatarProps): React.JSX.Element => {
  const [failed, setFailed] = useState(false);

  // Reset the error gate when the source changes (e.g. after a fresh upload).
  useEffect(() => setFailed(false), [src]);

  const showImage = Boolean(src) && !failed;

  return (
    <span
      className={cn(
        avatarVariants({ size, shape }),
        !showImage && TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={name ? `${name}` : ""}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initialsFrom(name)}</span>
      )}
      {children}
    </span>
  );
};
