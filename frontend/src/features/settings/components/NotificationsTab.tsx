/**
 * @file NotificationsTab.tsx
 * @description Notification preferences with a stateful Web Push hero,
 * permission primer, test-push action and granular per-type channel toggles.
 * @architecture Enterprise SaaS 2026
 * @module settings/NotificationsTab
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  Info,
  Loader2,
  Send,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
import * as Tooltip from "@radix-ui/react-tooltip";
import { motion } from "framer-motion";

import {
  useNotificationPreferences,
  useUpdatePreference,
} from "@/features/notifications/api/preferences";
import {
  useSettingsData,
  useUpdateDigestSettings,
} from "@/features/settings/api/settings.queries";
import { usePushNotifications } from "@/features/notifications/hooks/usePushNotifications";
import { PushPermissionPrimer } from "@/features/notifications/components/PushPermissionPrimer";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { Button } from "@/shared/ui/primitives/Button";
import { Text, Eyebrow } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";

interface NotificationSwitchProps {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}

const NotificationSwitch = ({ checked, onCheckedChange }: NotificationSwitchProps) => (
  <Switch.Root
    checked={checked}
    onCheckedChange={onCheckedChange}
    className="w-11 h-6 bg-ethereal-parchment rounded-full relative data-[state=checked]:bg-ethereal-gold transition-colors cursor-pointer outline-none focus:ring-2 ring-ethereal-gold/50 ring-offset-2 ring-offset-ethereal-alabaster shrink-0"
  >
    <Switch.Thumb className="block w-5 h-5 bg-ethereal-marble rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-5.5" />
  </Switch.Root>
);

const LockedOffSwitch = () => (
  <div className="w-11 h-6 bg-ethereal-parchment/60 rounded-full flex items-center px-0.5 opacity-40 cursor-not-allowed shrink-0">
    <div className="w-5 h-5 bg-ethereal-graphite/40 rounded-full translate-x-0.5" />
  </div>
);

type HeroVariant = "subscribed" | "ready" | "denied" | "unsupported" | "misconfigured";

interface HeroPalette {
  ring: string;
  iconBg: string;
  iconColor: string;
  Icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  eyebrowTone: string;
}

const PALETTES: Record<HeroVariant, HeroPalette> = {
  subscribed: {
    ring: "ring-ethereal-sage/30",
    iconBg: "bg-ethereal-sage/15",
    iconColor: "text-ethereal-sage",
    Icon: CheckCircle2,
    eyebrow: "active",
    eyebrowTone: "text-ethereal-sage",
  },
  ready: {
    ring: "ring-ethereal-gold/25",
    iconBg: "bg-ethereal-gold/10",
    iconColor: "text-ethereal-gold",
    Icon: BellRing,
    eyebrow: "recommended",
    eyebrowTone: "text-ethereal-gold",
  },
  denied: {
    ring: "ring-ethereal-crimson/25",
    iconBg: "bg-ethereal-crimson/10",
    iconColor: "text-ethereal-crimson",
    Icon: ShieldAlert,
    eyebrow: "blocked",
    eyebrowTone: "text-ethereal-crimson",
  },
  unsupported: {
    ring: "ring-ethereal-parchment/50",
    iconBg: "bg-ethereal-parchment/40",
    iconColor: "text-ethereal-graphite/70",
    Icon: Smartphone,
    eyebrow: "unavailable",
    eyebrowTone: "text-ethereal-graphite/70",
  },
  misconfigured: {
    ring: "ring-ethereal-amethyst/30",
    iconBg: "bg-ethereal-amethyst/10",
    iconColor: "text-ethereal-amethyst",
    Icon: Info,
    eyebrow: "configuration",
    eyebrowTone: "text-ethereal-amethyst",
  },
};

export const NotificationsTab: React.FC = () => {
  const { t } = useTranslation();
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updateMutation = useUpdatePreference();
  const {
    availability,
    permission,
    isSubscribed,
    isLoading: pushLoading,
    isSendingTest,
    subscribe,
    unsubscribe,
    sendTest,
  } = usePushNotifications();

  const [primerOpen, setPrimerOpen] = useState(false);
  const [unsubConfirmOpen, setUnsubConfirmOpen] = useState(false);

  const pushGranted = availability.kind === "ready" && permission === "granted" && isSubscribed;
  const canManagePushColumn = pushGranted;

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

  const heroVariant: HeroVariant = (() => {
    if (availability.kind === "misconfigured") return "misconfigured";
    if (availability.kind === "unsupported") return "unsupported";
    if (permission === "denied") return "denied";
    if (pushGranted) return "subscribed";
    return "ready";
  })();

  const handlePrimerAccept = async () => {
    const ok = await subscribe();
    setPrimerOpen(false);
    if (ok) {
      // Auto-fire a test push so the user gets immediate, tangible confirmation.
      void sendTest();
    }
  };

  const handleUnsubscribeConfirm = async () => {
    await unsubscribe();
    setUnsubConfirmOpen(false);
  };

  return (
    <Tooltip.Provider delayDuration={200}>
      <GlassCard variant="light" isHoverable={false}>
        <SectionHeader title={t("settings.notifications.title")} icon={<Bell className="w-5 h-5" />} />
        <Text color="muted" className="mt-1 mb-6">
          {t("settings.notifications.description")}
        </Text>

        <PushHero
          variant={heroVariant}
          availability={availability}
          isLoading={pushLoading}
          isSendingTest={isSendingTest}
          onActivate={() => setPrimerOpen(true)}
          onDeactivate={() => setUnsubConfirmOpen(true)}
          onSendTest={sendTest}
        />

        <Text size="xs" color="muted" className="mb-2 leading-relaxed">
          {t("settings.notifications.in_app_note")}
        </Text>

        <div className="flex flex-col divide-y divide-ethereal-parchment/40 sm:border-t sm:border-ethereal-parchment/40">
          <div className="hidden sm:grid grid-cols-[1fr_100px_100px] gap-4 py-4 px-2">
            <div>
              <Eyebrow>{t("settings.notifications.table.event_type")}</Eyebrow>
            </div>
            <div className="text-center">
              <Eyebrow>{t("settings.notifications.table.email")}</Eyebrow>
            </div>
            <div className="text-center">
              <Eyebrow>{t("settings.notifications.table.push")}</Eyebrow>
            </div>
          </div>

          {preferences?.map((pref) => (
            <div
              key={pref.notification_type}
              className="flex flex-col sm:grid sm:grid-cols-[1fr_100px_100px] sm:items-center gap-y-4 sm:gap-4 py-5 sm:py-4 hover:bg-ethereal-parchment/10 transition-colors sm:px-2 rounded-xl sm:rounded-none"
            >
              <div className="flex items-center px-1 sm:px-0">
                <Text size="sm" weight="medium">
                  {t(`settings.notifications.types.${pref.notification_type}`, pref.label || pref.notification_type.replace(/_/g, " "))}
                </Text>
              </div>

              <div className="flex flex-col gap-4 sm:contents px-1 sm:px-0 bg-ethereal-parchment/5 sm:bg-transparent rounded-lg p-4 sm:p-0">
                <div className="flex items-center justify-between sm:justify-center w-full">
                  <Eyebrow className="sm:hidden">{t("settings.notifications.table.email")}</Eyebrow>
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
                  <Eyebrow className="sm:hidden">{t("settings.notifications.table.push")}</Eyebrow>
                  {canManagePushColumn ? (
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
                          {heroVariant === "denied"
                            ? t("settings.notifications.tooltips.denied")
                            : heroVariant === "unsupported"
                              ? t("settings.notifications.tooltips.unsupported")
                              : t("settings.notifications.tooltips.activate_first")}
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

        <DigestSection />
      </GlassCard>

      <PushPermissionPrimer
        isOpen={primerOpen}
        isLoading={pushLoading}
        onAccept={handlePrimerAccept}
        onDismiss={() => setPrimerOpen(false)}
      />

      <ConfirmModal
        isOpen={unsubConfirmOpen}
        title={t("settings.notifications.unsubscribe_modal.title")}
        description={t("settings.notifications.unsubscribe_modal.description")}
        onConfirm={handleUnsubscribeConfirm}
        onCancel={() => setUnsubConfirmOpen(false)}
        isLoading={pushLoading}
        confirmText={t("settings.notifications.actions.disable")}
        cancelText={t("settings.notifications.actions.cancel")}
        isDestructive
      />
    </Tooltip.Provider>
  );
};

interface PushHeroProps {
  variant: HeroVariant;
  availability: ReturnType<typeof usePushNotifications>["availability"];
  isLoading: boolean;
  isSendingTest: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onSendTest: () => void;
}

const PushHero: React.FC<PushHeroProps> = ({
  variant,
  availability,
  isLoading,
  isSendingTest,
  onActivate,
  onDeactivate,
  onSendTest,
}) => {
  const palette = PALETTES[variant];
  const { Icon } = palette;

  const { t } = useTranslation();
  const { title, description } = describe(variant, availability, t);

  return (
    <motion.div
      layout
      className={`relative overflow-hidden flex flex-col gap-4 p-5 sm:p-6 mb-6 rounded-2xl bg-ethereal-parchment/15 border border-ethereal-parchment/40 ring-1 ${palette.ring}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className={`p-3 rounded-xl shrink-0 ${palette.iconBg}`}>
          <Icon className={`w-5 h-5 ${palette.iconColor}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Eyebrow className={palette.eyebrowTone}>{t(`settings.notifications.hero_variant.${palette.eyebrow}`)}</Eyebrow>
          </div>
          <Text size="sm" weight="medium">
            {title}
          </Text>
          <Text size="xs" color="muted" className="mt-1 leading-relaxed">
            {description}
          </Text>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2 border-t border-ethereal-parchment/40 sm:border-0 sm:pt-0">
        {variant === "subscribed" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeactivate}
              disabled={isLoading}
              leftIcon={<BellOff className="w-3.5 h-3.5" />}
            >
              {t("settings.notifications.actions.disable")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onSendTest}
              isLoading={isSendingTest}
              disabled={isLoading}
              leftIcon={!isSendingTest ? <Send className="w-3.5 h-3.5" /> : undefined}
            >
              {t("settings.notifications.actions.send_test")}
            </Button>
          </>
        )}

        {variant === "ready" && (
          <Button
            variant="primary"
            size="sm"
            onClick={onActivate}
            isLoading={isLoading}
            leftIcon={!isLoading ? <BellRing className="w-3.5 h-3.5" /> : undefined}
          >
            {t("settings.notifications.actions.enable")}
          </Button>
        )}

        {variant === "denied" && (
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] font-bold text-ethereal-crimson/80">
            <Loader2 className="w-3 h-3 opacity-0" aria-hidden />
            {t("settings.notifications.actions.manual_change_required")}
          </span>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Daily-digest control. Routine INFO manager alerts (attendance, RSVPs, absence
 * requests) are batched into one email a day instead of a real-time flood. Only
 * shown to managers — they're the recipients of digestible events.
 */
const DigestSection: React.FC = () => {
  const { t } = useTranslation();
  const { data: user } = useSettingsData();
  const updateDigest = useUpdateDigestSettings();

  if (!user?.profile?.is_manager) return null;

  const enabled = user.profile.digest_enabled ?? true;
  const hour = user.profile.digest_hour ?? 8;

  return (
    <div className="mt-6 pt-6 border-t border-ethereal-parchment/40">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Text size="sm" weight="medium">
            {t("settings.notifications.digest.title")}
          </Text>
          <Text size="xs" color="muted" className="mt-1 leading-relaxed">
            {t("settings.notifications.digest.description")}
          </Text>
        </div>
        <NotificationSwitch
          checked={enabled}
          onCheckedChange={(val) => updateDigest.mutate({ digest_enabled: val })}
        />
      </div>

      {enabled && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <Eyebrow>{t("settings.notifications.digest.hour_label")}</Eyebrow>
          <select
            value={hour}
            onChange={(e) => updateDigest.mutate({ digest_hour: Number(e.target.value) })}
            className="rounded-lg border border-ethereal-parchment/60 bg-ethereal-marble px-3 py-1.5 text-sm text-ethereal-ink outline-none focus:ring-2 ring-ethereal-gold/50 cursor-pointer"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

function describe(variant: HeroVariant, availability: ReturnType<typeof usePushNotifications>["availability"], t: ReturnType<typeof useTranslation>["t"]): { title: string; description: string } {
  switch (variant) {
    case "subscribed":
      return {
        title: t("settings.notifications.describe.subscribed_title"),
        description: t("settings.notifications.describe.subscribed_desc"),
      };
    case "ready":
      return {
        title: t("settings.notifications.describe.ready_title"),
        description: t("settings.notifications.describe.ready_desc"),
      };
    case "denied":
      return {
        title: t("settings.notifications.describe.denied_title"),
        description: t("settings.notifications.describe.denied_desc"),
      };
    case "unsupported":
      if (availability.kind === "unsupported" && availability.reason === "ios-not-standalone") {
        return {
          title: t("settings.notifications.describe.ios_title"),
          description: t("settings.notifications.describe.ios_desc"),
        };
      }
      if (availability.kind === "unsupported" && availability.reason === "insecure-context") {
        return {
          title: t("settings.notifications.describe.https_title"),
          description: t("settings.notifications.describe.https_desc"),
        };
      }
      return {
        title: t("settings.notifications.describe.unsupported_title"),
        description: t("settings.notifications.describe.unsupported_desc"),
      };
    case "misconfigured":
      return {
        title: t("settings.notifications.describe.misconfigured_title"),
        description: t("settings.notifications.describe.misconfigured_desc"),
      };
  }
}
