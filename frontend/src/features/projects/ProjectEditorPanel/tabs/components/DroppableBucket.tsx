/**
 * @file DroppableBucket.tsx
 * @description Droppable container for voice lines in the micro-casting Kanban board.
 * Visually reacts to drag-over states and deficit requirements.
 * @module panel/projects/ProjectEditorPanel/tabs/components/DroppableBucket
 */

import React from "react";
import { useDroppable } from "@dnd-kit/core";

interface DroppableBucketProps {
  id: string;
  children: React.ReactNode;
  isDeficit: boolean;
  targetQuantity: number | null;
}

export function DroppableBucket({
  id,
  children,
  isDeficit,
  targetQuantity,
}: DroppableBucketProps): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex flex-col min-h-[70px] pt-2 pb-2 gap-2 rounded-xl transition-colors 
                ${isOver ? (isDeficit || targetQuantity === null ? "bg-blue-50/50 shadow-inner" : "bg-emerald-50/50 shadow-inner") : ""}
            `}
    >
      {children}
    </div>
  );
}
