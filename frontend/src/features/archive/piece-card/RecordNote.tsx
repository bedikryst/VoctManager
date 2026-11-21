/**
 * @file RecordNote.tsx
 * @description A note under one field of the record, for a contradiction the
 * record holds (`recordContradictions`). In review it stands between the
 * manager and publication, so its text is crimson; on a published record it
 * is work to come back to, so only its mark is.
 * @module features/archive/piece-card/RecordNote
 */

import React from "react";
import { AlertTriangle } from "lucide-react";

import { Text } from "@/shared/ui/primitives/typography";

interface RecordNoteProps {
  readonly isReviewing: boolean;
  readonly children: string;
}

export const RecordNote = ({ isReviewing, children }: RecordNoteProps): React.JSX.Element => (
  <div role="status" className="flex items-start gap-1.5 px-2 pb-1 pt-0.5">
    <AlertTriangle size={14} strokeWidth={2} className="mt-0.75 shrink-0 text-ethereal-crimson" aria-hidden="true" />
    <Text as="p" size="base" color={isReviewing ? "crimson" : "graphite"}>
      {children}
    </Text>
  </div>
);
