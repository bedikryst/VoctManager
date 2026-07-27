/**
 * @file NotificationsTab.tsx
 * @description Notification preferences: a stateful Web Push hero above a ledger
 * of consequences. Each group ("what you committed to", "someone writing to you",
 * "materials and reminders") is one email/push decision; the per-event rows behind
 * it stay reachable under a details disclosure for anyone who wants that grain.
 * Turning a recommended channel off says what it costs instead of blocking it.
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
  ChevronDown,
  Inbox,
  Info,
  RotateCcw,
  Send,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
import * as Tooltip from "@radix-ui/react-tooltip";
import { motion } from "framer-motion";

import {
  useNotificationPreferences,
  useRestoreRecommendedPreferences,
  useUpdateGroupChannel,
  useUpdatePreference,
} from "@/features/notifications/api/preferences";
import {
  useSettingsData,
  useUpdateDigestSettings,
} from "@/features/settings/api/settings.queries";
import { usePushNotifications } from "@/features/notifications/hooks/usePushNotifications";
import { PushPermissionPrimer } from "@/features/notifications/components/PushPermissionPrimer";
import type { NotificationPreferenceDTO } from "@/features/notifications/types/notifications.dto";
import {
  groupChannelState,
  isPreferenceCustomized,
  nextGroupChannelValue,
  type GroupChannelState,
  type PreferenceChannel,
} from "@/features/notifications/lib/preferences";
import {
  groupNotificationPreferences,
  notificationTypeIcon,
  type NotificationGroupId,
  type NotificationPreferenceGroup,
} from "@/features/settings/constants/notificationPreferenceGroups";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Text, Eyebrow } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { cn } from "@/shared/lib/utils";

type TFunc = ReturnType<typeof useTranslation>["t"];

/** Whole hours of the day, as a clock reads them — language-neutral. */
const DIGEST_HOURS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, "0")}:00`,
}));

/** The grid a group's control, its detail rows and the column headers all lay out
 *  on, so the two channel columns line up down the whole ledger. Written as whole
 *  literal class names — Tailwind scans source text, so a composed one never
 *  reaches the stylesheet. */
const channelGrid = (showPush: boolean) =>
  showPush ? "sm:grid-cols-[1fr_100px_100px]" : "sm:grid-cols-[1fr_100px]";

const channelHeaderGrid = (showPush: boolean) =>
  showPush ? "grid-cols-[1fr_100px_100px]" : "grid-cols-[1fr_100px]";

interface NotificationSwitchProps {
  state: GroupChannelState;
  onToggle: () => void;
  ariaLabel: string;
}

/**
 * A switch that can also say "some of these". `mixed` is a real state here — a
 * reader who once answered per event has one, and painting it as plain off would
 * misreport their own settings back to them. Clicking resolves it upward.
 */
const NotificationSwitch = ({ state, onToggle, ariaLabel }: NotificationSwitchProps) => (
  <Switch.Root
    checked={state === "on"}
    onCheckedChange={onToggle}
    aria-label={ariaLabel}
    data-mixed={state === "mixed" ? "" : undefined}
    className={cn(
      "group/switch w-11 h-6 bg-ethereal-parchment rounded-full relative transition-colors cursor-pointer outline-none focus:ring-2 ring-ethereal-gold/50 ring-offset-2 ring-offset-ethereal-alabaster shrink-0",
      "data-[state=checked]:bg-ethereal-gold data-mixed:bg-ethereal-gold/35",
    )}
  >
    <Switch.Thumb
      className={cn(
        "block w-5 h-5 bg-ethereal-marble rounded-full transition-transform duration-100 translate-x-0.5",
        "data-[state=checked]:translate-x-5.5 group-data-mixed/switch:translate-x-3",
      )}
    />
  </Switch.Root>
);

const LockedOffSwitch = () => (
  <div className="w-11 h-6 bg-ethereal-parchment/60 rounded-full flex items-center px-0.5 opacity-40 cursor-not-allowed shrink-0">
    <div className="w-5 h-5 bg-ethereal-graphite/40 rounded-full translate-x-0.5" />
  </div>
);

interface ChannelCellsProps {
  t: TFunc;
  showPushColumn: boolean;
  canManagePush: boolean;
  emailState: GroupChannelState;
  pushState: GroupChannelState;
  onToggle: (channel: PreferenceChannel, state: GroupChannelState) => void;
  emailLabel: string;
  pushLabel: string;
}

/**
 * The two channel columns, shared by a group's control and its detail rows.
 * `sm:contents` dissolves the wrapper into the parent grid on desktop while
 * keeping the cells as one labelled block on mobile.
 */
const ChannelCells: React.FC<ChannelCellsProps> = ({
  t,
  showPushColumn,
  canManagePush,
  emailState,
  pushState,
  onToggle,
  emailLabel,
  pushLabel,
}) => (
  <div className="flex flex-col gap-4 sm:contents px-1 sm:px-0 bg-ethereal-parchment/5 sm:bg-transparent rounded-control p-4 sm:p-0">
    <div className="flex items-center justify-between sm:justify-center w-full">
      <Eyebrow className="sm:hidden">{t("settings.notifications.table.email")}</Eyebrow>
      <NotificationSwitch
        state={emailState}
        ariaLabel={emailLabel}
        onToggle={() => onToggle("email_enabled", emailState)}
      />
    </div>

    {showPushColumn && (
      <div className="flex items-center justify-between sm:justify-center w-full">
        <Eyebrow className="sm:hidden">{t("settings.notifications.table.push")}</Eyebrow>
        {canManagePush ? (
          <NotificationSwitch
            state={pushState}
            ariaLabel={pushLabel}
            onToggle={() => onToggle("push_enabled", pushState)}
          />
        ) : (
          // Push is available but not yet activated — a locked teaser that
          // invites the user to turn it on via the hero above.
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
                className="bg-ethereal-ink text-ethereal-marble text-xs px-3 py-1.5 rounded-control shadow-glass-solid max-w-55 text-center leading-snug z-toast"
              >
                {t("settings.notifications.tooltips.activate_first")}
                <Tooltip.Arrow className="fill-ethereal-ink" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        )}
      </div>
    )}
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
  const { data: matrix, isLoading } = useNotificationPreferences();
  const updateMutation = useUpdatePreference();
  const groupChannelMutation = useUpdateGroupChannel();
  const restoreMutation = useRestoreRecommendedPreferences();
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
  // Every group's control is visible from the start — it is the decision the page
  // exists for. The per-event rows behind it open on request, so the ledger reads
  // as three choices (five for a manager) rather than a wall of near-synonyms.
  const [expanded, setExpanded] = useState<ReadonlySet<NotificationGroupId>>(
    () => new Set<NotificationGroupId>(),
  );
  const [restoringGroup, setRestoringGroup] = useState<NotificationGroupId | null>(null);

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

  // Push has two very different "off" states. When it is merely not-yet-activated
  // ("ready") we keep the column as a locked teaser. When it is fundamentally
  // unavailable here (denied / unsupported / misconfigured) push will never fire,
  // so the whole column + header collapses away and the hero carries the single
  // explanation — no wall of inert grey dots.
  const showPushColumn = heroVariant === "subscribed" || heroVariant === "ready";

  const groups = groupNotificationPreferences(matrix);

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

  const toggleExpanded = (id: NotificationGroupId) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleRowToggle = (
    pref: NotificationPreferenceDTO,
    patch: { email_enabled?: boolean; push_enabled?: boolean },
  ) => updateMutation.mutate({ notification_type: pref.notification_type, ...patch });

  const handleGroupToggle = (
    group: NotificationPreferenceGroup,
    channel: PreferenceChannel,
    state: GroupChannelState,
  ) =>
    groupChannelMutation.mutate({
      rows: group.preferences,
      channel,
      value: nextGroupChannelValue(state),
    });

  const handleRestore = (group: NotificationPreferenceGroup) => {
    setRestoringGroup(group.id);
    restoreMutation.mutate(
      { rows: group.preferences, includePush: showPushColumn },
      { onSettled: () => setRestoringGroup(null) },
    );
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

        <Text size="xs" color="muted" className="mb-4 leading-relaxed">
          {t("settings.notifications.in_app_note")}
        </Text>

        <div
          className={cn(
            "hidden sm:grid gap-4 pb-2 px-5 border-b border-ethereal-parchment/40",
            channelHeaderGrid(showPushColumn),
          )}
        >
          <div>
            <Eyebrow>{t("settings.notifications.table.event_type")}</Eyebrow>
          </div>
          <div className="text-center">
            <Eyebrow>{t("settings.notifications.table.email")}</Eyebrow>
          </div>
          {showPushColumn && (
            <div className="text-center">
              <Eyebrow>{t("settings.notifications.table.push")}</Eyebrow>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-4">
          {groups.map((group) => (
            <PreferenceGroupPanel
              key={group.id}
              group={group}
              t={t}
              expanded={expanded.has(group.id)}
              onToggleExpanded={() => toggleExpanded(group.id)}
              showPushColumn={showPushColumn}
              canManagePush={canManagePushColumn}
              onGroupToggle={(channel, state) => handleGroupToggle(group, channel, state)}
              onRowToggle={handleRowToggle}
              onRestore={() => handleRestore(group)}
              isRestoring={restoreMutation.isPending && restoringGroup === group.id}
            />
          ))}
          {/* Team operations is the last group, so the digest lands as the
              ledger's true footer — batching exactly the routine team alerts
              listed directly above it. */}
          <DigestPanel />
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

interface PreferenceGroupPanelProps {
  group: NotificationPreferenceGroup;
  t: TFunc;
  expanded: boolean;
  onToggleExpanded: () => void;
  showPushColumn: boolean;
  canManagePush: boolean;
  onGroupToggle: (channel: PreferenceChannel, state: GroupChannelState) => void;
  onRowToggle: (
    pref: NotificationPreferenceDTO,
    patch: { email_enabled?: boolean; push_enabled?: boolean },
  ) => void;
  onRestore: () => void;
  isRestoring: boolean;
}

const PreferenceGroupPanel: React.FC<PreferenceGroupPanelProps> = ({
  group,
  t,
  expanded,
  onToggleExpanded,
  showPushColumn,
  canManagePush,
  onGroupToggle,
  onRowToggle,
  onRestore,
  isRestoring,
}) => {
  const GroupIcon = group.icon;
  const name = t(`settings.notifications.groups.${group.id}`);
  const hasCustomized = group.preferences.some((pref) =>
    isPreferenceCustomized(pref, showPushColumn),
  );

  const emailState = groupChannelState(group.preferences, "email_enabled");
  const pushState = groupChannelState(group.preferences, "push_enabled");
  const isPartial = emailState === "mixed" || (showPushColumn && pushState === "mixed");

  // Below its own recommendation, and said out loud. A reader may switch a
  // commitment out of their inbox — it is their inbox — but they should not
  // discover what that cost them from a missed call time.
  //
  // Only when the whole group is off: the sentence speaks for every member, and
  // under a mixed state it would claim silence about events that still e-mail.
  // A partial group is described by its chip and its rows' own markers instead.
  const showEmailConsequence = group.recommended_email && emailState === "off";

  const channelLabel = (channel: PreferenceChannel, state: GroupChannelState) =>
    t(
      state === "mixed"
        ? `settings.notifications.a11y.${channel === "email_enabled" ? "email" : "push"}_group_partial`
        : `settings.notifications.a11y.${channel === "email_enabled" ? "email" : "push"}_group`,
      { group: name },
    );

  return (
    <section className="rounded-nested border border-ethereal-parchment/40 bg-ethereal-parchment/10 px-4 py-4 sm:px-5">
      <div
        className={cn(
          "flex flex-col sm:grid sm:items-center gap-y-4 sm:gap-4",
          channelGrid(showPushColumn),
        )}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 p-2 rounded-control bg-ethereal-gold/10 shrink-0">
            <GroupIcon className="w-4 h-4 text-ethereal-gold" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Text size="sm" weight="medium">
                {name}
              </Text>
              {isPartial && (
                <Badge
                  variant="warning"
                  className="shrink-0"
                  title={t("settings.notifications.partial_hint")}
                >
                  {t("settings.notifications.partial_badge")}
                </Badge>
              )}
            </div>
            <Text size="xs" color="muted" className="leading-snug mt-0.5">
              {t(`settings.notifications.groups_desc.${group.id}`)}
            </Text>
          </div>
        </div>

        <ChannelCells
          t={t}
          showPushColumn={showPushColumn}
          canManagePush={canManagePush}
          emailState={emailState}
          pushState={pushState}
          onToggle={onGroupToggle}
          emailLabel={channelLabel("email_enabled", emailState)}
          pushLabel={channelLabel("push_enabled", pushState)}
        />
      </div>

      {showEmailConsequence && (
        <div className="mt-3 flex items-start gap-2 rounded-control bg-ethereal-parchment/25 px-3 py-2.5">
          <Info className="w-3.5 h-3.5 text-ethereal-graphite/70 shrink-0 mt-0.5" aria-hidden />
          <Text size="xs" color="muted" className="leading-relaxed">
            {t(`settings.notifications.groups_email_off.${group.id}`)}
          </Text>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-ethereal-parchment/30 pt-2">
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          className="flex items-center gap-1.5 rounded-control px-1 -mx-1 py-1 text-ethereal-graphite/70 hover:text-ethereal-ink transition-colors outline-none focus-visible:ring-2 ring-ethereal-gold/50"
        >
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 transition-transform duration-200",
              !expanded && "-rotate-90",
            )}
          />
          <Eyebrow>
            {expanded
              ? t("settings.notifications.details_hide")
              : // `n`, not `count` — the number is parenthesised, so no locale
                // needs to agree with it and i18next's plural machinery would
                // only add suffixed keys nobody writes.
                t("settings.notifications.details_show", {
                  n: group.preferences.length,
                })}
          </Eyebrow>
        </button>

        {hasCustomized && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRestore}
            isLoading={isRestoring}
            leftIcon={!isRestoring ? <RotateCcw className="w-3.5 h-3.5" /> : undefined}
          >
            {t("settings.notifications.restore_recommended")}
          </Button>
        )}
      </div>

      {expanded && (
        <div className="flex flex-col divide-y divide-ethereal-parchment/30">
          {group.preferences.map((pref) => (
            <PreferenceRow
              key={pref.notification_type}
              pref={pref}
              t={t}
              showPushColumn={showPushColumn}
              canManagePush={canManagePush}
              onToggle={onRowToggle}
            />
          ))}
        </div>
      )}
    </section>
  );
};

interface PreferenceRowProps {
  pref: NotificationPreferenceDTO;
  t: TFunc;
  showPushColumn: boolean;
  canManagePush: boolean;
  onToggle: (
    pref: NotificationPreferenceDTO,
    patch: { email_enabled?: boolean; push_enabled?: boolean },
  ) => void;
}

const PreferenceRow: React.FC<PreferenceRowProps> = ({
  pref,
  t,
  showPushColumn,
  canManagePush,
  onToggle,
}) => {
  const RowIcon = notificationTypeIcon(pref.notification_type);
  const label = t(
    `settings.notifications.types.${pref.notification_type}`,
    pref.label || pref.notification_type.replace(/_/g, " "),
  );
  const description = t(`settings.notifications.type_desc.${pref.notification_type}`, "");
  const customized = isPreferenceCustomized(pref, showPushColumn);

  return (
    <div
      className={cn(
        "flex flex-col sm:grid sm:items-center gap-y-4 sm:gap-4 py-4 rounded-control sm:rounded-none",
        channelGrid(showPushColumn),
      )}
    >
      <div className="flex items-start gap-3 pl-1 sm:pl-3">
        <div className="mt-0.5 p-1.5 rounded-chip bg-ethereal-parchment/40 shrink-0">
          <RowIcon className="w-4 h-4 text-ethereal-graphite" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Text size="sm">{label}</Text>
            {customized && (
              <Badge
                variant="warning"
                className="shrink-0"
                title={t("settings.notifications.customized_hint")}
              >
                {t("settings.notifications.customized_badge")}
              </Badge>
            )}
          </div>
          {description && (
            <Text size="xs" color="muted" className="leading-snug mt-0.5">
              {description}
            </Text>
          )}
        </div>
      </div>

      <ChannelCells
        t={t}
        showPushColumn={showPushColumn}
        canManagePush={canManagePush}
        emailState={pref.email_enabled ? "on" : "off"}
        pushState={pref.push_enabled ? "on" : "off"}
        onToggle={(channel, state) => onToggle(pref, { [channel]: state !== "on" })}
        emailLabel={t("settings.notifications.a11y.email", { event: label })}
        pushLabel={t("settings.notifications.a11y.push", { event: label })}
      />
    </div>
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
      className={`relative overflow-hidden flex flex-col gap-4 p-5 sm:p-6 mb-6 rounded-nested bg-ethereal-parchment/15 border border-ethereal-parchment/40 ring-1 ${palette.ring}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className={`p-3 rounded-control shrink-0 ${palette.iconBg}`}>
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
          <Text size="xs" color="crimson" className="text-right leading-snug">
            {t("settings.notifications.actions.manual_change_required")}
          </Text>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Daily-digest control, bound directly beneath the team-operations group: those
 * routine INFO alerts (attendance, RSVPs, absence requests) are the very events it
 * batches into one email a day instead of a real-time flood. Manager-only — and
 * the team group is itself manager-only, so the two always appear together.
 */
const DigestPanel: React.FC = () => {
  const { t } = useTranslation();
  const { data: user } = useSettingsData();
  const updateDigest = useUpdateDigestSettings();

  if (!user?.profile?.is_manager) return null;

  const enabled = user.profile.digest_enabled ?? true;
  const hour = user.profile.digest_hour ?? 8;
  const timezone = user.profile.timezone;

  return (
    <div className="mt-2 rounded-nested border border-ethereal-gold/20 bg-ethereal-gold/5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-ethereal-gold shrink-0" />
            <Text size="sm" weight="medium">
              {t("settings.notifications.digest.title")}
            </Text>
          </div>
          <Text size="xs" color="muted" className="mt-1 leading-relaxed">
            {t("settings.notifications.digest.description")}
          </Text>
        </div>
        <NotificationSwitch
          state={enabled ? "on" : "off"}
          ariaLabel={t("settings.notifications.digest.title")}
          onToggle={() => updateDigest.mutate({ digest_enabled: !enabled })}
        />
      </div>

      {enabled && (
        <div className="mt-4 flex items-end justify-between gap-4 border-t border-ethereal-gold/15 pt-4">
          <div className="min-w-0">
            <Eyebrow>{t("settings.notifications.digest.hour_label")}</Eyebrow>
            {timezone && (
              <Text size="xs" color="muted" className="mt-1">
                {t("settings.notifications.digest.timezone_note", { timezone })}
              </Text>
            )}
          </div>
          <div className="w-32 shrink-0">
            <Select
              variant="solid"
              value={String(hour)}
              ariaLabel={t("settings.notifications.digest.hour_label")}
              onValueChange={(value) =>
                updateDigest.mutate({ digest_hour: Number(value) })
              }
              options={DIGEST_HOURS}
            />
          </div>
        </div>
      )}
    </div>
  );
};

function describe(variant: HeroVariant, availability: ReturnType<typeof usePushNotifications>["availability"], t: TFunc): { title: string; description: string } {
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
