/**
 * @file TabLoadingCard.tsx
 * @description What a hub tab shows while its own queries are in flight. The
 * route's Suspense boundary only covers the lazy chunk, so without this a tab
 * paints its empty state first — "nobody is cast", "the programme is empty" —
 * which is a positive claim about the concert, not a wait. The card keeps the
 * tab's own icon and title so the header does not appear a beat after the
 * surface it belongs to.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/TabLoadingCard
 */

import React from "react";

import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";

export interface TabLoadingCardProps {
  readonly title: string;
  readonly icon?: React.ReactNode;
}

export const TabLoadingCard = ({
  title,
  icon,
}: TabLoadingCardProps): React.JSX.Element => (
  <SectionCard as="h2" icon={icon} title={title}>
    <EtherealLoader fullHeight={false} />
  </SectionCard>
);
