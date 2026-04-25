/**
 * @file InvitationStatusWidget.tsx
 * @description Aggregated invitation acceptance status across active projects.
 * Clicking opens InvitationDetailModal with a full participant list.
 * @architecture Enterprise SaaS 2026
 * @module panel/dashboard/components/InvitationStatusWidget
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserCheck, Clock, UserX, ChevronRight } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { MetricBlock } from "@/shared/ui/composites/MetricBlock";
import { Divider } from "@/shared/ui/primitives/Divider";
import { Eyebrow } from "@/shared/ui/primitives/typography";
import { InvitationDetailModal } from "./InvitationDetailModal";

export interface InvitationStatsDto {
  confirmed: number;
  pending: number;
  declined: number;
}

interface InvitationStatusWidgetProps {
  stats?: InvitationStatsDto;
}

export const InvitationStatusWidget = ({
  stats,
}: InvitationStatusWidgetProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const resolved = stats ?? { confirmed: 0, pending: 0, declined: 0 };

  return (
    <>
      <GlassCard
        as="button"
        type="button"
        variant="light"
        withNoise
        isHoverable
        onClick={() => setIsModalOpen(true)}
        aria-haspopup="dialog"
        aria-label={t(
          "dashboard.admin.inv_open_details_aria",
          "Otwórz szczegółową listę zaproszeń",
        )}
        className="flex h-full flex-col gap-6 p-6 md:p-8"
      >
        <div className="flex items-center justify-between">
          <SectionHeader
            title={t("dashboard.admin.kpi_invitations", "Status Zaproszeń")}
            icon={<UserCheck size={16} strokeWidth={1.5} />}
          />
          <div className="flex items-center gap-1 text-ethereal-graphite/40 transition-colors group-hover:text-ethereal-gold">
            <Eyebrow color="muted">
              {t("dashboard.admin.inv_details_link", "Szczegóły")}
            </Eyebrow>
            <ChevronRight size={13} aria-hidden="true" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 xl:gap-6">
          <MetricBlock
            label={t("dashboard.admin.inv_confirmed", "Potwierdzeni")}
            value={resolved.confirmed}
            icon={<UserCheck />}
            accentColor="gold"
          />

          <div className="relative pl-6 xl:pl-8">
            <Divider
              variant="gradient-bottom"
              orientation="vertical"
              position="absolute-left"
            />
            <MetricBlock
              label={t("dashboard.admin.inv_pending", "Oczekujący")}
              value={resolved.pending}
              icon={<Clock />}
            />
          </div>

          <div className="relative pl-6 xl:pl-8">
            <Divider
              variant="gradient-bottom"
              orientation="vertical"
              position="absolute-left"
            />
            <MetricBlock
              label={t("dashboard.admin.inv_declined", "Odrzucili")}
              value={resolved.declined}
              icon={<UserX />}
              accentColor="crimson"
            />
          </div>
        </div>
      </GlassCard>

      <InvitationDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
