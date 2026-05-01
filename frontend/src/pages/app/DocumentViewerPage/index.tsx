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
  <div className="fixed inset-0 z-0 flex items-center justify-center bg-[#111015] px-6 text-ethereal-marble">
    <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] px-6 py-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-ethereal-crimson/80">
        <FileWarning size={28} aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <Heading as="h1" size="lg" className="text-ethereal-marble text-balance">
          {title}
        </Heading>
        <Text color="parchment-muted" className="text-balance">
          {description}
        </Text>
      </div>
      <Button variant="secondary" onClick={onBack} className="mt-1">
        {backLabel}
      </Button>
    </div>
  </div>
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
    <div className="fixed inset-0 z-0 flex flex-col bg-[#111015] text-ethereal-marble">
      <header className="relative z-10 flex items-center gap-3 border-b border-white/10 bg-black/30 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.875rem)] backdrop-blur-xl sm:px-6 sm:pb-4 sm:pt-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          aria-label={
            canGoBack
              ? t("document_viewer.back_aria", "Go back")
              : t("document_viewer.back_to_app", "Back to dashboard")
          }
          className="h-11 w-11 shrink-0 rounded-2xl text-ethereal-marble hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Button>

        <div className="min-w-0 flex-1">
          <Heading
            as="h1"
            size="lg"
            className="truncate text-ethereal-marble sm:text-[1.375rem]"
          >
            {resolved.title}
          </Heading>
          {resolved.subtitle ? (
            <Text color="parchment-muted" className="mt-1 line-clamp-2">
              {resolved.subtitle}
            </Text>
          ) : null}
        </div>
      </header>

      <PdfViewer
        fetchBlob={resolved.fetchBlob}
        docKey={docKey}
        title={resolved.title}
        subtitle={resolved.subtitle}
        fileName={resolved.fileName}
        className="flex-1"
      />
    </div>
  );
};

export default DocumentViewerPage;
