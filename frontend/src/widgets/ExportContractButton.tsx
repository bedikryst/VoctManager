/**
 * @file ExportContractButton.tsx
 * @description Triggers and polls asynchronous background tasks (Celery).
 * Provides real-time visual feedback during PDF/ZIP generation processes.
 * Refactored to strictly consume the core Button primitive for UI consistency.
 * @module shared/widgets/ExportContractButton
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useExportProject } from "@/shared/lib/hooks/useExportProject";
import { Download, AlertCircle } from "lucide-react";
import { Button } from "@/shared/ui/primitives/Button";

interface ExportContractButtonProps {
  projectId: string | number;
}

export const ExportContractButton = ({
  projectId,
}: ExportContractButtonProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { startExport, status, downloadUrl, error, reset } = useExportProject();

  const handleExport = () => {
    startExport(projectId);
  };

  return (
    <div className="relative flex items-center justify-center min-h-[40px]">
      <AnimatePresence mode="wait">
        {status === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
          >
            <Button variant="primary" onClick={handleExport}>
              {t("export.actions.generateZip")}
            </Button>
          </motion.div>
        )}

        {status === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            {/* Consuming the Button's native loading state architecture */}
            <Button variant="secondary" isLoading={true} disabled>
              {t("common.status.processingInBackground")}
            </Button>
          </motion.div>
        )}

        {status === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            <a
              href={downloadUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="outline-none"
            >
              {/* Note: We simulate a button visually but retain the native anchor behaviour */}
              <div className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase tracking-widest font-bold py-2.5 px-5 rounded-xl transition-colors shadow-sm">
                <Download size={14} aria-hidden="true" />
                {t("export.actions.downloadZip")}
              </div>
            </a>
            <Button variant="ghost" onClick={reset}>
              {t("common.actions.close")}
            </Button>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-red-600">
              <AlertCircle size={14} aria-hidden="true" />
              {error || t("common.errors.generic")}
            </span>
            <Button variant="danger" onClick={reset}>
              {t("common.actions.retry")}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
