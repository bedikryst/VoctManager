import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  Copy,
  RefreshCw,
  CheckCircle2,
  Info,
} from "lucide-react";

import { GlassCard } from "@ui/composites/GlassCard";
import { SectionHeader } from "@ui/composites/SectionHeader";
import { Button } from "@ui/primitives/Button";
import { Input } from "@ui/primitives/Input";
import { Text, Eyebrow } from "@ui/primitives/typography";
import { EtherealLoader } from "@ui/kinematics/EtherealLoader";
import {
  useSettingsData,
  useResetCalendarToken,
} from "../api/settings.queries";

export const IntegrationsTab = () => {
  const { t } = useTranslation();
  const { data: user, isLoading } = useSettingsData();
  const { mutate: resetToken, isPending: isResetting } =
    useResetCalendarToken();
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <GlassCard
        variant="light"
        isHoverable={false}
        className="flex items-center justify-center py-20"
      >
        <EtherealLoader />
      </GlassCard>
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
    } catch {
      // clipboard API unavailable in insecure contexts
    }
  };

  return (
    <GlassCard variant="light" isHoverable={false}>
      <SectionHeader
        title={t("settings.integrations.title", "Integracje i kalendarze")}
        icon={<CalendarDays className="w-5 h-5" />}
      />
      <Text color="muted" className="mt-1 mb-8">
        {t(
          "settings.integrations.subtitle",
          "Zsynchronizuj harmonogram prób ze swoim kalendarzem w telefonie.",
        )}
      </Text>

      <div className="space-y-5">
        {/* ── Live sync info + URL ──────────────────────── */}
        <GlassCard variant="light" padding="md" isHoverable={false}>
          <div className="flex items-start gap-3 mb-5">
            <Info className="w-5 h-5 text-ethereal-amethyst shrink-0 mt-0.5" />
            <div className="space-y-1">
              <Eyebrow color="amethyst">
                {t(
                  "settings.integrations.live_sync_title",
                  "Synchronizacja na żywo (Apple, Google, Outlook)",
                )}
              </Eyebrow>
              <Text size="sm" color="muted" className="leading-relaxed">
                {t(
                  "settings.integrations.live_sync_desc",
                  'Użyj tego linku, aby zasubskrybować kalendarz chóru. Twoje próby i koncerty będą aktualizować się automatycznie. Dodaj go jako "Subskrypcję" (URL), a nie jednorazowy plik pobrany z dysku.',
                )}
              </Text>
            </div>
          </div>

          <div className="space-y-2">
            <Eyebrow>
              {t(
                "settings.integrations.calendar_url_label",
                "Twój prywatny adres kalendarza",
              )}
            </Eyebrow>
            <div className="flex flex-col gap-2.5 md:flex-row">
              <Input
                readOnly
                value={calendarUrl}
                aria-label={t(
                  "settings.integrations.calendar_url_label",
                  "Twój prywatny adres kalendarza",
                )}
              />
              <Button
                onClick={handleCopy}
                variant="outline"
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
                  ? t("settings.integrations.copied", "Skopiowano!")
                  : t("settings.integrations.copy_link", "Kopiuj link")}
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* ── Reset token ───────────────────────────────── */}
        <GlassCard variant="outline" padding="md" isHoverable={false}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1.5">
              <Eyebrow>
                {t("settings.integrations.reset_title", "Zresetuj swój link")}
              </Eyebrow>
              <Text
                size="sm"
                color="muted"
                className="max-w-md leading-relaxed"
              >
                {t(
                  "settings.integrations.reset_desc",
                  "Jeśli podejrzewasz, że ktoś niepowołany uzyskał dostęp do Twojego linku kalendarza, wygeneruj go ponownie. Poprzedni adres natychmiast przestanie działać.",
                )}
              </Text>
            </div>
            <Button
              variant="outline"
              onClick={() => resetToken()}
              isLoading={isResetting}
              leftIcon={<RefreshCw className="w-4 h-4" />}
              className="shrink-0"
            >
              {t("settings.integrations.reset_btn", "Wygeneruj nowy link")}
            </Button>
          </div>
        </GlassCard>
      </div>
    </GlassCard>
  );
};
