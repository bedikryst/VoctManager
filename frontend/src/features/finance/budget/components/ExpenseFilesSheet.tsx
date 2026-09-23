/**
 * @file ExpenseFilesSheet.tsx
 * @description The files kept with one expense — the vendor's invoice, a
 * photographed receipt. Adding and removing are acts that answer with the
 * budget; removing asks first, because the trash sits beside the download. A
 * file is a PDF or a photo of a document; the server
 * reads the type from the file itself and refuses anything else. There is no
 * public link to any of them: a download streams through the manager-only view.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/ExpenseFilesSheet
 */

import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FileDown, Paperclip, Trash2, Upload } from "lucide-react";

import { useIsOnline } from "@/shared/lib/dom/useIsOnline";
import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { useDeleteAttachment, useUploadAttachment } from "../../api/finance.queries";
import { FinanceService } from "../../api/finance.service";
import { toastFinanceError } from "../../lib/financeErrors";
import { formatFinanceDate } from "../../lib/financePresentation";
import type { AttachmentDTO, ExpenseRowDTO } from "../../types/finance.dto";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";

const KILOBYTE = 1024;

const formatSize = (bytes: number): string =>
  bytes < KILOBYTE * KILOBYTE
    ? `${Math.max(1, Math.round(bytes / KILOBYTE))} KB`
    : `${(bytes / (KILOBYTE * KILOBYTE)).toFixed(1).replace(".", ",")} MB`;

interface ExpenseFilesSheetProps {
  readonly projectId: string;
  readonly expense: ExpenseRowDTO;
  /** A closed budget keeps its files but takes no new ones. */
  readonly writable: boolean;
  readonly onClose: () => void;
}

export function ExpenseFilesSheet({
  projectId,
  expense,
  writable,
  onClose,
}: ExpenseFilesSheetProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const isOnline = useIsOnline();
  const upload = useUploadAttachment(projectId);
  const remove = useDeleteAttachment(projectId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingRemoval, setPendingRemoval] = useState<AttachmentDTO | null>(null);
  const canWrite = writable && isOnline;

  const handleFile = (file: File | undefined): void => {
    if (!file) return;
    upload.mutate(
      { costItemId: expense.id, file },
      {
        onSuccess: () => toast.success(t("finance.files.added", "Dodano plik {{name}}.", { name: file.name })),
        onError: (error) =>
          toastFinanceError(error, t, t("finance.files.add_error", "Nie udało się dodać pliku.")),
      },
    );
  };

  const download = (attachmentId: string, name: string): void => {
    void FinanceService.downloadAttachment(attachmentId, name).catch((error: unknown) =>
      toastFinanceError(error, t, t("finance.download.error", "Nie udało się pobrać dokumentu.")),
    );
  };

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      title={t("finance.files.title", "Pliki wydatku")}
      subtitle={expense.vendor_name}
      footer={
        <div className="flex flex-col gap-2">
          {!isOnline && (
            <Caption color="gold">
              {t(
                "finance.offline.act",
                "Brak połączenia. Rozliczeń nie zapisuje się offline — wróć do sieci, aby to zrobić.",
              )}
            </Caption>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t("common.actions.close", "Zamknij")}
            </Button>
            {writable && (
              <Button
                variant="primary"
                onClick={() => inputRef.current?.click()}
                isLoading={upload.isPending}
                disabled={!canWrite}
                leftIcon={<Upload size={14} aria-hidden="true" />}
              >
                {t("finance.files.add", "Dodaj plik")}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <div className="flex flex-col gap-3 pt-1">
        {expense.attachments.length === 0 ? (
          <StatePanel
            variant="inline"
            className="py-6"
            icon={<Paperclip size={22} strokeWidth={1.5} />}
            title={t("finance.files.empty", "Brak plików")}
            description={t(
              "finance.files.empty_desc",
              "Dołącz fakturę albo zdjęcie paragonu — PDF lub zdjęcie, do 20 MB.",
            )}
          />
        ) : (
          <ul className="divide-y divide-hairline rounded-nested border border-hairline">
            {expense.attachments.map((attachment) => (
              <li key={attachment.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <Text as="span" size="sm" weight="medium" truncate>
                    {attachment.original_name}
                  </Text>
                  <Caption as="span" color="muted">
                    {`${formatSize(attachment.size_bytes)} · ${formatFinanceDate(
                      attachment.uploaded_at.slice(0, 10),
                      i18n.language,
                    )}`}
                  </Caption>
                </span>
                <Button
                  variant="icon"
                  size="icon"
                  onClick={() => download(attachment.id, attachment.original_name)}
                  aria-label={t("finance.files.download_aria", "Pobierz {{name}}", {
                    name: attachment.original_name,
                  })}
                >
                  <FileDown size={16} aria-hidden="true" />
                </Button>
                {writable && (
                  <Button
                    variant="icon"
                    size="icon"
                    disabled={!canWrite || remove.isPending}
                    onClick={() => setPendingRemoval(attachment)}
                    aria-label={t("finance.files.remove_aria", "Usuń {{name}}", {
                      name: attachment.original_name,
                    })}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmModal
        isOpen={pendingRemoval !== null}
        isDestructive
        title={t("finance.files.remove_title", "Usunąć plik?")}
        description={t(
          "finance.files.remove_desc",
          "{{name}} zniknie z wydatku. Usunięcie zostaje w historii budżetu.",
          { name: pendingRemoval?.original_name ?? "" },
        )}
        confirmText={t("finance.files.remove_confirm", "Usuń plik")}
        isLoading={remove.isPending}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (!pendingRemoval) return;
          remove.mutate(pendingRemoval.id, {
            onSuccess: () => {
              toast.success(t("finance.files.removed", "Usunięto plik."));
              setPendingRemoval(null);
            },
            onError: (error) =>
              toastFinanceError(error, t, t("finance.files.remove_error", "Nie udało się usunąć pliku.")),
          });
        }}
      />
    </BottomSheet>
  );
}
