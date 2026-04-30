/**
 * @file ExportContractButton.tsx
 * @description Domain widget for background ZIP export orchestration.
 * Keeps asynchronous contract-package generation aligned with shared button patterns.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { AlertCircle, Download, Sparkles } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { BASE_TRANSITION } from "@/shared/ui/kinematics/motion-presets";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { useExportProject } from "@/features/contracts/hooks/useExportProject";

interface ExportContractButtonProps {
  projectId: string | number;
  className?: string;
}

export const ExportContractButton = ({
  projectId,
  className,
}: ExportContractButtonProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { startExport, status, downloadUrl, error, reset } = useExportProject();

  const handleExport = (): void => {
    void startExport(projectId);
  };

  return (
    <div className={cn("w-full", className)}>
      <AnimatePresence mode="wait" initial={false}>
        {status === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={BASE_TRANSITION}
            className="w-full"
          >
            <Button
              variant="primary"
              fullWidth
              onClick={handleExport}
              leftIcon={<Download size={14} aria-hidden="true" />}
            >
              {t("export.actions.generateZip", "Generate ZIP package")}
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
            className="w-full"
          >
            <div className="flex w-full flex-col gap-3">
              <Badge variant="glass" icon={<Sparkles size={12} />}>
                {t(
                  "common.status.processingInBackground",
                  "Processing in background",
                )}
              </Badge>
              <Button variant="secondary" fullWidth isLoading={true} disabled>
                {t("export.actions.generatingZip", "Preparing contract package")}
              </Button>
            </div>
          </motion.div>
        )}

        {status === "success" && downloadUrl && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={BASE_TRANSITION}
            className="flex w-full flex-col gap-3"
          >
            <Badge variant="success" icon={<Sparkles size={12} />}>
              {t("export.status.ready", "Package ready")}
            </Badge>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                variant="primary"
                fullWidth
                leftIcon={<Download size={14} aria-hidden="true" />}
              >
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                  {t("export.actions.downloadZip", "Download ZIP")}
                </a>
              </Button>

              <Button variant="ghost" onClick={reset}>
                {t("common.actions.close", "Close")}
              </Button>
            </div>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={BASE_TRANSITION}
            className="flex w-full flex-col gap-3"
          >
            <div className="rounded-[1.25rem] border border-ethereal-crimson/15 bg-ethereal-crimson/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-ethereal-crimson">
                <AlertCircle size={14} aria-hidden="true" />
                <Badge variant="danger">
                  {t("common.errors.generic", "Error")}
                </Badge>
              </div>
              <Text size="xs" color="crimson">
                {error || t("common.errors.generic", "Something went wrong.")}
              </Text>
            </div>

            <Button
              variant="destructive"
              onClick={reset}
              leftIcon={<AlertCircle size={14} aria-hidden="true" />}
            >
              {t("common.actions.retry", "Retry")}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
