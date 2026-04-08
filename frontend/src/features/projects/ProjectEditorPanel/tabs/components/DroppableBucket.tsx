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
      className={`relative rounded-xl transition-all duration-200 ${
        isOver
          ? "bg-[#002395]/5 ring-2 ring-[#002395]/20 shadow-inner"
          : "bg-transparent border border-transparent"
      } ${className}`}
    >
      {isOver && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#002395]/5 to-transparent rounded-xl pointer-events-none" />
      )}

      <div className="relative z-10 h-full flex flex-col">{children}</div>
    </div>
  );
}
