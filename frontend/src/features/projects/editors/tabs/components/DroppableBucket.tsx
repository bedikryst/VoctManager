/**
 * @file DroppableBucket.tsx
 * @description Droppable container for the micro-casting Kanban.
 * Wraps `useDroppable` and renders a tactile, motion-aware highlight while
 * a draggable artist hovers above it.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/DroppableBucket
 */

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";

export interface DroppableBucketProps {
  id: string;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

export function DroppableBucket({
  id,
  title,
  className = "",
  children,
}: DroppableBucketProps): React.JSX.Element {
  const { t } = useTranslation();
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: {
      type: "Bucket",
      title,
    },
  });

  return (
    <div
      ref={setNodeRef}
      aria-label={
        title
          ? t(
              "projects.micro_cast.bucket.aria_with_title",
              "Sekcja upuszczania: {{title}}",
              { title },
            )
          : t("projects.micro_cast.bucket.aria", "Sekcja upuszczania")
      }
      className={cn(
        "relative rounded-xl transition-[background-color,box-shadow,border-color] duration-200",
        isOver
          ? "bg-ethereal-gold/8 ring-2 ring-ethereal-gold/40 shadow-[inset_0_0_0_1px_rgba(194,168,120,0.15)]"
          : "border border-transparent bg-transparent",
        className,
      )}
    >
      {isOver && (
        <div
          className="absolute inset-0 pointer-events-none rounded-xl bg-gradient-to-b from-ethereal-gold/8 via-transparent to-transparent"
          aria-hidden="true"
        />
      )}

      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}
