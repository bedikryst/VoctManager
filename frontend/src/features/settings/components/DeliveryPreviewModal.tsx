/**
 * @file DeliveryPreviewModal.tsx
 * @description "Co dostanę?" — what the reader's notification settings deliver,
 * channel by channel, as examples composed on the server. The Push tab opens
 * with how many devices take a push, then shows what arrives drawn as a phone
 * notification and what does not, each with its reason. The E-mail tab does the
 * same with subject and lead, and sets the daily digest apart, because a digest
 * row arrives — only not on its own. Render-only: every example and every
 * outcome comes from the preview endpoint, so nothing here can disagree with
 * what the router does.
 * @architecture Enterprise SaaS 2026
 * @module settings/DeliveryPreviewModal
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Mail, Smartphone } from "lucide-react";

import { useDeliveryPreview } from "@/features/notifications/api/preferences";
import type {
  DeliveryPreviewDTO,
  DeliveryPreviewExampleDTO,
  NotificationGroupId,
} from "@/features/notifications/types/notifications.dto";
import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

type TFunc = ReturnType<typeof useTranslation>["t"];
type Channel = "push" | "email";

/** The installed app's icon, which the system draws beside every push. */
const APP_ICON = "/icons/icon-192.png";

const clock = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

interface GroupSection {
  id: NotificationGroupId;
  examples: DeliveryPreviewExampleDTO[];
}

interface ReasonRow {
  key: string;
  label: string;
  reason: string;
}

/** The examples a channel speaks for: the folded push has no e-mail. */
const onChannel = (examples: readonly DeliveryPreviewExampleDTO[], channel: Channel) =>
  channel === "push" ? [...examples] : examples.filter((example) => example.email !== null);

const statusOf = (example: DeliveryPreviewExampleDTO, channel: Channel): string =>
  channel === "push" ? example.push.status : (example.email?.status ?? "never");

const typeLabel = (t: TFunc, example: DeliveryPreviewExampleDTO) =>
  t(`settings.notifications.types.${example.notification_type}`);

/** The type's name, and which of its shapes this is when it has several. */
const exampleLabel = (t: TFunc, example: DeliveryPreviewExampleDTO) =>
  example.case
    ? `${typeLabel(t, example)} · ${t(`settings.notifications.preview.cases.${example.case}`)}`
    : typeLabel(t, example);

/** Keeps the groups in ledger order and drops those left with nothing. */
const sectionsWhere = (
  preview: DeliveryPreviewDTO,
  channel: Channel,
  keep: (example: DeliveryPreviewExampleDTO) => boolean,
): GroupSection[] =>
  preview.groups
    .map((group) => ({ id: group.id, examples: onChannel(group.examples, channel).filter(keep) }))
    .filter((section) => section.examples.length > 0);

/**
 * One row per type and reason. When every shape of a type shares the reason the
 * row names the type alone — "Odpowiedź artysty: wyłączone" — and splits only
 * where the shapes part, as a confirmation in the digest beside a withdrawal
 * that is not.
 */
const reasonRows = (
  t: TFunc,
  section: GroupSection,
  allOnChannel: readonly DeliveryPreviewExampleDTO[],
  channel: Channel,
  reasonFor: (status: string) => string,
): ReasonRow[] => {
  const rows: ReasonRow[] = [];
  const seen = new Set<string>();
  for (const example of section.examples) {
    const status = statusOf(example, channel);
    const key = `${example.notification_type}:${status}`;
    if (seen.has(key)) continue;
    const sharing = section.examples.filter(
      (other) =>
        other.notification_type === example.notification_type &&
        statusOf(other, channel) === status,
    );
    const total = allOnChannel.filter(
      (other) => other.notification_type === example.notification_type,
    ).length;
    if (sharing.length === total) {
      seen.add(key);
      rows.push({ key, label: typeLabel(t, example), reason: reasonFor(status) });
    } else {
      rows.push({
        key: `${key}:${example.case}`,
        label: exampleLabel(t, example),
        reason: reasonFor(status),
      });
    }
  }
  return rows;
};

interface DeliveryPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeliveryPreviewModal: React.FC<DeliveryPreviewModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [channel, setChannel] = useState<Channel>("push");
  const { data: preview, isLoading, isError } = useDeliveryPreview(isOpen);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t("settings.notifications.preview.title")}
      subtitle={t("settings.notifications.preview.subtitle")}
    >
      <SegmentedTabs<Channel>
        items={[
          { id: "push", label: t("settings.notifications.preview.tab_push"), Icon: Smartphone },
          { id: "email", label: t("settings.notifications.preview.tab_email"), Icon: Mail },
        ]}
        value={channel}
        onChange={setChannel}
        ariaLabel={t("settings.notifications.preview.tabs_label")}
        className="mb-5"
      />

      {isLoading && (
        <div className="flex justify-center py-12">
          <EtherealLoader />
        </div>
      )}

      {isError && !preview && (
        <StatePanel
          variant="inline"
          tone="warning"
          icon={<AlertCircle className="h-6 w-6" aria-hidden="true" />}
          title={t("settings.notifications.preview.error")}
        />
      )}

      {preview &&
        (channel === "push" ? (
          <PushTab t={t} preview={preview} />
        ) : (
          <EmailTab t={t} preview={preview} />
        ))}
    </BottomSheet>
  );
};

interface TabProps {
  t: TFunc;
  preview: DeliveryPreviewDTO;
}

const PushTab: React.FC<TabProps> = ({ t, preview }) => {
  const all = preview.groups.flatMap((group) => onChannel(group.examples, "push"));
  const delivered = sectionsWhere(preview, "push", (example) => example.push.delivered);
  const missed = sectionsWhere(preview, "push", (example) => !example.push.delivered);

  return (
    <div className="flex flex-col gap-6">
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-nested border px-3.5 py-3",
          preview.devices > 0
            ? "border-ethereal-sage/30 bg-ethereal-sage/10"
            : "border-hairline bg-ethereal-parchment/20",
        )}
      >
        <Smartphone
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            preview.devices > 0 ? "text-ethereal-sage" : "text-ethereal-graphite/70",
          )}
          aria-hidden="true"
        />
        <Text size="sm" className="leading-relaxed">
          {preview.devices > 0
            ? t("settings.notifications.preview.devices", { count: preview.devices })
            : t("settings.notifications.preview.devices_none")}
        </Text>
      </div>

      <PreviewSection title={t("settings.notifications.preview.get")}>
        {delivered.length === 0 ? (
          <Text size="sm" color="muted">
            {t("settings.notifications.preview.get_none")}
          </Text>
        ) : (
          delivered.map((section) => (
            <GroupBlock key={section.id} t={t} id={section.id}>
              {section.examples.map((example) => (
                <li key={`${example.notification_type}:${example.case}`}>
                  <Text size="xs" color="muted" className="mb-1 block">
                    {exampleLabel(t, example)}
                  </Text>
                  <PhoneNotification t={t} title={example.push.title} body={example.push.body} />
                </li>
              ))}
            </GroupBlock>
          ))
        )}
      </PreviewSection>

      {missed.length > 0 && (
        <PreviewSection title={t("settings.notifications.preview.not_get")}>
          {missed.map((section) => (
            <GroupBlock key={section.id} t={t} id={section.id} dense>
              {reasonRows(t, section, all, "push", (status) =>
                t(`settings.notifications.preview.push_reason.${status}`),
              ).map((row) => (
                <ReasonItem key={row.key} row={row} />
              ))}
            </GroupBlock>
          ))}
        </PreviewSection>
      )}
    </div>
  );
};

const EmailTab: React.FC<TabProps> = ({ t, preview }) => {
  const all = preview.groups.flatMap((group) => onChannel(group.examples, "email"));
  const delivered = sectionsWhere(preview, "email", (example) => Boolean(example.email?.delivered));
  const digest = sectionsWhere(preview, "email", (example) => example.email?.status === "digest");
  const missed = sectionsWhere(
    preview,
    "email",
    (example) => !example.email?.delivered && example.email?.status !== "digest",
  );

  return (
    <div className="flex flex-col gap-6">
      <PreviewSection title={t("settings.notifications.preview.get_email")}>
        {delivered.length === 0 ? (
          <Text size="sm" color="muted">
            {t("settings.notifications.preview.get_none")}
          </Text>
        ) : (
          delivered.map((section) => (
            <GroupBlock key={section.id} t={t} id={section.id}>
              {section.examples.map((example) =>
                example.email ? (
                  <li key={`${example.notification_type}:${example.case}`}>
                    <Text size="xs" color="muted" className="mb-1 block">
                      {exampleLabel(t, example)}
                    </Text>
                    <div className="rounded-nested border border-hairline bg-ethereal-marble px-3.5 py-3 shadow-glass-solid">
                      <Text size="sm" weight="semibold" className="block leading-snug">
                        {example.email.subject}
                      </Text>
                      <Text size="sm" color="muted" className="mt-1 block line-clamp-2 leading-snug">
                        {example.email.lead}
                      </Text>
                      {example.email.status === "stand_in" && (
                        <Text size="xs" color="gold" className="mt-2 block leading-snug">
                          {t("settings.notifications.preview.stand_in")}
                        </Text>
                      )}
                    </div>
                  </li>
                ) : null,
              )}
            </GroupBlock>
          ))
        )}
      </PreviewSection>

      {digest.length > 0 && (
        <PreviewSection
          title={t("settings.notifications.preview.digest", { hour: clock(preview.digest_hour) })}
          note={t("settings.notifications.preview.digest_note")}
        >
          {digest.map((section) => (
            <GroupBlock key={section.id} t={t} id={section.id} dense>
              {reasonRows(t, section, all, "email", () => "").map((row) => (
                <ReasonItem key={row.key} row={row} />
              ))}
            </GroupBlock>
          ))}
        </PreviewSection>
      )}

      {missed.length > 0 && (
        <PreviewSection title={t("settings.notifications.preview.not_get")}>
          {missed.map((section) => (
            <GroupBlock key={section.id} t={t} id={section.id} dense>
              {reasonRows(t, section, all, "email", (status) =>
                t(`settings.notifications.preview.email_reason.${status}`),
              ).map((row) => (
                <ReasonItem key={row.key} row={row} />
              ))}
            </GroupBlock>
          ))}
        </PreviewSection>
      )}
    </div>
  );
};

interface PreviewSectionProps {
  title: string;
  note?: string;
  children: React.ReactNode;
}

const PreviewSection: React.FC<PreviewSectionProps> = ({ title, note, children }) => (
  <section className="flex flex-col gap-3">
    <div>
      <Text size="base" weight="medium">
        {title}
      </Text>
      {note && (
        <Text size="xs" color="muted" className="mt-0.5 block leading-relaxed">
          {note}
        </Text>
      )}
    </div>
    {children}
  </section>
);

interface GroupBlockProps {
  t: TFunc;
  id: NotificationGroupId;
  /** Reason rows sit on hairlines; example cards need air between them. */
  dense?: boolean;
  children: React.ReactNode;
}

const GroupBlock: React.FC<GroupBlockProps> = ({ t, id, dense = false, children }) => (
  <div>
    <Eyebrow color="muted" className="mb-2 block">
      {t(`settings.notifications.groups.${id}`)}
    </Eyebrow>
    <ul className={cn("flex flex-col", dense ? "divide-y divide-hairline" : "gap-3")}>
      {children}
    </ul>
  </div>
);

const ReasonItem: React.FC<{ row: ReasonRow }> = ({ row }) => (
  <li className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
    <Text size="sm">{row.label}</Text>
    {row.reason && (
      <Text size="xs" color="muted" className="leading-snug sm:text-right">
        {row.reason}
      </Text>
    )}
  </li>
);

interface PhoneNotificationProps {
  t: TFunc;
  title: string;
  body: string;
}

/** A push as the lock screen draws it: the app's icon, its name, the moment, then
 *  the title and the line under it. */
const PhoneNotification: React.FC<PhoneNotificationProps> = ({ t, title, body }) => (
  <div className="flex gap-3 rounded-nested border border-hairline bg-ethereal-marble px-3.5 py-3 shadow-glass-solid">
    <img src={APP_ICON} alt="" className="size-9 shrink-0 rounded-control" />
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2">
        <Eyebrow color="muted" size="overline-sm">
          {t("settings.notifications.preview.app_name")}
        </Eyebrow>
        <Text size="xs" color="muted">
          {t("settings.notifications.preview.now")}
        </Text>
      </div>
      <Text size="sm" weight="semibold" className="mt-0.5 block leading-snug">
        {title}
      </Text>
      {body && (
        <Text size="sm" color="graphite" className="mt-0.5 block leading-snug">
          {body}
        </Text>
      )}
    </div>
  </div>
);
