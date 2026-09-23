/**
 * @file ActSheet.tsx
 * @description The one shell for a finance act that needs an answer first — a
 * payment date, a reason, the date on a signed paper. An act is immediate and
 * never queued, so while the device is offline the confirm is disabled and the
 * sheet says why, instead of letting the click fail. Everything else stays
 * live: the form validates on submit and puts each message on its field.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/components/ActSheet
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { useIsOnline } from "@/shared/lib/dom/useIsOnline";
import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption } from "@/shared/ui/primitives/typography";

interface ActSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly subtitle?: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly isPending: boolean;
  /** Undoing a settled fact: the confirm wears the destructive register. */
  readonly destructive?: boolean;
  readonly children: React.ReactNode;
}

export function ActSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  confirmLabel,
  onConfirm,
  isPending,
  destructive = false,
  children,
}: ActSheetProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const isOnline = useIsOnline();

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={isPending ? () => undefined : onClose}
      title={title}
      subtitle={subtitle}
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
            <Button variant="ghost" onClick={onClose} disabled={isPending}>
              {t("common.actions.cancel", "Anuluj")}
            </Button>
            <Button
              variant={destructive ? "destructive" : "primary"}
              onClick={onConfirm}
              isLoading={isPending}
              disabled={!isOnline}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-1">{children}</div>
    </BottomSheet>
  );
}
