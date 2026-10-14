/**
 * @file CopyDeskCollectionPage.tsx
 * @description `/redakcja/zbiorka` — where the people who see the money arrive
 * (Zrzutka, the bank statement, cash) bring the vault's collection figure up to
 * date themselves. Default export required for the lazy route.
 *
 * It lives in the desk because that is where these editors already work, but it
 * is not copy: a save is live backend data that reaches the site within a
 * minute, with no review, no `copy:apply` and no deploy. Staff only, which is a
 * narrower gate than the desk's own; an editor who reaches the address without
 * it is refused here, inside the desk's rail.
 * @module pages/copydesk/CopyDeskCollectionPage
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";

import { useCollectionDesk } from "@/features/copydesk/api/collection.queries";
import { CollectionForm } from "@/features/copydesk/components/CollectionForm";
import { CollectionHistory } from "@/features/copydesk/components/CollectionHistory";
import { CopyDeskAccessRefusal } from "@/features/copydesk/components/CopyDeskAccessRefusal";
import {
  effectiveGoal,
  formatPln,
  goalPercent,
} from "@/features/copydesk/lib/collection";
import { formatCount } from "@/features/copydesk/lib/scopeGroups";
import { parseApiError } from "@/shared/api/errors";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { StatLine, type StatLineItem } from "@/shared/ui/composites/StatLine";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";

export default function CopyDeskCollectionPage(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const language = i18n.language || "pl";
  const { data: desk, isLoading, error, refetch } = useCollectionDesk();

  const header = (
    <PageHeader
      title={t("copy_desk.collection.title", "Stan")}
      titleHighlight={t("copy_desk.collection.title_highlight", "zbiórki")}
    />
  );

  if (!desk) {
    const { kind } = parseApiError(error);
    return (
      <PageTransition className="min-h-0">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-16 pt-6">
          {header}
          {isLoading ? (
            <EtherealLoader fullHeight={false} />
          ) : kind === "permission" || kind === "auth" ? (
            <StatePanel
              icon={<KeyRound size={22} aria-hidden="true" />}
              eyebrow={t("copy_desk.eyebrow", "Redakcja")}
              title={t("copy_desk.collection.refused_title", "Zbiórkę prowadzą administratorzy")}
              description={t(
                "copy_desk.collection.refused_description",
                "Ta strona zmienia kwotę, którą widzi każdy odwiedzający, więc mają do niej dostęp tylko konta administratorów.",
              )}
              actions={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/redakcja">{t("copy_desk.review.back", "Spis treści")}</Link>
                </Button>
              }
            />
          ) : (
            <CopyDeskAccessRefusal error={error} onRetry={() => void refetch()} />
          )}
        </div>
      </PageTransition>
    );
  }

  const percent = goalPercent(desk);
  // The figure the vault prints, stated once and above the form, so nobody
  // copies it into a source row.
  const site: StatLineItem[] = [
    {
      id: "raised",
      value: formatPln(desk.total.raised, language),
      label: t("copy_desk.collection.stat_raised", "zebrane"),
    },
    {
      id: "donors",
      value: formatCount(desk.total.donors, language),
      label: t("copy_desk.collection.stat_donors", {
        count: desk.total.donors,
        defaultValue: "darczyńców",
      }),
    },
    {
      id: "percent",
      value: `${percent}%`,
      label: t("copy_desk.collection.stat_goal", {
        amount: formatPln(effectiveGoal(desk), language),
        defaultValue: "celu {{amount}}",
      }),
    },
  ];

  return (
    <PageTransition className="min-h-0">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-16 pt-6">
        {header}
        <StatLine stats={site} />
        <Text size="sm" color="graphite">
          {t(
            "copy_desk.collection.intro",
            "Tyle pokazuje skarbiec na stronie. Płatności przez stronę liczą się same; Zrzutkę, przelewy i gotówkę wpisujecie tutaj.",
          )}
        </Text>
        <CollectionForm desk={desk} />
        <CollectionHistory revisions={desk.revisions} />
      </div>
    </PageTransition>
  );
}
