import { ReactNode } from "react";

export type LoadErrorReason = "permission_denied" | "network" | "parse" | "unknown";

export type BlobFetchError = {
  response?: {
    status?: number;
  };
  message?: string;
};

export type PdfViewerEvent =
  | { type: "open"; docKey?: string | number }
  | { type: "load_success"; numPages: number }
  | { type: "load_error"; reason: LoadErrorReason; message?: string }
  | { type: "page_change"; from: number; to: number }
  | { type: "zoom_change"; from: number; to: number }
  | { type: "download"; fileName: string; succeeded: boolean }
  | { type: "share"; fileName: string; succeeded: boolean; cancelled: boolean }
  | { type: "open_in_browser" }
  | { type: "retry" };

export interface PdfViewerProps {
  fetchBlob: (() => Promise<Blob>) | null;
  docKey?: string | number;
  title: string;
  subtitle?: string;
  fileName?: string;
  onEvent?: (event: PdfViewerEvent) => void;
  toolbarSlot?: ReactNode;
  className?: string;
}
