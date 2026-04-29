/**
 * @file NotificationsTab.tsx
 * @description Notification preferences with responsive layout and Web Push permission banner.
 * @architecture Enterprise SaaS 2026
 * @module settings/NotificationsTab
 */
import React from "react";
import { Bell, BellOff, Loader2, Smartphone } from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
import * as Tooltip from "@radix-ui/react-tooltip";

import {
  useNotificationPreferences,
  useUpdatePreference,
} from "@/features/notifications/api/preferences";
import { usePushNotifications } from "@/features/notifications/hooks/usePushNotifications";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Text, Eyebrow } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";

interface NotificationSwitchProps {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}

const NotificationSwitch = ({
  checked,
  onCheckedChange,
}: NotificationSwitchProps) => (
  <Switch.Root
    checked={checked}
    onCheckedChange={onCheckedChange}
    className="w-11 h-6 bg-ethereal-parchment rounded-full relative data-[state=checked]:bg-ethereal-gold transition-colors cursor-pointer outline-none focus:ring-2 ring-ethereal-gold/50 ring-offset-2 ring-offset-ethereal-alabaster shrink-0"
  >
    <Switch.Thumb className="block w-5 h-5 bg-ethereal-marble rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-5.5" />
  </Switch.Root>
);

/** Non-interactive "always on" switch — used for the In-App column. */
const LockedOnSwitch = () => (
  <div className="w-11 h-6 bg-ethereal-sage/30 rounded-full flex items-center px-0.5 opacity-50 cursor-not-allowed shrink-0">
    <div className="w-5 h-5 bg-ethereal-sage/70 rounded-full translate-x-5" />
  </div>
);

/** Grayed-out locked switch — used for Push column when permission is not granted. */
const LockedOffSwitch = () => (
  <div className="w-11 h-6 bg-ethereal-parchment/60 rounded-full flex items-center px-0.5 opacity-40 cursor-not-allowed shrink-0">
    <div className="w-5 h-5 bg-ethereal-graphite/40 rounded-full translate-x-0.5" />
  </div>
);

export const NotificationsTab: React.FC = () => {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updateMutation = useUpdatePreference();
  const { permission, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } =
    usePushNotifications();

  const pushGranted = permission === "granted" && isSubscribed;
  const pushDenied = permission === "denied";

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

  return (
    <Tooltip.Provider delayDuration={200}>
      <GlassCard variant="light" isHoverable={false}>
        <SectionHeader
          title="Powiadomienia"
          icon={<Bell className="w-5 h-5" />}
        />
        <Text color="muted" className="mt-1 mb-6">
          Zarządzaj tym, jak i kiedy chcesz otrzymywać informacje z systemu.
          Powiadomienia wewnątrz aplikacji są zawsze aktywne.
        </Text>

        {/* Global Push Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 mb-6 rounded-2xl bg-ethereal-parchment/20 border border-ethereal-parchment/30">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-ethereal-parchment/50 rounded-lg shrink-0">
              {pushGranted ? (
                <Smartphone className="w-5 h-5 text-ethereal-gold" />
              ) : (
                <BellOff className="w-5 h-5 text-ethereal-graphite/50" />
              )}
            </div>
            <div>
              <Text size="sm" weight="medium">
                Powiadomienia na tym urządzeniu
              </Text>
              <Text size="xs" color="muted" className="mt-0.5">
                {pushGranted
                  ? "Powiadomienia push są aktywne. Możesz je konfigurować poniżej."
                  : pushDenied
                  ? "Powiadomienia są zablokowane w ustawieniach przeglądarki."
                  : "Włącz powiadomienia push, aby być na bieżąco poza aplikacją."}
              </Text>
            </div>
          </div>
          <div className="shrink-0 flex sm:justify-end w-full sm:w-auto mt-2 sm:mt-0">
            {!pushGranted && (
              <PushPermissionBadge
                denied={pushDenied}
                loading={pushLoading}
                onActivate={subscribe}
              />
            )}
            {pushGranted && (
              <button
                onClick={unsubscribe}
                disabled={pushLoading}
                className="w-full sm:w-auto px-4 py-2 text-xs font-medium rounded-lg bg-ethereal-parchment/50 text-ethereal-graphite hover:text-ethereal-crimson hover:bg-ethereal-parchment/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {pushLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Wyłącz powiadomienia push"
                )}
              </button>
            )}
          </div>
        </div>

        {/* Responsive Grid for Preferences */}
        <div className="flex flex-col divide-y divide-ethereal-parchment/40 sm:border-t sm:border-ethereal-parchment/40">
          {/* Desktop Header */}
          <div className="hidden sm:grid grid-cols-[1fr_100px_100px_100px] gap-4 py-4 px-2">
            <div>
              <Eyebrow>Typ zdarzenia</Eyebrow>
            </div>
            <div className="text-center">
              <Eyebrow>In-App</Eyebrow>
            </div>
            <div className="text-center">
              <Eyebrow>E-mail</Eyebrow>
            </div>
            <div className="text-center">
              <Eyebrow>Push</Eyebrow>
            </div>
          </div>

          {/* Rows */}
          {preferences?.map((pref) => (
            <div
              key={pref.notification_type}
              className="flex flex-col sm:grid sm:grid-cols-[1fr_100px_100px_100px] sm:items-center gap-y-4 sm:gap-4 py-5 sm:py-4 hover:bg-ethereal-parchment/10 transition-colors sm:px-2 rounded-xl sm:rounded-none"
            >
              <div className="flex items-center px-1 sm:px-0">
                <Text size="sm" weight="medium">
                  {pref.label || pref.notification_type.replace(/_/g, " ")}
                </Text>
              </div>

              {/* Toggles wrapper */}
              <div className="flex flex-col gap-4 sm:contents px-1 sm:px-0 bg-ethereal-parchment/5 sm:bg-transparent rounded-lg p-4 sm:p-0">
                <div className="flex items-center justify-between sm:justify-center w-full">
                  <Eyebrow className="sm:hidden">In-App</Eyebrow>
                  <LockedOnSwitch />
                </div>

                <div className="flex items-center justify-between sm:justify-center w-full">
                  <Eyebrow className="sm:hidden">E-mail</Eyebrow>
                  <NotificationSwitch
                    checked={pref.email_enabled}
                    onCheckedChange={(val) =>
                      updateMutation.mutate({
                        notification_type: pref.notification_type,
                        email_enabled: val,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between sm:justify-center w-full">
                  <Eyebrow className="sm:hidden">Push</Eyebrow>
                  {pushGranted ? (
                    <NotificationSwitch
                      checked={pref.push_enabled}
                      onCheckedChange={(val) =>
                        updateMutation.mutate({
                          notification_type: pref.notification_type,
                          push_enabled: val,
                        })
                      }
                    />
                  ) : (
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <span className="flex">
                          <LockedOffSwitch />
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          side="left"
                          sideOffset={6}
                          className="bg-ethereal-ink text-ethereal-marble text-xs px-3 py-1.5 rounded-lg shadow-glass-solid max-w-55 text-center leading-snug z-toast"
                        >
                          {pushDenied
                            ? "Powiadomienia są zablokowane. Odblokuj je w ustawieniach przeglądarki."
                            : "Aktywuj powiadomienia push u góry, aby zarządzać tymi ustawieniami."}
                          <Tooltip.Arrow className="fill-ethereal-ink" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </Tooltip.Provider>
  );
};

interface PushPermissionBadgeProps {
  denied: boolean;
  loading: boolean;
  onActivate: () => void;
}

const PushPermissionBadge = ({
  denied,
  loading,
  onActivate,
}: PushPermissionBadgeProps) => {
  if (denied) {
    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className="flex items-center justify-center w-full sm:w-auto gap-1.5 px-4 py-2 bg-ethereal-crimson/10 text-ethereal-crimson text-xs font-medium rounded-lg cursor-default select-none">
            <BellOff className="w-4 h-4" />
            Zablokowane
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            className="bg-ethereal-ink text-ethereal-marble text-xs px-3 py-1.5 rounded-lg shadow-glass-solid max-w-60 text-center leading-snug z-toast"
          >
            Powiadomienia zablokowane w przeglądarce. Wejdź w ustawienia
            witryny i zmień zezwolenie ręcznie.
            <Tooltip.Arrow className="fill-ethereal-ink" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  return (
    <button
      onClick={onActivate}
      disabled={loading}
      className="flex items-center justify-center w-full sm:w-auto gap-1.5 px-4 py-2 bg-ethereal-gold/10 text-ethereal-gold hover:bg-ethereal-gold/20 text-xs font-medium rounded-lg transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Bell className="w-4 h-4" />
      )}
      {loading ? "Aktywuję..." : "Włącz powiadomienia"}
    </button>
  );
};
