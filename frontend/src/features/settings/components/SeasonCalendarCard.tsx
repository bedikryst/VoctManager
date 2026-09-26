/**
 * @file SeasonCalendarCard.tsx
 * @description The manager's whole-season subscription, offered beneath the
 * personal feed. A second calendar rather than a widening of the first: on the
 * phone it is a layer of its own, with its own colour and checkbox, so hiding
 * it is instant, and the personal address keeps carrying only the member's own
 * dates. The server decides both who is offered it (`season_calendar` is null
 * for everyone else) and what it carries: the published dates the personal
 * feed does not already hold.
 * @architecture Enterprise SaaS 2026
 * @module features/settings/components/SeasonCalendarCard
 */

import { useTranslation } from "react-i18next";
import * as Switch from "@radix-ui/react-switch";
import { CalendarRange, RefreshCw, Smartphone } from "lucide-react";

import { GlassCard } from "@ui/composites/GlassCard";
import { Button } from "@ui/primitives/Button";
import { Text, Eyebrow } from "@ui/primitives/typography";
import type { SeasonCalendar } from "@/shared/auth/auth.types";
import {
  useResetSeasonCalendarToken,
  useSetSeasonCalendar,
} from "../api/settings.queries";
import { CalendarSubscribeLinks } from "./CalendarSubscribeLinks";

interface SeasonCalendarCardProps {
  season: SeasonCalendar;
  /** The origin every feed address is built on. */
  baseUrl: string;
}

export const SeasonCalendarCard = ({
  season,
  baseUrl,
}: SeasonCalendarCardProps) => {
  const { t } = useTranslation();
  const { mutate: setEnabled } = useSetSeasonCalendar();
  const { mutate: resetToken, isPending: isResetting } =
    useResetSeasonCalendarToken();

  // The first switch-on mints the token, so for that one round trip the switch
  // already reads on while there is no address to show yet.
  const seasonUrl = season.token
    ? `${baseUrl}/api/calendar/${season.token}/season.ics`
    : "";

  return (
    <GlassCard variant="light" padding="md" isHoverable={false}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <CalendarRange
            className="mt-0.5 h-5 w-5 shrink-0 text-ethereal-gold"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <Eyebrow color="gold">
              {t("settings.integrations.season.title")}
            </Eyebrow>
            <Text size="sm" color="muted" className="leading-relaxed">
              {t("settings.integrations.season.desc")}
            </Text>
          </div>
        </div>
        <Switch.Root
          checked={season.enabled}
          onCheckedChange={(enabled) => setEnabled(enabled)}
          aria-label={t("settings.integrations.season.toggle_label")}
          className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-ethereal-parchment outline-none ring-ethereal-gold/50 ring-offset-2 ring-offset-ethereal-alabaster transition-colors focus:ring-2 data-[state=checked]:bg-ethereal-gold"
        >
          <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-ethereal-marble transition-transform duration-100 data-[state=checked]:translate-x-5.5" />
        </Switch.Root>
      </div>

      {season.enabled && seasonUrl && (
        <div className="mt-6 space-y-6">
          <Text size="sm" color="muted" className="leading-relaxed">
            {t("settings.integrations.season.scope_note")}
          </Text>

          <div>
            <CalendarSubscribeLinks
              url={seasonUrl}
              urlLabel={t("settings.integrations.season.url_label")}
            />
          </div>

          <div className="flex items-start gap-3">
            <Smartphone
              className="mt-0.5 h-5 w-5 shrink-0 text-ethereal-sage"
              aria-hidden="true"
            />
            <Text size="sm" color="muted" className="leading-relaxed">
              {t("settings.integrations.season.ios_note")}
            </Text>
          </div>

          <Text size="sm" color="muted" className="leading-relaxed">
            {t("settings.integrations.season.off_note")}
          </Text>

          <div className="flex flex-col gap-4 border-t border-ethereal-incense/10 pt-5 md:flex-row md:items-center md:justify-between">
            <Text size="sm" color="muted" className="max-w-md leading-relaxed">
              {t("settings.integrations.season.reset_desc")}
            </Text>
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
        </div>
      )}
    </GlassCard>
  );
};
