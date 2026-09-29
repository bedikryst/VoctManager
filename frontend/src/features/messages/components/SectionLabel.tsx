/**
 * @file SectionLabel.tsx
 * @description The label over a group of conversation rows, in the inbox and in
 * the idle pane's briefing alike: a muted overline set at the rows' inset. It
 * carries no icon. The rows under it already carry avatars and unread marks, and
 * gold stays reserved for what is new or active.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";

import { Eyebrow } from "@/shared/ui/primitives/typography";

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Eyebrow color="muted" className="px-2">
    {children}
  </Eyebrow>
);
