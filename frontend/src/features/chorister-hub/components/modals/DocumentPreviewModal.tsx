// chorister-hub/components/modals/DocumentPreviewModal.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  FileWarning,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { GlassCard } from '@/shared/ui/composites/GlassCard';
import { Button } from '@/shared/ui/primitives/Button';
import { Heading, Text, Caption } from '@/shared/ui/primitives/typography';
import { EtherealLoader } from '@/shared/ui/kinematics/EtherealLoader';
import { ChoristerHubService } from '../../api/chorister-hub.service';
import type { DocumentFileDTO } from '../../types/chorister-hub.dto';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type PreviewStatus = 'idle' | 'loading' | 'success' | 'error';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

interface DocumentPreviewModalProps {
  isOpen: boolean;
  previewDocument: DocumentFileDTO | null;
  onClose: () => void;
}

export const DocumentPreviewModal = ({
  isOpen,
  previewDocument,
  onClose,
}: DocumentPreviewModalProps): React.JSX.Element => {
  const { t } = useTranslation();

  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const blobUrlRef = useRef<string | null>(null);
  const isPdf = previewDocument?.mime_type === 'application/pdf';

  // Fetch PDF blob when modal opens with a PDF document
  useEffect(() => {
    if (!isOpen || !previewDocument || !isPdf) return;

    let mounted = true;

    setStatus('loading');
    setNumPages(null);
    setCurrentPage(1);
    setScale(1.0);
    setErrorMsg(null);

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setBlobUrl(null);
    }

    ChoristerHubService.fetchDocumentBlob(previewDocument.id)
      .then((blob) => {
        if (!mounted) return;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setStatus('success');
      })
      .catch((err: { response?: { status?: number } }) => {
        if (!mounted) return;
        setErrorMsg(
          err?.response?.status === 403
            ? t(
                'chorister_hub.modal.preview.error_403',
                'You do not have permission to view this document.',
              )
            : t(
                'chorister_hub.modal.preview.error_generic',
                'The document could not be loaded.',
              ),
        );
        setStatus('error');
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, previewDocument?.id, isPdf, t]);

  // Safety net: revoke blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const handleClose = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setBlobUrl(null);
    }
    setStatus('idle');
    setNumPages(null);
    setCurrentPage(1);
    setScale(1.0);
    onClose();
  }, [onClose]);

  const handleDownload = useCallback(() => {
    if (!previewDocument) return;

    if (blobUrlRef.current) {
      const a = window.document.createElement('a');
      a.href = blobUrlRef.current;
      a.download = previewDocument.title;
      a.click();
    } else {
      ChoristerHubService.fetchDocumentBlob(previewDocument.id).then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = previewDocument.title;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }, [previewDocument]);

  const handleDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total);
    },
    [],
  );

  const mimeLabel =
    previewDocument?.mime_type.split('/')[1]?.toUpperCase() ?? 'FILE';

  return (
    <AnimatePresence>
      {isOpen && previewDocument && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-focus-trap flex items-center justify-center p-4 bg-ethereal-ink/40 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-4xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <GlassCard
              variant="ethereal"
              padding="none"
              className="shadow-glass-ethereal flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-ethereal-incense/15 shrink-0">
                <div className="min-w-0 flex-1 pr-4">
                  <Heading size="xl" className="tracking-tight truncate">
                    {previewDocument.title}
                  </Heading>
                  <Caption color="muted" className="block mt-0.5">
                    {mimeLabel} · {formatBytes(previewDocument.file_size_bytes)}
                  </Caption>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  aria-label={t('common.close_aria', 'Close')}
                >
                  <X size={18} aria-hidden="true" />
                </Button>
              </div>

              {/* Content area */}
              <div className="flex-1 overflow-auto min-h-0 flex items-start justify-center bg-ethereal-alabaster/50 p-6">
                {!isPdf ? (
                  <div className="flex flex-col items-center gap-4 py-16">
                    <FileWarning
                      size={40}
                      className="text-ethereal-graphite/30"
                      aria-hidden="true"
                    />
                    <Text color="muted">
                      {t(
                        'chorister_hub.modal.preview.non_pdf',
                        'Preview is only available for PDF files.',
                      )}
                    </Text>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Download size={14} aria-hidden="true" />}
                      onClick={handleDownload}
                    >
                      {t('chorister_hub.modal.preview.download', 'Download')}
                    </Button>
                  </div>
                ) : status === 'loading' ? (
                  <div className="flex items-center justify-center py-16 w-full">
                    <EtherealLoader />
                  </div>
                ) : status === 'error' ? (
                  <div className="flex flex-col items-center gap-3 py-16">
                    <FileWarning
                      size={40}
                      className="text-ethereal-crimson/40"
                      aria-hidden="true"
                    />
                    <Text color="muted">{errorMsg}</Text>
                  </div>
                ) : blobUrl ? (
                  <Document
                    file={blobUrl}
                    onLoadSuccess={handleDocumentLoadSuccess}
                    loading={
                      <div className="flex items-center justify-center py-16 w-full">
                        <EtherealLoader />
                      </div>
                    }
                    className="flex flex-col items-center gap-4"
                  >
                    <Page
                      pageNumber={currentPage}
                      scale={scale}
                      loading={
                        <div className="flex items-center justify-center py-8">
                          <EtherealLoader />
                        </div>
                      }
                      className="shadow-glass-solid rounded-lg overflow-hidden"
                    />
                  </Document>
                ) : null}
              </div>

              {/* Footer toolbar — shown only for PDFs that loaded successfully */}
              {isPdf && status === 'success' && numPages !== null && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-ethereal-incense/15 bg-ethereal-alabaster/60 shrink-0 gap-4">
                  {/* Pagination */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      aria-label={t(
                        'chorister_hub.modal.preview.prev_page',
                        'Previous page',
                      )}
                    >
                      <ChevronLeft size={16} aria-hidden="true" />
                    </Button>
                    <Caption
                      color="muted"
                      className="tabular-nums whitespace-nowrap px-2"
                    >
                      {t(
                        'chorister_hub.modal.preview.page_of',
                        '{{current}} / {{total}}',
                        { current: currentPage, total: numPages },
                      )}
                    </Caption>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(numPages, p + 1))
                      }
                      disabled={currentPage >= numPages}
                      aria-label={t(
                        'chorister_hub.modal.preview.next_page',
                        'Next page',
                      )}
                    >
                      <ChevronRight size={16} aria-hidden="true" />
                    </Button>
                  </div>

                  {/* Zoom */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))
                      }
                      disabled={scale <= 0.5}
                      aria-label={t(
                        'chorister_hub.modal.preview.zoom_out',
                        'Zoom out',
                      )}
                    >
                      <ZoomOut size={16} aria-hidden="true" />
                    </Button>
                    <Caption
                      color="muted"
                      className="tabular-nums w-12 text-center"
                    >
                      {Math.round(scale * 100)}%
                    </Caption>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setScale((s) => Math.min(3.0, +(s + 0.25).toFixed(2)))
                      }
                      disabled={scale >= 3.0}
                      aria-label={t(
                        'chorister_hub.modal.preview.zoom_in',
                        'Zoom in',
                      )}
                    >
                      <ZoomIn size={16} aria-hidden="true" />
                    </Button>
                  </div>

                  {/* Download */}
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Download size={14} aria-hidden="true" />}
                    onClick={handleDownload}
                  >
                    {t('chorister_hub.modal.preview.download', 'Download')}
                  </Button>
                </div>
              )}
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
