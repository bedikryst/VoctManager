/**
 * @file ScoreCompilerPage.tsx
 * @description Manager-only entry point for the Score Package Compiler.
 * Wraps the upload zone, the live status list, and the conductor review modal
 * into a single bento-grid surface. Default-exported because React.lazy in
 * the panel router consumes default modules.
 * @architecture Enterprise SaaS 2026
 * @module features/score-compiler/ScoreCompilerPage
 */

import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";

import { EditionStatusList } from "./components/EditionStatusList";
import { EditionUploadZone } from "./components/EditionUploadZone";
import { ConductorReviewModal } from "./components/modals/ConductorReviewModal";

export default function ScoreCompilerPage(): React.JSX.Element {
  const { t } = useTranslation();
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const handleReview = useCallback((id: string): void => {
    setReviewingId(id);
  }, []);

  const handleCloseModal = useCallback((): void => {
    setReviewingId(null);
  }, []);

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl space-y-8 px-4 pb-24 md:px-6">
        <div className="pt-6">
          <PageHeader
            size="standard"
            roleText={t(
              "score_compiler.page.badge",
              "AI-driven repertoire ingestion",
            )}
            title={t("score_compiler.page.title", "Score Package")}
            titleHighlight={t(
              "score_compiler.page.title_highlight",
              "Compiler.",
            )}
          />
        </div>

        <StaggeredBentoContainer className="flex flex-col gap-6">
          <StaggeredBentoItem>
            <EditionUploadZone />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <EditionStatusList onReview={handleReview} />
          </StaggeredBentoItem>
        </StaggeredBentoContainer>
      </div>

      <ConductorReviewModal
        editionId={reviewingId}
        onClose={handleCloseModal}
      />
    </PageTransition>
  );
}
