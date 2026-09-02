/**
 * @file CopyDeskContentsPage.tsx
 * @description The desk's front page: what the corpus contains, page by page,
 * and how much of it has been worked on. Default export required for the lazy
 * route.
 *
 * It answers the question an editor asked for by name — "what have I already
 * done" — and it is deliberately the whole of stage D1. The rows do not open
 * yet: the editor is the next surface, and a contents list is a thing to judge
 * on its own before anything is designed on top of it.
 * @architecture Enterprise SaaS 2026
 * @module pages/copydesk/CopyDeskContentsPage
 */

import React, { useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Inbox } from "lucide-react";

import { ScopeContentsList } from "@/features/copydesk/components/ScopeContentsList";
import { formatCount } from "@/features/copydesk/lib/scopeGroups";
import type { CopyDeskOutletContext } from "@/widgets/copy-desk-shell/CopyDeskShell";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { StatLine, type StatLineItem } from "@/shared/ui/composites/StatLine";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";

export default function CopyDeskContentsPage(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const { contents } = useOutletContext<CopyDeskOutletContext>();
  const language = i18n.language || "pl";

  const totalSegments = useMemo(
    () => contents.scopes.reduce((total, scope) => total + scope.segments, 0),
    [contents.scopes],
  );

  // One census, over the whole corpus, and the only place either figure is
  // stated: the cards below list their pages rather than counting them.
  const census: StatLineItem[] = [
    {
      id: "segments",
      value: formatCount(totalSegments, language),
      label: t("copy_desk.contents.segments", {
        count: totalSegments,
        defaultValue: "segmentów",
      }),
    },
    {
      id: "pages",
      value: formatCount(contents.scopes.length, language),
      label: t("copy_desk.contents.pages", {
        count: contents.scopes.length,
        defaultValue: "stron",
      }),
    },
  ];

  // `min-h-0`: the desk puts a rail above the page, so the transition's own
  // full-viewport floor would make every short state scroll by its height.
  return (
    <PageTransition className="min-h-0">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-16 pt-6">
        <PageHeader
          title={t("copy_desk.contents.title", "Teksty")}
          titleHighlight={t("copy_desk.contents.title_highlight", "serwisu")}
          rightContent={
            contents.is_reviewer ? (
              <Button variant="secondary" size="sm" asChild>
                <Link to="/redakcja/przeglad">
                  {t("copy_desk.review.link", "Przegląd zmian")}
                </Link>
              </Button>
            ) : undefined
          }
        />

        {contents.scopes.length === 0 ? (
          <StatePanel
            icon={<Inbox size={22} aria-hidden="true" />}
            eyebrow={t("copy_desk.eyebrow", "Redakcja")}
            title={t("copy_desk.contents.empty_title", "Spis jest pusty")}
            description={t(
              "copy_desk.contents.empty_description",
              "Teksty serwisu jeszcze nie trafiły na desk. Korpus wchodzi tu osobnym krokiem, z repozytorium (copy:sync).",
            )}
          />
        ) : (
          <>
            <StatLine stats={census} />
            {/* Said once, because a page reporting 213 of something is
                otherwise a figure nobody can check: the desk counts rows, and
                one field of one page exists once per language. */}
            <Text size="sm" color="graphite">
              {t(
                "copy_desk.contents.segment_note",
                "Segment to jedno pole strony w jednym języku.",
              )}
            </Text>
            <ScopeContentsList scopes={contents.scopes} />
          </>
        )}
      </div>
    </PageTransition>
  );
}
