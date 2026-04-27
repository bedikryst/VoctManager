/**
 * @file NotificationsTab.tsx
 * @description Notification preferences table with a Web Push permission gate.
 * Push column is locked until the browser grants the Notification permission.
 * @architecture Enterprise SaaS 2026
 * @module settings/NotificationsTab
 */
import React from "react";
import { Bell, Lock, BellOff, Loader2 } from "lucide-react";
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
  <div className="flex justify-center">
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="w-11 h-6 bg-ethereal-parchment rounded-full relative data-[state=checked]:bg-ethereal-gold transition-colors cursor-pointer outline-none focus:ring-2 ring-ethereal-gold/50 ring-offset-2 ring-offset-ethereal-alabaster"
    >
      <Switch.Thumb className="block w-5 h-5 bg-ethereal-marble rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-5.5" />
    </Switch.Root>
  </div>
);

/** Non-interactive "always on" switch — used for the In-App column. */
const LockedOnSwitch = () => (
  <div className="flex justify-center">
    <div className="w-11 h-6 bg-ethereal-sage/30 rounded-full flex items-center px-0.5 opacity-50 cursor-not-allowed">
      <div className="w-5 h-5 bg-ethereal-sage/70 rounded-full translate-x-5" />
    </div>
  </div>
);

/** Grayed-out locked switch — used for Push column when permission is not granted. */
const LockedOffSwitch = () => (
  <div className="flex justify-center">
    <div className="w-11 h-6 bg-ethereal-parchment/60 rounded-full flex items-center px-0.5 opacity-40 cursor-not-allowed">
      <div className="w-5 h-5 bg-ethereal-graphite/40 rounded-full translate-x-0.5" />
    </div>
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

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full min-w-max text-left">
            <thead>
              <tr className="border-b border-ethereal-parchment/50">
                <th className="px-5 py-3.5 text-left">
                  <Eyebrow>Typ zdarzenia</Eyebrow>
                </th>
                <th className="px-5 py-3.5 text-center">
                  <Eyebrow>In-App</Eyebrow>
                </th>
                <th className="px-5 py-3.5 text-center">
                  <Eyebrow>E-mail</Eyebrow>
                </th>

                {/* Push column header — shows permission CTA or denied warning */}
                <th className="px-5 py-3.5 text-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <Eyebrow>Push</Eyebrow>
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
                        className="text-[10px] text-ethereal-graphite/50 hover:text-ethereal-crimson transition-colors cursor-pointer leading-none"
                      >
                        Wyłącz
                      </button>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ethereal-parchment/40">
              {preferences?.map((pref) => (
                <tr
                  key={pref.notification_type}
                  className="hover:bg-ethereal-parchment/10 transition-colors"
                >
                  <td className="px-5 py-4">
                    <Text size="sm" weight="medium">
                      {pref.label || pref.notification_type.replace(/_/g, " ")}
                    </Text>
                  </td>

                  <td className="px-5 py-4 text-center">
                    <LockedOnSwitch />
                  </td>

                  <td className="px-5 py-4 text-center">
                    <NotificationSwitch
                      checked={pref.email_enabled}
                      onCheckedChange={(val) =>
                        updateMutation.mutate({
                          notification_type: pref.notification_type,
                          email_enabled: val,
                        })
                      }
                    />
                  </td>

                  <td className="px-5 py-4 text-center">
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
                          <span>
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
                              : "Aktywuj powiadomienia push, aby zarządzać tymi ustawieniami."}
                            <Tooltip.Arrow className="fill-ethereal-ink" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <span className="flex items-center gap-1 text-[10px] text-ethereal-crimson/70 cursor-default select-none">
            <BellOff className="w-3 h-3" />
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
      className="flex items-center gap-1 text-[10px] text-ethereal-gold hover:text-ethereal-gold/80 transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Lock className="w-3 h-3" />
      )}
      {loading ? "Aktywuję..." : "Aktywuj"}
    </button>
  );
};
