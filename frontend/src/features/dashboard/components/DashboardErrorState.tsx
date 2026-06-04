/**
 * @file DashboardErrorState.tsx
 * @description Shared on-brand error state for the dashboard home views.
 * Surfaced when the workspace queries fail, so Mission Control never silently
 * renders zeros in place of unreachable data. Offers a one-tap re-sync.
 * @architecture Enterprise SaaS 2026
 * @module features/dashboard/components/DashboardErrorState
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { CloudOff, RefreshCw } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";

export interface DashboardErrorStateProps {
  onRetry: () => void;
}

export const DashboardErrorState = ({
  onRetry,
}: DashboardErrorStateProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center px-4">
      <GlassCard
        variant="light"
        padding="lg"
        isHoverable={false}
        className="flex max-w-md flex-col items-center gap-4 text-center"
      >
        <div
          className="rounded-full border border-ethereal-crimson/20 bg-ethereal-crimson/5 p-4 text-ethereal-crimson"
          aria-hidden="true"
        >
          <CloudOff size={28} strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <Eyebrow color="muted">
            {t("dashboard.shared.error.eyebrow", "Pulpit nieosiągalny")}
          </Eyebrow>
          <Heading as="h2" size="xl" weight="medium">
            {t("dashboard.shared.error.title", "Nie udało się załadować pulpitu.")}
          </Heading>
          <Text color="graphite">
            {t(
              "dashboard.shared.error.description",
              "Dane nie dotarły z serwera. Spróbuj zsynchronizować ponownie.",
            )}
          </Text>
        </div>
        <Button
          variant="primary"
          onClick={onRetry}
          leftIcon={<RefreshCw size={16} aria-hidden="true" />}
        >
          {t("dashboard.shared.error.action", "Ponów synchronizację")}
        </Button>
      </GlassCard>
    </div>
  );
};
