/**
 * @file PrivacyTab.tsx
 * @description Tab for GDPR compliance handling (Data Portability and Account Erasure).
 * @module features/settings/components
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert, Download, Trash2, FileJson } from "lucide-react";

import { GlassCard } from "../../../shared/ui/GlassCard";
import { Button } from "../../../shared/ui/Button";
import ConfirmModal from "../../../shared/ui/ConfirmModal";
import { useExportData, useDeleteAccount } from "../api/settings.queries";

export default function PrivacyTab() {
  const { t } = useTranslation();

  const { mutate: exportData, isPending: isExporting } = useExportData();
  const { mutate: deleteAccount, isPending: isDeleting } = useDeleteAccount();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleExport = () => {
    exportData();
  };

  const handleDeleteConfirm = () => {
    deleteAccount();
  };

  return (
    <>
      <GlassCard>
        <div className="mb-8">
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#002395]" />
            {t("settings.privacy.title", "Prywatność i Dane (RODO)")}
          </h2>
          <p className="text-sm text-stone-500 mt-1">
            {t(
              "settings.privacy.subtitle",
              "Zarządzaj swoimi danymi osobowymi oraz uprawnieniami do konta.",
            )}
          </p>
        </div>

        <div className="space-y-8">
          {/* Eksport Danych */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl bg-white/40 border border-stone-200/50">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-stone-800 uppercase tracking-wider flex items-center gap-2">
                <FileJson className="w-4 h-4 text-stone-500" />
                {t("settings.privacy.exportTitle", "Eksport Danych")}
              </h3>
              <p className="text-xs text-stone-500 max-w-md leading-relaxed">
                {t(
                  "settings.privacy.exportDesc",
                  "Pobierz kopię wszystkich danych przypisanych do Twojego konta w maszynowo czytelnym formacie (JSON).",
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

          {/* Strefa Niebezpieczna */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl bg-red-50/50 border border-red-100">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-red-800 uppercase tracking-wider flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-500" />
                {t("settings.privacy.deleteTitle", "Usuń Konto")}
              </h3>
              <p className="text-xs text-red-600/80 max-w-md leading-relaxed">
                {t(
                  "settings.privacy.deleteDesc",
                  "Trwałe zablokowanie dostępu do aplikacji. Twoje historyczne dane z prób i koncertów zostaną zanonimizowane dla celów statystycznych chóru.",
                )}
              </p>
            </div>
            <Button variant="danger" onClick={() => setIsDeleteModalOpen(true)}>
              {t("common.actions.deleteAccount", "Usuń Konto")}
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Modal Potwierdzający */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title={t(
          "settings.privacy.modalTitle",
          "Czy na pewno chcesz usunąć konto?",
        )}
        description={
          <span className="flex flex-col gap-2">
            <span>
              Ta akcja jest <strong>nieodwracalna</strong>. Stracisz dostęp do
              wszystkich materiałów chóru, nut i harmonogramów.
            </span>
            <span>
              Twoja historia obecności zostanie zachowana z powodów audytowych,
              ale konto zostanie trwale zdezaktywowane.
            </span>
          </span>
        }
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteModalOpen(false)}
        isLoading={isDeleting}
        isDestructive={true}
        confirmText={t("common.actions.confirmDelete", "Tak, Usuń Konto")}
      />
    </>
  );
}
