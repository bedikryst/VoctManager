// src/features/notifications/components/NotificationsTab.tsx
import React from "react";
import * as Switch from "@radix-ui/react-switch";
import {
  useNotificationPreferences,
  useUpdatePreference,
} from "@/features/notifications/api/preferences";
import { Heading, Text } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { GlassCard } from "@/shared/ui/composites/GlassCard";

export const NotificationsTab: React.FC = () => {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updateMutation = useUpdatePreference();

  if (isLoading) return <EtherealLoader />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div>
        <Heading size="lg" className="mb-1 text-ethereal-ink">
          Powiadomienia
        </Heading>
        <Text className="text-ethereal-graphite">
          Zarządzaj tym, jak i kiedy chcesz otrzymywać informacje z systemu.
          Powiadomienia wewnątrz aplikacji są zawsze aktywne.
        </Text>
      </div>

      <GlassCard variant="solid" padding="none" className="overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-ethereal-parchment/20 border-b border-ethereal-parchment/50">
              <th className="p-4 font-medium text-ethereal-ink">
                <Text size="sm">Typ zdarzenia</Text>
              </th>
              <th className="p-4 font-medium text-ethereal-ink text-center">
                <Text size="sm">In-App</Text>
              </th>
              <th className="p-4 font-medium text-ethereal-ink text-center">
                <Text size="sm">E-mail</Text>
              </th>
              <th className="p-4 font-medium text-ethereal-ink text-center">
                <Text size="sm">Push</Text>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ethereal-parchment/50">
            {preferences?.map((pref) => (
              <tr
                key={pref.notification_type}
                className="hover:bg-ethereal-parchment/10 transition-colors"
              >
                <td className="p-4">
                  <Text className="font-medium text-ethereal-ink block">
                    {pref.label || pref.notification_type.replace(/_/g, " ")}
                  </Text>
                </td>
                <td className="p-4 text-center">
                  <div className="flex justify-center">
                    <div className="w-10 h-5 bg-ethereal-sage/30 rounded-full flex items-center px-1 opacity-50 cursor-not-allowed">
                      <div className="w-3 h-3 bg-ethereal-sage rounded-full translate-x-5" />
                    </div>
                  </div>
                </td>
                <td className="p-4 text-center">
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
                <td className="p-4 text-center">
                  <NotificationSwitch
                    checked={pref.push_enabled}
                    onCheckedChange={(val) =>
                      updateMutation.mutate({
                        notification_type: pref.notification_type,
                        push_enabled: val,
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
};

const NotificationSwitch = ({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) => (
  <div className="flex justify-center">
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="w-11 h-6 bg-ethereal-parchment rounded-full relative data-[state=checked]:bg-ethereal-gold transition-colors cursor-pointer outline-none focus:ring-2 ring-ethereal-gold/50 ring-offset-2 ring-offset-ethereal-alabaster"
    >
      <Switch.Thumb className="block w-5 h-5 bg-ethereal-marble rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
    </Switch.Root>
  </div>
);
