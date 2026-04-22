/**
 * @file DroppableBucket.tsx
 * @description Droppable zone container for @dnd-kit.
 * Handles drop detection and visual feedback during active drag operations.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/tabs/components/DroppableBucket
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
        "relative rounded-xl transition-all duration-200",
        isOver
          ? "bg-ethereal-gold/5 ring-2 ring-ethereal-gold/20 shadow-inner"
          : "border border-transparent bg-transparent",
        className,
      )}
    >
      {isOver && (
        <div className="absolute inset-0 pointer-events-none rounded-xl bg-gradient-to-b from-ethereal-gold/5 to-transparent" />
      )}

      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}
