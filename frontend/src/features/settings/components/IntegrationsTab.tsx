import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  Copy,
  RefreshCw,
  CheckCircle2,
  Info,
} from "lucide-react";

import { GlassCard } from "../../../shared/ui/GlassCard";
import { Button } from "../../../shared/ui/Button";
import {
  useSettingsData,
  useResetCalendarToken,
} from "../api/settings.queries";

export default function IntegrationsTab() {
  const { t } = useTranslation();
  const { data: user, isLoading } = useSettingsData();
  const { mutate: resetToken, isPending: isResetting } =
    useResetCalendarToken();
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        {t("common.state.loading", "Wczytywanie...")}
      </div>
    );
  }

  const backendUrl = import.meta.env.VITE_API_URL || window.location.origin;
  const calendarUrl = user?.profile?.calendar_token
    ? `${backendUrl}/api/calendar/${user.profile.calendar_token}/feed.ics`
    : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(calendarUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <GlassCard>
      <div className="mb-8">
        <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-[#002395]" />
          {t("settings.integrations.title", "Integracje i kalendarze")}
        </h2>
        <p className="text-sm text-stone-500 mt-1">
          {t(
            "settings.integrations.subtitle",
            "Zsynchronizuj harmonogram prób ze swoim kalendarzem w telefonie.",
          )}
        </p>
      </div>

      <div className="space-y-6">
        <div className="p-6 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <Info className="w-5 h-5 text-[#002395]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-blue-900 uppercase tracking-wider">
                {t(
                  "settings.integrations.live_sync_title",
                  "Synchronizacja na żywo (Apple, Google, Outlook)",
                )}
              </h3>
              <p className="text-xs text-blue-800/80 leading-relaxed mt-1">
                {t(
                  "settings.integrations.live_sync_desc",
                  'Użyj tego linku, aby zasubskrybować kalendarz chóru. Twoje próby i koncerty będą aktualizować się automatycznie. Dodaj go jako "Subskrypcję" (URL), a nie jednorazowy plik pobrany z dysku.',
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest pl-1">
              {t(
                "settings.integrations.calendar_url_label",
                "Twój prywatny adres kalendarza",
              )}
            </label>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                readOnly
                value={calendarUrl}
                className="flex-1 bg-white border border-blue-200 text-stone-600 text-xs font-mono rounded-xl px-4 py-3 focus:outline-none"
              />
              <Button
                onClick={handleCopy}
                variant="primary"
                className="shrink-0"
                leftIcon={
                  copied ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )
                }
              >
                {copied
                  ? t("settings.integrations.copied", "Skopiowano")
                  : t("settings.integrations.copy_link", "Kopiuj link")}
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-stone-200/50 pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-stone-800">
                {t("settings.integrations.reset_title", "Zresetuj swój link")}
              </h4>
              <p className="text-xs text-stone-500 mt-1 max-w-md">
                {t(
                  "settings.integrations.reset_desc",
                  "Jeśli podejrzewasz, że ktoś niepowołany uzyskał dostęp do Twojego linku kalendarza, wygeneruj go ponownie. Poprzedni adres natychmiast przestanie działać.",
                )}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => resetToken()}
              isLoading={isResetting}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              {t("settings.integrations.reset_btn", "Wygeneruj nowy link")}
            </Button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
