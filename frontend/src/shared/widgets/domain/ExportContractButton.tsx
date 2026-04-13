/**
 * @file ExportContractButton.tsx
 * @description Domain-specific widget for asynchronous background tasks (Celery).
 * Provides real-time visual feedback for PDF/ZIP generation in Ethereal UI style.
 * @module shared/widgets/domain/ExportContractButton
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Download, AlertCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { useExportProject } from "@/features/contracts/hooks/useExportProject";
import { Button } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/lib/utils";
import { BASE_TRANSITION } from "@/shared/ui/kinematics/motion-presets";

const exportContainerVariants = cva(
  "relative flex items-center justify-center min-h-[40px] transition-all duration-500",
  {
    variants: {
      status: {
        idle: "opacity-100",
        processing: "scale-105",
        success: "gap-4",
        error: "gap-3 border-red-100/20",
      },
    },
    defaultVariants: {
      status: "idle",
    },
  },
);

interface ExportContractButtonProps extends VariantProps<
  typeof exportContainerVariants
> {
  projectId: string | number;
}

export const ExportContractButton = ({
  projectId,
}: ExportContractButtonProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { startExport, status, downloadUrl, error, reset } = useExportProject();

  const handleExport = (): void => {
    startExport(projectId);
  };

  return (
    <div className={cn(exportContainerVariants({ status }))}>
      <AnimatePresence mode="wait">
        {status === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={BASE_TRANSITION}
          >
            <Button variant="primary" onClick={handleExport}>
              {t("export.actions.generateZip")}
            </Button>
          </motion.div>
        )}

        {status === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={BASE_TRANSITION}
          >
            <Button
              variant="secondary"
              isLoading={true}
              disabled
              aria-busy="true"
            >
              {t("common.status.processingInBackground")}
            </Button>
          </motion.div>
        )}

        {status === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={BASE_TRANSITION}
            className="flex items-center gap-4"
          >
            <a
              href={downloadUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="outline-none"
              aria-label={t("export.aria.downloadReadyFile")}
            >
              <div className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase tracking-widest font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm active:scale-95">
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
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={BASE_TRANSITION}
            className="flex items-center gap-3"
          >
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-red-600 animate-pulse">
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
