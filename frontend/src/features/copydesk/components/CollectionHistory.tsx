/**
 * @file CollectionHistory.tsx
 * @description The last changes to the offline tallies: which source, the
 * figure it was set to, who set it and when. A public money figure typed by
 * hand goes live unreviewed, and this trail is the control that allows it. The
 * full trail stays in the admin; the desk shows the recent end.
 * @module features/copydesk/components/CollectionHistory
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { History } from "lucide-react";

import { formatLocalizedDateTime } from "@/shared/lib/time/intl";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { formatPln } from "../lib/collection";
import type { CollectionRevision } from "../types/collection.dto";

interface CollectionHistoryProps {
  readonly revisions: readonly CollectionRevision[];
}

export const CollectionHistory = ({
  revisions,
}: CollectionHistoryProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const language = i18n.language || "pl";

  return (
    <SectionCard
      title={t("copy_desk.collection.history_title", "Ostatnie zmiany")}
      icon={<History size={16} aria-hidden="true" />}
    >
      {revisions.length === 0 ? (
        <StatePanel
          variant="inline"
          icon={<History size={22} aria-hidden="true" />}
          title={t("copy_desk.collection.history_empty", "Nikt jeszcze niczego nie zmienił.")}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-hairline">
          {revisions.map((revision) => (
            <li
              key={revision.id}
              className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <Text size="sm" className="tabular-nums">
                {`${t(`copy_desk.collection.source.${revision.source}.label`)} · ${formatPln(
                  revision.amount,
                  language,
                )} · ${t("copy_desk.collection.donor_count", {
                  count: revision.donors,
                  defaultValue: "{{count}} darczyńców",
                })}`}
              </Text>
              <Caption color="muted">
                {`${formatLocalizedDateTime(
                  revision.created_at,
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                  language,
                )} · ${
                  revision.user_name ??
                  t("copy_desk.collection.history_initial", "stan początkowy")
                }`}
              </Caption>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
};

CollectionHistory.displayName = "CollectionHistory";
