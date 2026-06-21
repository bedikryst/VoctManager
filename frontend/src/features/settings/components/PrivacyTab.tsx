/**
 * @file PrivacyTab.tsx
 * @description "Prywatność i dane" pane: GDPR data export plus the account
 * deletion danger zone (re-auth with password, soft delete on the backend).
 * @architecture Enterprise SaaS 2026
 * @module features/settings/components/PrivacyTab
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Fingerprint,
  Download,
  Trash2,
  FileJson,
  Music,
  MessageSquareQuote,
} from "lucide-react";
import axios from "axios";

import { GlassCard } from "@ui/composites/GlassCard";
import { SectionHeader } from "@ui/composites/SectionHeader";
import { ConfirmModal } from "@ui/composites/ConfirmModal";
import { Button } from "@ui/primitives/Button";
import { Input } from "@ui/primitives/Input";
import { Text, Eyebrow, Caption } from "@ui/primitives/typography";
import {
  setSpotifyConsent,
  useSpotifyConsent,
} from "@/shared/lib/consent/spotifyConsent";
import { useExportData, useDeleteAccount } from "../api/settings.queries";
import type { ApiErrorResponse } from "../types/settings.dto";

export const PrivacyTab = () => {
  const { t } = useTranslation();

  const { mutate: exportData, isPending: isExporting } = useExportData();
  const { mutate: deleteAccount, isPending: isDeleting } = useDeleteAccount();

  const spotifyConsent = useSpotifyConsent();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleExport = () => exportData();

  const handleDeleteConfirm = () => {
    setErrorCode(null);
    deleteAccount(
      { password: deletePassword },
      {
        onError: (error: unknown) => {
          if (axios.isAxiosError<ApiErrorResponse>(error)) {
            setErrorCode(error.response?.data?.error_code ?? "unknown_error");
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
      <GlassCard variant="light" isHoverable={false}>
        <SectionHeader
          title={t("settings.privacy.title", "Prywatność i dane")}
          icon={<Fingerprint className="w-5 h-5" />}
        />
        <Text color="muted" className="mt-1 mb-8">
          {t(
            "settings.privacy.subtitle",
            "Zarządzaj swoimi danymi osobowymi oraz uprawnieniami do konta.",
          )}
        </Text>

        <div className="space-y-4">
          {/* What we process — transparency note for the optional form-of-address
              data (GDPR art. 13). Ordinary data, never special-category. */}
          <GlassCard variant="outline" padding="md" isHoverable={false}>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <MessageSquareQuote className="w-4 h-4 text-ethereal-graphite" />
                <Eyebrow>
                  {t("settings.privacy.salutationTitle", "Forma zwrotu")}
                </Eyebrow>
              </div>
              <Text size="sm" color="muted" className="max-w-xl leading-relaxed">
                {t(
                  "settings.privacy.salutationDesc",
                  "Przechowujemy opcjonalną formę zwrotu (kobieca / męska / neutralna) wyłącznie po to, by poprawnie zwracać się do Ciebie w powitaniach w e-mailach i powiadomieniach. Jest opcjonalna, nie udostępniamy jej nikomu, a Ty możesz ją w każdej chwili zmienić lub ustawić jako neutralną w zakładce „Ogólne”.",
                )}
              </Text>
            </div>
          </GlassCard>

          {/* Data Export */}
          <GlassCard variant="outline" padding="md" isHoverable={false}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-ethereal-graphite" />
                  <Eyebrow>
                    {t("settings.privacy.exportTitle", "Eksport danych (RODO)")}
                  </Eyebrow>
                </div>
                <Text
                  size="sm"
                  color="muted"
                  className="max-w-md leading-relaxed"
                >
                  {t(
                    "settings.privacy.exportDesc",
                    "Pobierz kopię wszystkich danych przypisanych do Twojego konta w maszynowo czytelnym formacie JSON.",
                  )}
                </Text>
              </div>
              <Button
                variant="outline"
                onClick={handleExport}
                isLoading={isExporting}
                leftIcon={<Download className="w-4 h-4" />}
                className="shrink-0"
              >
                {t("common.actions.download", "Pobierz")}
              </Button>
            </div>
          </GlassCard>

          {/* Spotify embed consent — revocable as easily as granted (RODO art. 7 ust. 3) */}
          <GlassCard variant="outline" padding="md" isHoverable={false}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-ethereal-graphite" />
                  <Eyebrow>
                    {t(
                      "settings.privacy.spotifyTitle",
                      "Wbudowane odtwarzacze (Spotify)",
                    )}
                  </Eyebrow>
                </div>
                <Text
                  size="sm"
                  color="muted"
                  className="max-w-md leading-relaxed"
                >
                  {spotifyConsent
                    ? t(
                        "settings.privacy.spotifyDescOn",
                        "Odtwarzacze Spotify ładują się automatycznie dzięki Twojej zgodzie (łączą się z serwerami Spotify, pliki cookie i dane). Możesz cofnąć zgodę w każdej chwili.",
                      )
                    : t(
                        "settings.privacy.spotifyDescOff",
                        "Wbudowane odtwarzacze Spotify są wyłączone. Zapytamy o zgodę dopiero, gdy otworzysz odtwarzacz przy projekcie.",
                      )}
                </Text>
              </div>
              <Button
                variant="outline"
                onClick={() => setSpotifyConsent(!spotifyConsent)}
                leftIcon={<Music className="w-4 h-4" />}
                className="shrink-0"
              >
                {spotifyConsent
                  ? t("settings.privacy.spotifyRevoke", "Cofnij zgodę")
                  : t("settings.privacy.spotifyGrant", "Zezwól")}
              </Button>
            </div>
          </GlassCard>

          {/* Account Deletion — the only true danger zone in settings */}
          <GlassCard
            variant="outline"
            padding="md"
            isHoverable={false}
            className="border-ethereal-crimson/25 bg-ethereal-crimson/[0.03]"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-ethereal-crimson" />
                  <Eyebrow color="crimson">
                    {t("settings.privacy.deleteTitle", "Usuń konto")}
                  </Eyebrow>
                </div>
                <Text
                  size="sm"
                  color="muted"
                  className="max-w-md leading-relaxed"
                >
                  {t(
                    "settings.privacy.deleteDesc",
                    "Trwale zablokuj dostęp do aplikacji. Historyczne dane z prób i koncertów zostaną zanonimizowane na potrzeby statystyki chóru.",
                  )}
                </Text>
              </div>
              <Button
                variant="destructive"
                onClick={() => setIsDeleteModalOpen(true)}
                className="shrink-0"
              >
                {t("common.actions.deleteAccount", "Usuń konto")}
              </Button>
            </div>
          </GlassCard>
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
            <Text size="sm" color="muted">
              {t("settings.privacy.modalDescLine1Prefix", "Ta akcja jest")}{" "}
              <strong>
                {t("settings.privacy.modalDescLine1Highlight", "nieodwracalna")}
              </strong>
              .{" "}
              {t(
                "settings.privacy.modalDescLine1Suffix",
                "Stracisz dostęp do wszystkich materiałów chóru, nut i harmonogramów.",
              )}
            </Text>
            <Text size="sm" color="muted">
              {t(
                "settings.privacy.modalDescLine2",
                "Historia obecności zostanie zachowana z powodów audytowych, ale konto zostanie trwale zdezaktywowane.",
              )}
            </Text>

            <div className="border-t border-ethereal-ink/10 pt-4 space-y-1.5">
              <Input
                type="password"
                label={t(
                  "settings.privacy.confirmPasswordLabel",
                  "Potwierdź hasłem, aby usunąć konto",
                )}
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
                <Caption color="crimson" className="pl-1">
                  {t(
                    "settings.errors.invalid_current_password",
                    "Błędne hasło. Spróbuj ponownie.",
                  )}
                </Caption>
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
};
