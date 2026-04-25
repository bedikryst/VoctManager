import React from "react";
import { Bell } from "lucide-react";
import * as Switch from "@radix-ui/react-switch";

import {
  useNotificationPreferences,
  useUpdatePreference,
} from "@/features/notifications/api/preferences";
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

export const NotificationsTab: React.FC = () => {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updateMutation = useUpdatePreference();

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
              <th className="px-5 py-3.5 text-center">
                <Eyebrow>Push</Eyebrow>
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

                {/* In-App: always on, non-interactive */}
                <td className="px-5 py-4 text-center">
                  <div className="flex justify-center">
                    <div className="w-11 h-6 bg-ethereal-sage/30 rounded-full flex items-center px-0.5 opacity-50 cursor-not-allowed">
                      <div className="w-5 h-5 bg-ethereal-sage/70 rounded-full translate-x-5" />
                    </div>
                  </div>
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
      </div>
    </GlassCard>
  );
};
