// chorister-hub/components/modals/DocumentPreviewModal.tsx
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, FileWarning } from 'lucide-react';

import { PdfViewerModal } from '@/shared/ui/composites/PdfViewerModal';
import { Button } from '@/shared/ui/primitives/Button';
import { Text } from '@/shared/ui/primitives/typography';
import { GlassCard } from '@/shared/ui/composites/GlassCard';
import { ChoristerHubService } from '../../api/chorister-hub.service';
import type { DocumentFileDTO } from '../../types/chorister-hub.dto';

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
  const isPdf = previewDocument?.mime_type === 'application/pdf';

  const fetchBlob = useCallback((): Promise<Blob> => {
    return ChoristerHubService.fetchDocumentBlob(previewDocument!.id);
    // Stable while previewDocument.id stays the same; docKey handles the refetch trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewDocument?.id]);

  const subtitle = previewDocument
    ? `${previewDocument.mime_type.split('/')[1]?.toUpperCase() ?? 'FILE'} · ${formatBytes(previewDocument.file_size_bytes)}`
    : undefined;

  // For non-PDF files show a minimal download-only modal.
  if (isOpen && previewDocument && !isPdf) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-focus-trap flex items-center justify-center p-4 bg-ethereal-ink/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <GlassCard
              variant="ethereal"
              padding="lg"
              className="shadow-glass-ethereal text-center"
            >
              <FileWarning
                size={36}
                className="mx-auto text-ethereal-graphite/30 mb-3"
                aria-hidden="true"
              />
              <Text weight="semibold" className="text-ethereal-ink mb-1 block">
                {previewDocument.title}
              </Text>
              <Text size="sm" color="muted" className="mb-5 block">
                {t(
                  'chorister_hub.modal.preview.non_pdf',
                  'Preview is only available for PDF files.',
                )}
              </Text>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Download size={14} aria-hidden="true" />}
                onClick={() => {
                  window.open(previewDocument.file_url, '_blank', 'noopener,noreferrer');
                  onClose();
                }}
              >
                {t('pdf_viewer.download', 'Download')}
              </Button>
            </GlassCard>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <PdfViewerModal
      isOpen={isOpen && !!isPdf}
      title={previewDocument?.title ?? ''}
      subtitle={subtitle}
      fileName={previewDocument?.title}
      fetchBlob={previewDocument ? fetchBlob : null}
      docKey={previewDocument?.id}
      onClose={onClose}
    />
  );
};
