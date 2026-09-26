/**
 * @file IntegrationsTab.tsx
 * @description "Kalendarz" pane: live iCal feed with one-tap subscribe links
 * (Google render intent + webcal:// for Apple/Outlook), the raw private URL
 * with copy, and the token reset escape hatch. The quick-subscribe row spares
 * choristers the "paste a URL into calendar settings" ritual entirely. Managers
 * are also offered the whole-season feed as a second subscription
 * (`SeasonCalendarCard`).
 *
 * On iPhone the address, not the button, is the route worth taking: `webcal://`
 * is by definition the cleartext scheme (it resolves to `http://`, and this host
 * answers port 80 with nothing but a 301), so iOS greets the tap with "the
 * connection is not secure" and then polls over that hop for as long as the
 * subscription lives — carrying the member's calendar token in the clear each
 * time. Pasting the https address into Calendar's own "add subscription" never
 * leaves TLS. The button stays for macOS, Outlook and Android, where the same
 * link is frictionless.
 * @architecture Enterprise SaaS 2026
 * @module features/settings/components/IntegrationsTab
 */

import { useTranslation } from "react-i18next";
import { CalendarDays, Info, RefreshCw, Smartphone } from "lucide-react";

import { GlassCard } from "@ui/composites/GlassCard";
import { SectionHeader } from "@ui/composites/SectionHeader";
import { Button } from "@ui/primitives/Button";
import { Text, Eyebrow } from "@ui/primitives/typography";
import { EtherealLoader } from "@ui/kinematics/EtherealLoader";
import {
  useSettingsData,
  useResetCalendarToken,
} from "../api/settings.queries";
import { CalendarSubscribeLinks } from "./CalendarSubscribeLinks";
import { SeasonCalendarCard } from "./SeasonCalendarCard";

export const IntegrationsTab = () => {
  const { t } = useTranslation();
  const { data: user, isLoading } = useSettingsData();
  const { mutate: resetToken, isPending: isResetting } =
    useResetCalendarToken();

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
  const seasonCalendar = user?.profile?.season_calendar ?? null;

  return (
    <GlassCard variant="light" isHoverable={false}>
      <SectionHeader
        title={t("settings.integrations.title", "Kalendarz")}
        icon={<CalendarDays className="h-5 w-5" />}
      />
      <Text color="muted" className="mb-8 mt-1">
        {t(
          "settings.integrations.subtitle",
          "Zsynchronizuj harmonogram prób ze swoim kalendarzem w telefonie.",
        )}
      </Text>

      <div className="space-y-5">
        {/* ── Live sync: one-tap subscribe + raw URL ────── */}
        <GlassCard variant="light" padding="md" isHoverable={false}>
          <div className="mb-5 flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-ethereal-amethyst" />
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
                  "Zasubskrybuj kalendarz chóru, a próby i koncerty będą aktualizować się automatycznie. To subskrypcja na żywo — nie jednorazowy plik z dysku.",
                )}
              </Text>
            </div>
          </div>

          <CalendarSubscribeLinks
            url={calendarUrl}
            urlLabel={t(
              "settings.integrations.calendar_url_label",
              "Twój prywatny adres kalendarza",
            )}
          />

          {calendarUrl && (
            <div className="mt-6 flex items-start gap-3">
              <Smartphone
                className="mt-0.5 h-5 w-5 shrink-0 text-ethereal-sage"
                aria-hidden="true"
              />
              <div className="space-y-2">
                <Eyebrow color="sage">
                  {t("settings.integrations.ios_title", "iPhone i iPad")}
                </Eyebrow>
                <Text size="sm" color="muted" className="leading-relaxed">
                  {t(
                    "settings.integrations.ios_desc",
                    "Na iPhonie użyj tego adresu zamiast przycisku powyżej — przycisk prowadzi przez połączenie nieszyfrowane, przed którym iPhone ostrzega. To ta sama subskrypcja na żywo.",
                  )}
                </Text>
                <ol className="list-decimal space-y-1 pl-4">
                  <Text as="li" size="sm" color="muted">
                    {t(
                      "settings.integrations.ios_step_copy",
                      "Skopiuj adres powyżej.",
                    )}
                  </Text>
                  <Text as="li" size="sm" color="muted">
                    {t(
                      "settings.integrations.ios_step_path",
                      "Kalendarz → Kalendarze → Dodaj kalendarz → Dodaj kalendarz subskrypcji.",
                    )}
                  </Text>
                  <Text as="li" size="sm" color="muted">
                    {t(
                      "settings.integrations.ios_step_paste",
                      "Wklej adres i zatwierdź subskrypcję.",
                    )}
                  </Text>
                </ol>
                <Text size="sm" color="muted" className="leading-relaxed">
                  {t(
                    "settings.integrations.ios_legacy",
                    "Starszy iPhone: Ustawienia → Kalendarz → Konta → Dodaj konto → Inne → Dodaj subskrybowany kalendarz.",
                  )}
                </Text>
              </div>
            </div>
          )}
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
              leftIcon={<RefreshCw className="h-4 w-4" />}
              className="shrink-0"
            >
              {t("settings.integrations.reset_btn", "Wygeneruj nowy link")}
            </Button>
          </div>
        </GlassCard>

        {/* ── Whole season (managers) ───────────────────── */}
        {seasonCalendar && (
          <SeasonCalendarCard season={seasonCalendar} baseUrl={backendUrl} />
        )}
      </div>
    </GlassCard>
  );
};
