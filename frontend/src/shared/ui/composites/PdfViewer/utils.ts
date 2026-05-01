import { LoadErrorReason, BlobFetchError } from "./types";

export const clampValue = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const sanitizeFileName = (value: string): string =>
  value.replace(/[\\/:*?"<>|]+/g, "_").trim();

export const buildPdfFileName = (title: string, fileName?: string): string => {
  const baseName = sanitizeFileName(fileName?.trim() || title.trim() || "document");
  return baseName.toLowerCase().endsWith(".pdf") ? baseName : `${baseName}.pdf`;
};

export const classifyLoadError = (error: unknown): LoadErrorReason => {
  const blobError = error as BlobFetchError | undefined;
  const status = blobError?.response?.status;

  if (status === 401 || status === 403) {
    return "permission_denied";
  }
  if (typeof status === "number" && status >= 400) {
    return "network";
  }
  if (error instanceof Error && /pdf|parse|invalid|password/i.test(error.message)) {
    return "parse";
  }
  if (error instanceof Error && /network|fetch|timeout/i.test(error.message)) {
    return "network";
  }
  return "unknown";
};

export const createDownloadAnchor = (blob: Blob, targetFileName: string): void => {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = downloadUrl;
  anchor.download = targetFileName;
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 0);
};
