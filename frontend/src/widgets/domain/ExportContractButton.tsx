/**
 * @file ExportContractButton.tsx
 * @description Domain widget for background ZIP export orchestration.
 * Keeps asynchronous contract-package generation aligned with shared button patterns.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import { useTranslation } from "react-i18next";
import { AlertCircle, Download, Sparkles } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { INK } from "@/shared/ui/kinematics/motion-presets";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { useExportProject } from "@/features/contracts/hooks/useExportProject";

/**
 * A status swap, not a surface entrance, so the ink register's own duration is
 * the wrong unit: `mode="wait"` runs the halves in series and would bill one
 * click for both. The departure is the half nobody reads and is cut short; the
 * arrival keeps the law's half-ink start, so no state opens from a hole.
 *
 * Neither half travels. Four `y`/`scale`/`x` offsets promote a button that is
 * only relabelling itself to its own composited layer, which is the cost the
 * register exists to refuse.
 */
const STATE_EXIT: Transition = { duration: 0.12, ease: INK.ease };
const STATE_ENTER: Transition = { duration: 0.26, ease: INK.ease };

const stateSwap = {
  initial: { opacity: INK.half },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: STATE_EXIT },
  transition: STATE_ENTER,
};

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
          <motion.div key="idle" {...stateSwap} className="w-full">
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
          <motion.div key="processing" {...stateSwap} className="w-full">
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
            {...stateSwap}
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
            {...stateSwap}
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
