/**
 * @file DocumentViewerPage/index.tsx
 * @description Deep-linkable, full-viewport document viewer route. Resolves a typed
 * `:docType` + `:docId` URL pair to a domain-specific blob fetcher, then renders the
 * shared headless PdfViewer primitive in a fullscreen frame with a slim header
 * (back navigation + title). Display metadata is hinted through `location.state`
 * for in-app navigations and falls back to localized per-type copy on deep-links.
 * @architecture Enterprise SaaS 2026
 * @module pages/app/DocumentViewerPage
 */

import React, { useCallback, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileWarning } from "lucide-react";
import type { TFunction } from "i18next";

import { Button } from "@/shared/ui/primitives/Button";
import { Heading, Text } from "@/shared/ui/primitives/typography";
import { PdfViewer } from "@/shared/ui/composites/PdfViewer";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { ProjectService } from "@/features/projects/api/project.service";
import { ScheduleService } from "@/features/schedule/api/schedule.service";
import { ChoristerHubService } from "@/features/chorister-hub/api/chorister-hub.service";

import {
  isDocumentDisplayHint,
  type DocumentDisplayHint,
  type DocumentType,
} from "./types";

const KNOWN_DOCUMENT_TYPES: readonly DocumentType[] = [
  "project-score",
  "project-call-sheet",
  "chorister-hub",
] as const;

const isKnownDocumentType = (value: string | undefined): value is DocumentType =>
  typeof value === "string" &&
  (KNOWN_DOCUMENT_TYPES as readonly string[]).includes(value);

interface ResolvedDocument {
  title: string;
  subtitle?: string;
  fileName: string;
  fetchBlob: () => Promise<Blob>;
}

const sanitizeForFileName = (value: string): string =>
  value.replace(/[\\/:*?"<>|]+/g, "_").trim();

const resolveDocument = (
  type: DocumentType,
  id: string,
  hint: DocumentDisplayHint | undefined,
  t: TFunction,
): ResolvedDocument => {
  const idSegment = sanitizeForFileName(id);

  switch (type) {
    case "project-score":
      return {
        title:
          hint?.title ??
          t(
            "document_viewer.fallback.project_score_title",
            "Concert Score",
          ),
        subtitle: hint?.subtitle,
        fileName: hint?.fileName ?? `Score_${idSegment}.pdf`,
        fetchBlob: () => ProjectService.fetchScorePdfBlob(id),
      };
    case "project-call-sheet":
      return {
        title:
          hint?.title ??
          t(
            "document_viewer.fallback.project_call_sheet_title",
            "Call Sheet",
          ),
        subtitle: hint?.subtitle,
        fileName: hint?.fileName ?? `CallSheet_${idSegment}.pdf`,
        fetchBlob: () => ScheduleService.exportCallSheet(id),
      };
    case "chorister-hub":
      return {
        title:
          hint?.title ??
          t(
            "document_viewer.fallback.chorister_hub_title",
            "Document",
          ),
        subtitle: hint?.subtitle,
        fileName: hint?.fileName ?? `${idSegment}.pdf`,
        fetchBlob: () => ChoristerHubService.fetchDocumentBlob(id),
      };
  }
};

interface DocumentViewerErrorStateProps {
  title: string;
  description: string;
  onBack: () => void;
  backLabel: string;
}

const DocumentViewerErrorState = ({
  title,
  description,
  onBack,
  backLabel,
}: DocumentViewerErrorStateProps): React.JSX.Element => (
  <PageTransition>
    <div className="fixed inset-0 z-0 flex items-center justify-center bg-ethereal-ink px-6">
      <StatePanel
        tone="danger"
        icon={<FileWarning size={28} aria-hidden="true" />}
        title={title}
        description={description}
        actions={
          <Button variant="secondary" onClick={onBack}>
            {backLabel}
          </Button>
        }
        className="w-full max-w-md shadow-glass-ethereal"
      />
    </div>
  </PageTransition>
);

const DocumentViewerPage = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { docType, docId } = useParams<{ docType: string; docId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const hint = useMemo(
    () => (isDocumentDisplayHint(location.state) ? location.state : undefined),
    [location.state],
  );

  const decodedId = useMemo(() => {
    if (!docId) {
      return null;
    }
    try {
      return decodeURIComponent(docId);
    } catch {
      return null;
    }
  }, [docId]);

  const resolved = useMemo<ResolvedDocument | null>(() => {
    if (!isKnownDocumentType(docType) || !decodedId) {
      return null;
    }
    return resolveDocument(docType, decodedId, hint, t);
  }, [decodedId, docType, hint, t]);

  const canGoBack = location.key !== "default";

  const handleBack = useCallback(() => {
    if (canGoBack) {
      navigate(-1);
    } else {
      navigate("/panel");
    }
  }, [canGoBack, navigate]);

  if (!resolved) {
    return (
      <DocumentViewerErrorState
        title={t(
          "document_viewer.invalid_title",
          "Unsupported document",
        )}
        description={t(
          "document_viewer.invalid_description",
          "We could not recognize this document link. It may be malformed or out of date.",
        )}
        onBack={handleBack}
        backLabel={t("document_viewer.back_to_app", "Back to dashboard")}
      />
    );
  }

  const docKey = `${docType}/${decodedId}`;

  return (
    <PageTransition>
      <div className="fixed inset-0 z-0 flex flex-col bg-ethereal-ink text-ethereal-marble">
        <div className="relative z-10 flex shrink-0 items-center gap-4 border-b border-white/5 bg-white/[0.02] px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl sm:px-6 sm:py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            aria-label={
              canGoBack
                ? t("document_viewer.back_aria", "Go back")
                : t("document_viewer.back_to_app", "Back to dashboard")
            }
            className="h-9 w-9 shrink-0 rounded-full text-ethereal-marble hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </Button>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
            <Heading
              as="h1"
              size="sm"
              className="truncate text-ethereal-marble"
            >
              {resolved.title}
            </Heading>
            {resolved.subtitle ? (
              <Text color="parchment-muted" className="truncate text-xs">
                {resolved.subtitle}
              </Text>
            ) : null}
          </div>
        </div>

        <PdfViewer
          fetchBlob={resolved.fetchBlob}
          docKey={docKey}
          title={resolved.title}
          subtitle={resolved.subtitle}
          fileName={resolved.fileName}
          className="flex-1"
        />
      </div>
    </PageTransition>
  );
};
export default DocumentViewerPage;
