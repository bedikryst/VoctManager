/**
 * @file NotificationsTab.tsx
 * @description Notification preferences with a stateful Web Push hero,
 * permission primer, test-push action and granular per-type channel toggles.
 * @architecture Enterprise SaaS 2026
 * @module settings/NotificationsTab
 */
import React, { useState } from "react";
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

const LockedOnSwitch = () => (
  <div className="w-11 h-6 bg-ethereal-sage/30 rounded-full flex items-center px-0.5 opacity-50 cursor-not-allowed shrink-0">
    <div className="w-5 h-5 bg-ethereal-sage/70 rounded-full translate-x-5" />
  </div>
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
    eyebrow: "Aktywne",
    eyebrowTone: "text-ethereal-sage",
  },
  ready: {
    ring: "ring-ethereal-gold/25",
    iconBg: "bg-ethereal-gold/10",
    iconColor: "text-ethereal-gold",
    Icon: BellRing,
    eyebrow: "Zalecane",
    eyebrowTone: "text-ethereal-gold",
  },
  denied: {
    ring: "ring-ethereal-crimson/25",
    iconBg: "bg-ethereal-crimson/10",
    iconColor: "text-ethereal-crimson",
    Icon: ShieldAlert,
    eyebrow: "Zablokowane",
    eyebrowTone: "text-ethereal-crimson",
  },
  unsupported: {
    ring: "ring-ethereal-parchment/50",
    iconBg: "bg-ethereal-parchment/40",
    iconColor: "text-ethereal-graphite/70",
    Icon: Smartphone,
    eyebrow: "Niedostępne",
    eyebrowTone: "text-ethereal-graphite/70",
  },
  misconfigured: {
    ring: "ring-ethereal-amethyst/30",
    iconBg: "bg-ethereal-amethyst/10",
    iconColor: "text-ethereal-amethyst",
    Icon: Info,
    eyebrow: "Konfiguracja",
    eyebrowTone: "text-ethereal-amethyst",
  },
};

export const NotificationsTab: React.FC = () => {
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
        <SectionHeader title="Powiadomienia" icon={<Bell className="w-5 h-5" />} />
        <Text color="muted" className="mt-1 mb-6">
          Zarządzaj tym, jak i kiedy chcesz otrzymywać informacje z systemu. Powiadomienia
          wewnątrz aplikacji są zawsze aktywne.
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

        <div className="flex flex-col divide-y divide-ethereal-parchment/40 sm:border-t sm:border-ethereal-parchment/40">
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
                            ? "Powiadomienia są zablokowane. Odblokuj je w ustawieniach przeglądarki."
                            : heroVariant === "unsupported"
                              ? "Ta przeglądarka nie obsługuje powiadomień push."
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

      <PushPermissionPrimer
        isOpen={primerOpen}
        isLoading={pushLoading}
        onAccept={handlePrimerAccept}
        onDismiss={() => setPrimerOpen(false)}
      />

      <ConfirmModal
        isOpen={unsubConfirmOpen}
        title="Wyłączyć powiadomienia push?"
        description="Nie będziesz już otrzymywać powiadomień push na tym urządzeniu. W każdej chwili możesz je włączyć ponownie."
        onConfirm={handleUnsubscribeConfirm}
        onCancel={() => setUnsubConfirmOpen(false)}
        isLoading={pushLoading}
        confirmText="Wyłącz"
        cancelText="Anuluj"
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

  const { title, description } = describe(variant, availability);

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
            <Eyebrow className={palette.eyebrowTone}>{palette.eyebrow}</Eyebrow>
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
              Wyłącz
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onSendTest}
              isLoading={isSendingTest}
              disabled={isLoading}
              leftIcon={!isSendingTest ? <Send className="w-3.5 h-3.5" /> : undefined}
            >
              Wyślij test
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
            Włącz powiadomienia
          </Button>
        )}

        {variant === "denied" && (
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] font-bold text-ethereal-crimson/80">
            <Loader2 className="w-3 h-3 opacity-0" aria-hidden />
            Wymagana ręczna zmiana w przeglądarce
          </span>
        )}
      </div>
    </motion.div>
  );
};

function describe(
  variant: HeroVariant,
  availability: ReturnType<typeof usePushNotifications>["availability"],
): { title: string; description: string } {
  switch (variant) {
    case "subscribed":
      return {
        title: "Powiadomienia push są aktywne na tym urządzeniu",
        description:
          "Otrzymujesz powiadomienia nawet gdy aplikacja jest zamknięta. Możesz dostosować poszczególne typy zdarzeń poniżej.",
      };
    case "ready":
      return {
        title: "Bądź na bieżąco bez pilnowania zakładki",
        description:
          "Włącz powiadomienia push, aby otrzymywać informacje o próbach, projektach i pilnych wiadomościach bezpośrednio na to urządzenie.",
      };
    case "denied":
      return {
        title: "Powiadomienia są zablokowane w przeglądarce",
        description:
          "Aby je włączyć, kliknij ikonę kłódki obok adresu strony, znajdź sekcję „Powiadomienia” i ustaw zezwolenie na „Zezwalaj”. Następnie odśwież stronę.",
      };
    case "unsupported":
      if (availability.kind === "unsupported" && availability.reason === "ios-not-standalone") {
        return {
          title: "Wymagany tryb aplikacji na iOS",
          description:
            "Aby włączyć powiadomienia na iPhone lub iPad, otwórz tę stronę w Safari, dotknij „Udostępnij” i wybierz „Dodaj do ekranu początkowego”. Następnie uruchom aplikację z ikony.",
        };
      }
      if (availability.kind === "unsupported" && availability.reason === "insecure-context") {
        return {
          title: "Wymagane bezpieczne połączenie (HTTPS)",
          description:
            "Powiadomienia push wymagają szyfrowanego połączenia. Otwórz aplikację przez HTTPS, aby je aktywować.",
        };
      }
      return {
        title: "Ta przeglądarka nie obsługuje powiadomień push",
        description:
          "Skorzystaj z najnowszej wersji Chrome, Edge, Firefox lub Safari. Powiadomienia w aplikacji nadal działają normalnie.",
      };
    case "misconfigured":
      return {
        title: "Powiadomienia push wymagają konfiguracji administratora",
        description:
          "Wszystkie powiadomienia w aplikacji oraz e-mailowe działają normalnie. Powiadomienia push będą dostępne po zakończeniu konfiguracji systemu.",
      };
  }
}
