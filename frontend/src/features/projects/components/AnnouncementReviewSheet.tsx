/**
 * @file AnnouncementReviewSheet.tsx
 * @description The conductor's surface over a live project's announcement queue.
 * On an active project a save lands at once but only accrues in the queue; this is
 * where the conductor reviews what has piled up and decides what the cast is told.
 *
 * Every change is one line, individually held back with a checkbox — the venue can
 * go out while a still-unsettled call time waits. A held line is not discarded: it
 * stays in the queue for the next review, which is why one per-line control is
 * enough. The counts (and the confirm button) come from the server for the current
 * selection, so the number promised is the number sent. A note folds everyone who
 * has news into a briefing; discarding the whole queue warns first when it holds a
 * cast removal — the one silence that is a defect rather than a choice.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/AnnouncementReviewSheet
 */

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Inbox,
  Megaphone,
  Send,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import {
  briefingItemSummary,
  changeLabel,
  compactMetaLine,
  renderChanges,
  voiceLineLabel,
  voiceScopeOf,
} from "@/features/notifications/lib/notificationFormat";

import {
  useAnnouncementReview,
  useDiscardAnnouncements,
  usePublishAnnouncements,
} from "../api/project.queries";
import type {
  AnnouncementChange,
  AnnouncementReview,
} from "../api/project.service";

interface AnnouncementReviewSheetProps {
  readonly isOpen: boolean;
  readonly projectId: string;
  readonly projectTitle: string;
  readonly onClose: () => void;
}

// The conductor reviews from the widest audience inward: the whole concert, the
// rehearsals everyone keeps, then each singer's own part — and, set apart last,
// the people being taken off the cast, the one change a bullet list must not bury.
const SECTION_ORDER = ["PROJECT", "REHEARSAL", "CASTING", "PARTICIPATION"] as const;
type SectionKey = (typeof SECTION_ORDER)[number];

const SECTION_META: Record<
  SectionKey,
  { titleKey: string; fallback: string; danger?: boolean }
> = {
  PROJECT: { titleKey: "projects.announce.section_project", fallback: "Koncert" },
  REHEARSAL: { titleKey: "projects.announce.section_rehearsal", fallback: "Próby" },
  CASTING: { titleKey: "projects.announce.section_casting", fallback: "Partie" },
  PARTICIPATION: {
    titleKey: "projects.announce.section_participation",
    fallback: "Skreślenia z obsady",
    danger: true,
  },
};

type TFunc = ReturnType<typeof useTranslation>["t"];

/**
 * The line's headline, read from the same payload the artist's own message will
 * carry — so the sheet never describes a change one way and delivers it another.
 *
 * Facts are shared; voice is not. The briefing summary addresses the singer ("You're
 * no longer singing this one"), which is exactly right in their inbox and wrong on
 * the conductor's desk, so a part is described in the third person here while still
 * reading its piece, voice line and diff from the same metadata.
 */
const lineTitle = (t: TFunc, lang: string, change: AnnouncementChange): string => {
  if (change.subject_type === "PARTICIPATION") {
    return t("projects.announce.removed_from_cast", "Zdjęcie z obsady");
  }

  if (change.subject_type === "CASTING") {
    const { piece_title: piece, voice_line: voice } = change.metadata;
    const scope = voiceScopeOf(change.metadata);
    return (
      compactMetaLine(
        t(
          `projects.announce.casting_${change.kind.toLowerCase()}`,
          CASTING_KIND_FALLBACK[change.kind],
        ),
        piece == null ? "" : String(piece),
        voiceLineLabel(t, typeof voice === "string" ? voice : undefined, scope),
        renderChanges(t, change.metadata.changes, scope).join("; "),
      ) ?? ""
    );
  }

  const summary = briefingItemSummary(t, lang, change).trim();
  if (summary) return summary;
  // A label-only project change (run sheet, conductor swap) carries no diff text.
  return change.field ? changeLabel(t, change.field) : "";
};

/** How many recipients the summary names before the rest becomes a count. */
const NAME_PREVIEW_LIMIT = 8;

const CASTING_KIND_FALLBACK: Record<string, string> = {
  CREATED: "Nowa partia",
  CHANGED: "Zmiana w partii",
  REMOVED: "Partia zabrana",
};

/** Who a line reaches: the person for a personal change, or a headcount for a
 *  broadcast. The removed singer's name is the point of the line, never a detail. */
const lineAudience = (t: TFunc, change: AnnouncementChange): string =>
  change.recipient_name ||
  t("projects.announce.recipient_count", {
    count: change.recipient_count,
    defaultValue: "{{count}} osób",
  });

export const AnnouncementReviewSheet = ({
  isOpen,
  projectId,
  projectTitle,
  onClose,
}: AnnouncementReviewSheetProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "pl";

  // The conductor's ticks, as change ids. They drive the request; the row ids those
  // lines stand for are what the server actually holds back. Kept locally as well
  // so a checkbox answers instantly while the recount is in flight.
  const [heldIds, setHeldIds] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<string>("");
  const [confirmDiscard, setConfirmDiscard] = useState<boolean>(false);

  const hasNote = note.trim().length > 0;

  // Resolved against the previous response, because the request has to name rows
  // and only the response knows which rows a line stands for.
  const [excludeRowIds, setExcludeRowIds] = useState<readonly string[]>([]);

  const review = useAnnouncementReview(projectId, {
    enabled: isOpen,
    exclude: excludeRowIds,
    hasNote,
  });
  const publish = usePublishAnnouncements(projectId);
  const discard = useDiscardAnnouncements(projectId);

  const data = review.data;

  const grouped = useMemo(() => groupBySection(data?.changes ?? []), [data]);

  // The note travels inside a briefing and nowhere else, so a selection that folds
  // nothing has no envelope to carry it. The server already answers this: with the
  // note's presence applied, `briefing_count` is exactly how many readers would
  // receive it.
  const noteHasNowhereToGo = hasNote && data?.briefing_count === 0;

  // Every pending removal, held or not: discarding the queue drops the held rows
  // too, so the warning has to name everyone it would silence.
  const removedNames = useMemo(
    () =>
      (data?.changes ?? [])
        .filter((change) => change.subject_type === "PARTICIPATION")
        .map((change) => change.recipient_name)
        .filter(Boolean),
    [data],
  );

  const toggle = (change: AnnouncementChange): void => {
    const next = new Set(heldIds);
    if (next.has(change.id)) next.delete(change.id);
    else next.add(change.id);
    setHeldIds(next);
    setExcludeRowIds(
      (data?.changes ?? [])
        .filter((line) => next.has(line.id))
        .flatMap((line) => line.row_ids),
    );
  };

  const reset = (): void => {
    setHeldIds(new Set());
    setExcludeRowIds([]);
    setNote("");
    setConfirmDiscard(false);
  };

  const handlePublish = async (): Promise<void> => {
    const toastId = toast.loading(
      t("projects.announce.publishing", "Wysyłanie…"),
    );
    try {
      const result = await publish.mutateAsync({
        note: note.trim(),
        exclude: excludeRowIds,
      });
      toast.success(
        t("projects.announce.published", {
          count: result.messages,
          defaultValue: "Wysłano {{count}} wiadomości.",
        }),
        { id: toastId },
      );
      reset();
      onClose();
    } catch {
      toast.error(
        t("projects.announce.publish_error", "Nie udało się wysłać kolejki."),
        { id: toastId },
      );
    }
  };

  const handleDiscard = async (): Promise<void> => {
    const toastId = toast.loading(
      t("projects.announce.discarding", "Odrzucanie…"),
    );
    try {
      await discard.mutateAsync();
      toast.success(
        t("projects.announce.discarded", "Kolejka odrzucona — nic nie wyszło."),
        { id: toastId },
      );
      reset();
      onClose();
    } catch {
      toast.error(
        t("projects.announce.discard_error", "Nie udało się odrzucić kolejki."),
        { id: toastId },
      );
    }
  };

  const messageCount = data?.message_count ?? 0;
  const isBusy = publish.isPending || discard.isPending;
  const isEmpty = data ? data.changes.length === 0 : false;

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={isBusy ? () => undefined : onClose}
        title={t("projects.announce.title", "Do ogłoszenia")}
        subtitle={projectTitle}
        headerBadge={
          data && data.changes.length > 0 ? (
            <Badge variant="warning">
              {t("projects.announce.change_count", {
                count: data.changes.length,
                defaultValue: "{{count}} zmian",
              })}
            </Badge>
          ) : undefined
        }
        footer={
          !isEmpty && data ? (
            <div className="flex items-center justify-between gap-3">
              {/* Always behind a confirm: abandoning the queue cannot be undone,
                  and when it holds a cast removal the confirm names that person. */}
              <Button
                variant="ghost"
                size="touch"
                onClick={() => setConfirmDiscard(true)}
                disabled={isBusy}
                leftIcon={<Trash2 size={15} aria-hidden="true" />}
              >
                <span className="text-ethereal-crimson">
                  {t("projects.announce.discard", "Odrzuć")}
                </span>
              </Button>
              <Button
                variant="primary"
                size="touch"
                onClick={handlePublish}
                isLoading={publish.isPending}
                disabled={isBusy || messageCount === 0}
                leftIcon={<Send size={15} aria-hidden="true" />}
              >
                {messageCount === 0
                  ? t("projects.announce.nothing_selected", "Nic nie wybrano")
                  : /* `n`, not `count`: the number stands in brackets and agrees
                       with nothing, so it needs no plural forms in any language. */
                    t("projects.announce.publish", {
                      n: messageCount,
                      defaultValue: "Wyślij ({{n}})",
                    })}
              </Button>
            </div>
          ) : undefined
        }
      >
        {review.isPending && (
          <div className="flex min-h-48 items-center justify-center">
            <EtherealLoader fullHeight={false} />
          </div>
        )}

        {review.isError && (
          <Text size="sm" className="text-ethereal-crimson">
            {t(
              "projects.announce.load_error",
              "Nie udało się wczytać kolejki ogłoszeń.",
            )}
          </Text>
        )}

        {isEmpty && (
          <StatePanel
            icon={<Inbox size={24} aria-hidden="true" />}
            eyebrow={t("projects.announce.eyebrow", "Kolejka ogłoszeń")}
            title={t("projects.announce.empty_title", "Nic nie czeka")}
            description={t(
              "projects.announce.empty_desc",
              "Obsada wie już o wszystkim, co zapisano. Kolejne zmiany zbiorą się tutaj do jednej wiadomości.",
            )}
          />
        )}

        {data && !isEmpty && (
          <div className="flex flex-col gap-6 pt-1">
            <Caption color="muted" className="flex items-start gap-2">
              <Megaphone
                size={14}
                className="mt-0.5 shrink-0 text-ethereal-gold"
                aria-hidden="true"
              />
              {t(
                "projects.announce.intro",
                "Obsada widzi już aktualne dane w aplikacji. To jedna wiadomość dla tych, którzy nie zaglądają — odznacz, co ma jeszcze poczekać.",
              )}
            </Caption>

            {SECTION_ORDER.map((key) => {
              const lines = grouped[key];
              return lines && lines.length > 0 ? (
                <ChangeSection
                  key={key}
                  sectionKey={key}
                  changes={lines}
                  heldIds={heldIds}
                  onToggle={toggle}
                  t={t}
                  lang={lang}
                />
              ) : null;
            })}

            <RecipientSummary review={data} t={t} />

            <div>
              <Textarea
                label={t("projects.announce.note_label", "Słowo od dyrygenta (opcjonalnie)")}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder={t(
                  "projects.announce.note_placeholder",
                  "np. Prosimy o punktualność — zaczynamy równo.",
                )}
              />
              {/* A note only rides in a briefing, and a cast removal never folds
                  into one — so a queue holding nothing but removals has nowhere to
                  put it. Said out loud rather than dropped on send: silently
                  swallowing something the conductor wrote is the worst option. */}
              <Caption
                color={noteHasNowhereToGo ? "crimson" : "muted"}
                className="mt-1.5 block"
              >
                {noteHasNowhereToGo
                  ? t(
                      "projects.announce.note_undeliverable",
                      "Ten dopisek nigdzie nie trafi — w kolejce jest tylko wypisanie z obsady, które zawsze idzie osobno. Napisz do tej osoby bezpośrednio.",
                    )
                  : t(
                      "projects.announce.note_hint",
                      "Dopisek trafia na początek wiadomości. Gdy go dodasz, każdy dostaje jeden zbiorczy briefing.",
                    )}
              </Caption>
            </div>
          </div>
        )}
      </BottomSheet>

      <ConfirmModal
        isOpen={confirmDiscard}
        isDestructive
        title={t("projects.announce.discard_title", "Odrzucić całą kolejkę?")}
        description={
          data?.has_cast_removal
            ? t("projects.announce.discard_removal_warning", {
                names: removedNames.join(", "),
                defaultValue:
                  "W kolejce jest skreślenie z obsady: {{names}}. Po odrzuceniu zmiana zostaje w bazie, ale nikt się o niej nie dowie. Odrzucić mimo to?",
              })
            : t(
                "projects.announce.discard_desc",
                "Zapisane zmiany zostaną — zniknie tylko powiadomienie o nich. Tej akcji nie da się cofnąć.",
              )
        }
        confirmText={t("projects.announce.discard_confirm", "Odrzuć kolejkę")}
        cancelText={t("common.actions.cancel", "Anuluj")}
        onConfirm={() => {
          setConfirmDiscard(false);
          void handleDiscard();
        }}
        onCancel={() => setConfirmDiscard(false)}
        isLoading={discard.isPending}
      />
    </>
  );
};

interface ChangeSectionProps {
  sectionKey: SectionKey;
  changes: AnnouncementChange[];
  heldIds: Set<string>;
  onToggle: (change: AnnouncementChange) => void;
  t: TFunc;
  lang: string;
}

const ChangeSection = ({
  sectionKey,
  changes,
  heldIds,
  onToggle,
  t,
  lang,
}: ChangeSectionProps): React.JSX.Element => {
  const meta = SECTION_META[sectionKey];
  return (
    <section className="flex flex-col gap-2">
      <Eyebrow
        color={meta.danger ? "crimson" : "muted"}
        className="flex items-center gap-1.5"
      >
        {meta.danger && <UserMinus size={12} aria-hidden="true" />}
        {t(meta.titleKey, meta.fallback)}
      </Eyebrow>
      <ul className="flex flex-col gap-1.5">
        {changes.map((change) => (
          <ChangeRow
            key={change.id}
            change={change}
            // The server can hold more than was ticked: unticking a rehearsal's
            // creation holds its later edits too, since announcing a move to a
            // rehearsal nobody has heard of would be worse than saying nothing.
            // The union shows that cascade instead of hiding it.
            held={heldIds.has(change.id) || change.is_held}
            danger={Boolean(meta.danger)}
            onToggle={() => onToggle(change)}
            t={t}
            lang={lang}
          />
        ))}
      </ul>
    </section>
  );
};

interface ChangeRowProps {
  change: AnnouncementChange;
  held: boolean;
  danger: boolean;
  onToggle: () => void;
  t: TFunc;
  lang: string;
}

const ChangeRow = ({
  change,
  held,
  danger,
  onToggle,
  t,
  lang,
}: ChangeRowProps): React.JSX.Element => {
  const title = lineTitle(t, lang, change);
  const audience = lineAudience(t, change);
  const isAlarm = change.level === "URGENT";

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-nested border p-3 transition-colors",
        held
          ? "border-hairline bg-ethereal-ink/2 opacity-55"
          : danger
            ? "border-ethereal-crimson/25 bg-ethereal-crimson/5"
            : "border-ethereal-incense/15 bg-ethereal-alabaster/60",
      )}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
        <Checkbox
          checked={!held}
          onChange={onToggle}
          className="mt-0.5"
          aria-label={t("projects.announce.toggle_line", "Wyślij tę zmianę")}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <Text
              as="span"
              size="sm"
              weight="medium"
              className={cn(
                "min-w-0",
                held && "line-through decoration-ethereal-graphite/40",
              )}
            >
              {title}
            </Text>
            {isAlarm && !held && (
              <Badge variant="danger" className="shrink-0">
                {t("projects.announce.urgent", "Pilne")}
              </Badge>
            )}
          </span>
          <Caption
            color="muted"
            className="mt-0.5 flex items-center gap-1 tabular-nums"
          >
            <Users size={11} aria-hidden="true" />
            {audience}
          </Caption>
        </span>
      </label>
    </li>
  );
};

interface RecipientSummaryProps {
  review: AnnouncementReview;
  t: TFunc;
}

/** The publication seen from the readers' side: how many messages leave, how many
 *  of those are folded briefings, and who is on the list. Every figure is the
 *  server's, computed by the same plan that will do the fanning out. */
const RecipientSummary = ({
  review,
  t,
}: RecipientSummaryProps): React.JSX.Element => {
  if (review.message_count === 0) {
    return (
      <Caption color="muted" className="rounded-nested bg-ethereal-ink/2 p-3">
        {t(
          "projects.announce.nothing_leaves",
          "Nic nie wyjdzie — wszystkie zmiany są wstrzymane.",
        )}
      </Caption>
    );
  }

  // A full choir is forty-odd names; the list is here to be recognised, not read,
  // so it names a handful and counts the rest.
  const allNames = review.recipients
    .map((recipient) => recipient.name)
    .filter(Boolean);
  const names =
    allNames.length > NAME_PREVIEW_LIMIT
      ? [
          ...allNames.slice(0, NAME_PREVIEW_LIMIT),
          t("projects.announce.summary_more", {
            n: allNames.length - NAME_PREVIEW_LIMIT,
            defaultValue: "i jeszcze {{n}}",
          }),
        ]
      : allNames;

  return (
    <div className="flex flex-col gap-1.5 rounded-nested border border-ethereal-gold/20 bg-ethereal-gold/6 p-3.5">
      <Text size="sm" weight="medium" color="graphite">
        {t("projects.announce.summary_headline", {
          count: review.message_count,
          defaultValue: "Wyjdzie {{count}} wiadomości",
        })}
        {review.briefing_count > 0 &&
          " · " +
            t("projects.announce.summary_briefings", {
              count: review.briefing_count,
              defaultValue: "w tym {{count}} zbiorczych",
            })}
      </Text>
      {names.length > 0 && <Caption color="muted">{names.join(", ")}</Caption>}
    </div>
  );
};

const groupBySection = (
  changes: AnnouncementChange[],
): Partial<Record<SectionKey, AnnouncementChange[]>> => {
  const grouped: Partial<Record<SectionKey, AnnouncementChange[]>> = {};
  for (const change of changes) {
    const key = change.subject_type as SectionKey;
    (grouped[key] ??= []).push(change);
  }
  return grouped;
};
