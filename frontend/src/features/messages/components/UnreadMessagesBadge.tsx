/**
 * @file UnreadMessagesBadge.tsx
 * @description Reusable unread-threads count badge for navigation surfaces (desktop
 * sidebar, mobile dock, mobile sheet). Self-gating: renders nothing at zero. Must be
 * placed inside a `relative` positioned slot.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";

import { Label } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { useUnreadThreadCount } from "../api/messages.queries";

interface UnreadMessagesBadgeProps {
  className?: string;
}

export const UnreadMessagesBadge: React.FC<UnreadMessagesBadgeProps> = ({
  className,
}) => {
  const { data: unread = 0 } = useUnreadThreadCount();
  if (unread <= 0) return null;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ethereal-gold px-1 ring-2 ring-ethereal-alabaster",
        className,
      )}
    >
      <Label
        size="xs"
        color="white"
        weight="bold"
        className="text-[9px] leading-none"
      >
        {unread > 9 ? "9+" : unread}
      </Label>
    </span>
  );
};
