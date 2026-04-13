/**
 * @file PrivacyTab.tsx
 * @description Tab for GDPR compliance handling (Data Portability and Account Erasure).
 * Enforces Zero Trust re-authentication before permitting destructive actions.
 * @module features/settings/components
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert, Download, Trash2, FileJson } from "lucide-react";
import axios from "axios";

import { GlassCard } from "@ui/composites/GlassCard";
import { Button } from "@ui/primitives/Button";
import { Input } from "@ui/primitives/Input";
import { ConfirmModal } from "@ui/composites/ConfirmModal";
import { useExportData, useDeleteAccount } from "../api/settings.queries";
import type { ApiErrorResponse } from "../types/settings.dto";

export default function PrivacyTab() {
  const { t } = useTranslation();

  const { mutate: exportData, isPending: isExporting } = useExportData();
  const { mutate: deleteAccount, isPending: isDeleting } = useDeleteAccount();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleExport = () => {
    exportData();
  };

  const handleDeleteConfirm = () => {
    setErrorCode(null);
    deleteAccount(
      { password: deletePassword },
      {
        onError: (error: unknown) => {
          if (axios.isAxiosError<ApiErrorResponse>(error)) {
            setErrorCode(error.response?.data?.error_code || "unknown_error");
          } else {
            setErrorCode("unknown_error");
          }
        },
      },
    );
  };

  const handleCloseModal = () => {
    setIsDeleteModalOpen(false);
    setDeletePassword("");
    setErrorCode(null);
  };

  return (
    <>
      <GlassCard>
        <div className="mb-8">
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-brand" />
            {t("settings.privacy.title", "Prywatność i dane (RODO)")}
          </h2>
          <p className="text-sm text-stone-500 mt-1">
            {t(
              "settings.privacy.subtitle",
              "Zarządzaj swoimi danymi osobowymi oraz uprawnieniami do konta.",
            )}
          </p>
        </div>

        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl bg-white/40 border border-stone-200/50">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-stone-800 uppercase tracking-wider flex items-center gap-2">
                <FileJson className="w-4 h-4 text-stone-500" />
                {t("settings.privacy.exportTitle", "Eksport danych")}
              </h3>
              <p className="text-xs text-stone-500 max-w-md leading-relaxed">
                {t(
                  "settings.privacy.exportDesc",
                  "Pobierz kopię wszystkich danych przypisanych do Twojego konta w maszynowo czytelnym formacie JSON.",
                )}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleExport}
              isLoading={isExporting}
              leftIcon={<Download className="w-4 h-4" />}
            >
              {t("common.actions.download", "Pobierz")}
            </Button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl bg-red-50/50 border border-red-100">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-red-800 uppercase tracking-wider flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-500" />
                {t("settings.privacy.deleteTitle", "Usuń konto")}
              </h3>
              <p className="text-xs text-red-600/80 max-w-md leading-relaxed">
                {t(
                  "settings.privacy.deleteDesc",
                  "Trwale zablokuj dostęp do aplikacji. Historyczne dane z prób i koncertów zostaną zanonimizowane na potrzeby statystyki chóru.",
                )}
              </p>
            </div>
            <Button variant="danger" onClick={() => setIsDeleteModalOpen(true)}>
              {t("common.actions.deleteAccount", "Usuń konto")}
            </Button>
          </div>
        </div>
      </GlassCard>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title={t(
          "settings.privacy.modalTitle",
          "Czy na pewno chcesz usunąć konto?",
        )}
        description={
          <div className="flex flex-col gap-4 text-left">
            <span className="flex flex-col gap-2">
              <span>
                {t("settings.privacy.modalDescLine1Prefix", "Ta akcja jest")}{" "}
                <strong>
                  {t(
                    "settings.privacy.modalDescLine1Highlight",
                    "nieodwracalna",
                  )}
                </strong>
                .{" "}
                {t(
                  "settings.privacy.modalDescLine1Suffix",
                  "Stracisz dostęp do wszystkich materiałów chóru, nut i harmonogramów.",
                )}
              </span>
              <span>
                {t(
                  "settings.privacy.modalDescLine2",
                  "Historia obecności zostanie zachowana z powodów audytowych, ale konto zostanie trwale zdezaktywowane.",
                )}
              </span>
            </span>

            <div className="mt-4 border-t border-stone-200/60 pt-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                {t(
                  "settings.privacy.confirmPasswordLabel",
                  "Potwierdź hasłem, aby usunąć konto",
                )}
              </label>
              <Input
                type="password"
                placeholder={t(
                  "settings.privacy.passwordPlaceholder",
                  "Obecne hasło",
                )}
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                hasError={errorCode === "invalid_current_password"}
                disabled={isDeleting}
              />
              {errorCode === "invalid_current_password" && (
                <p className="text-xs text-red-500 font-medium pl-1 mt-1">
                  {t(
                    "settings.errors.invalid_current_password",
                    "Błędne hasło. Spróbuj ponownie.",
                  )}
                </p>
              )}
            </div>
          </div>
        }
        onConfirm={handleDeleteConfirm}
        onCancel={handleCloseModal}
        isLoading={isDeleting}
        isDestructive={true}
        confirmText={t("common.actions.confirmDelete", "Tak, usuń konto")}
      />
    </>
  );
}
