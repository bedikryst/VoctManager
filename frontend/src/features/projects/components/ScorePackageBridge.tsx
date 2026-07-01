/**
 * @file ScorePackageBridge.tsx
 * @description Thin status bridge for the Program tab. The score-book cockpit now
 * lives in its own "Partytura" work area, so the Program tab keeps only a compact,
 * glanceable status of the book plus a deep-link to go build it — the adjacency is
 * preserved without burying a heavy cockpit beneath the setlist editor.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/ScorePackageBridge
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen } from "lucide-react";

import { WidgetCard } from "@/shared/ui/composites/WidgetCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption } from "@/shared/ui/primitives/typography";

import { useScorePackageState } from "../api/project.score-package";

interface ScorePackageBridgeProps {
  projectId: string;
}

type StatusTone = "success" | "warning" | "neutral";

export function ScorePackageBridge({
  projectId,
}: ScorePackageBridgeProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: state } = useScorePackageState(projectId);

  const building = state?.status === "QUED" || state?.status === "BLDG";

  const status: { label: string; tone: StatusTone } = (() => {
    if (!state || (!state.has_pdf && !building)) {
      return {
        label: t("projects.score_package.bridge.none", "Nie złożona"),
        tone: "neutral",
      };
    }
    if (building) {
      return {
        label: t("projects.score_package.building", "Składanie…"),
        tone: "warning",
      };
    }
    if (state.is_manual_upload) {
      return {
        label: t("projects.score_package.manual.badge", "Wgrana ręcznie"),
        tone: "neutral",
      };
    }
    if (state.is_stale) {
      return {
        label: t("projects.score_package.stale", "Program zmieniony"),
        tone: "warning",
      };
    }
    return {
      label: t("projects.score_package.ready", "Gotowa"),
      tone: "success",
    };
  })();

  return (
    <WidgetCard
      title={t("projects.score_package.title", "Partytura koncertowa")}
      icon={<BookOpen size={15} aria-hidden="true" />}
      bodyClassName="flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2">
        <Badge variant={status.tone}>{status.label}</Badge>
        {state && !state.is_manual_upload && state.has_pdf && (
          <Caption color="muted">
            {t("projects.score_package.bridge.version", "Wersja {{v}}", {
              v: state.build_version,
            })}
          </Caption>
        )}
      </div>
      <Button asChild variant="secondary" size="sm">
        <Link
          to={`/panel/projects/${projectId}/partytura`}
          className="inline-flex items-center gap-1.5"
        >
          {t("projects.score_package.bridge.open", "Otwórz generator")}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </Button>
    </WidgetCard>
  );
}
