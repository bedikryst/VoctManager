/**
 * @file CastTab.tsx
 * @description Who sings this project: the cast on the left, the roster still
 * available on the right. It is the same two-pane transfer board as the Program
 * tab and now shares its row language, its picker and its search placement —
 * the two used to read as two different products doing one job.
 * Every write is immediate; the shared `AutosaveStatus` pill confirms it.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/CastTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { motion } from "framer-motion";
import { Search, Star, Trash2, UserCheck, Users } from "lucide-react";

import type { Project } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { TabLoadingCard } from "./components/TabLoadingCard";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { AutosaveStatus } from "@/shared/ui/composites/AutosaveStatus";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Input } from "@/shared/ui/primitives/Input";
import { Select, type SelectOption } from "@/shared/ui/primitives/Select";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { PROJECT_STATUS } from "../../constants/projectDomain";
import {
  useCastTab,
  type CastBalanceEntry,
  type CastEntry,
} from "../hooks/useCastTab";
import { ListGroupHeader } from "./components/ListGroupHeader";
import { PickerRow } from "./components/PickerRow";

interface CastTabProps {
  readonly project: Project;
}

/**
 * The second line of a roster row: range · sight-reading. It used to be two
 * icon-prefixed pills, which put sixty glyphs on a screen whose content is
 * forty names.
 */
const buildSingerMeta = (
  entry: { rangeLabel: string | null; sightReading: number | null },
  t: TFunction,
): string | null => {
  const parts = [
    entry.rangeLabel,
    entry.sightReading !== null
      ? t("projects.cast.card.a_vista", "a vista {{score}}/5", {
          score: entry.sightReading,
        })
      : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" · ") : null;
};

interface CastRowProps {
  readonly entry: CastEntry;
  /**
   * Whether an answer is worth printing. Before publication nobody has been
   * asked, so "Zaproszony" on all forty rows states the resting case in the
   * loudest chip the vocabulary has — and buries the one person who declined.
   */
  readonly showAnswerState: boolean;
  readonly isBusy: boolean;
  readonly seatOptions: readonly SelectOption[];
  readonly onSeatChange: (seat: string) => void;
  readonly onToggleLeader: () => void;
  readonly onRemove: () => void;
}

function CastRow({
  entry,
  showAnswerState,
  isBusy,
  seatOptions,
  onSeatChange,
  onToggleLeader,
  onRemove,
}: CastRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const meta = buildSingerMeta(entry, t);

  const isDeclined = entry.status === "DEC";
  const isAwaiting = showAnswerState && entry.status === "INV";

  const removeLabel = t(
    "projects.cast.card.remove_aria",
    "Usuń {{name}} z obsady",
    {
      name: entry.displayName,
    },
  );

  /* Named for the job, not for the person doing it: Polish inflects "lider" by
     gender and the roster does not record one, so "liderka" on a man's row (or
     the reverse) is a mistake the copy would make on its own. The verbal noun
     sidesteps it, and `aria-pressed` carries the on/off state. */
  const leaderLabel = t(
    "projects.cast.leader.aria",
    "Prowadzenie sekcji: {{name}}",
    { name: entry.displayName },
  );

  return (
    <motion.li
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "group/cast flex items-center gap-3 px-5 py-2.5 transition-colors",
        isDeclined ? "bg-ethereal-crimson/4" : "hover:bg-ethereal-ink/3",
        isBusy && "opacity-50",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <Text
            as="span"
            size="sm"
            weight="medium"
            truncate
            color={
              isDeclined ? "crimson" : entry.isUnresolved ? "muted" : "graphite"
            }
            className={entry.isUnresolved ? "italic" : undefined}
          >
            {entry.displayName}
          </Text>
          {isDeclined && (
            <Badge variant="danger" className="shrink-0">
              {t("projects.cast.card.declined", "Odmowa")}
            </Badge>
          )}
          {isAwaiting && (
            <Badge variant="outline" className="shrink-0">
              {t("projects.cast.card.pending", "Czeka")}
            </Badge>
          )}
        </span>
        {meta && (
          <Caption as="span" color="muted" className="truncate">
            {meta}
          </Caption>
        )}
      </span>

      {/* Their standing place in this concert. Empty is a real answer — the
          automatic fill then reads it from their voice type, which is all an
          undivided family ever needs. */}
      <div className="w-28 shrink-0 sm:w-36">
        <Select
          size="sm"
          options={seatOptions}
          value={entry.seat}
          onValueChange={onSeatChange}
          disabled={isBusy || isDeclined}
          placeholder={t("projects.cast.seat.placeholder", "Z typu głosu")}
          clearLabel={t("projects.cast.seat.clear", "Z typu głosu")}
          ariaLabel={t(
            "projects.cast.seat.aria",
            "Miejsce w składzie: {{name}}",
            { name: entry.displayName },
          )}
        />
      </div>

      {/* Marker and control in one: the filled star says who leads the section
          and pressing it is how that is set. A separate badge would state the
          same fact twice on the one row that is already the busiest here. */}
      <button
        type="button"
        onClick={onToggleLeader}
        disabled={isBusy || isDeclined}
        aria-pressed={entry.isSectionLeader}
        title={leaderLabel}
        aria-label={leaderLabel}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-chip transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
          "pointer-coarse:h-9 pointer-coarse:w-9",
          entry.isSectionLeader
            ? "text-ethereal-gold"
            : "text-ethereal-graphite/25 hover:bg-ethereal-gold/10 hover:text-ethereal-gold",
        )}
      >
        <Star
          size={14}
          aria-hidden="true"
          fill={entry.isSectionLeader ? "currentColor" : "none"}
        />
      </button>

      <button
        type="button"
        onClick={onRemove}
        disabled={isBusy}
        title={removeLabel}
        aria-label={removeLabel}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-chip text-ethereal-graphite/35 transition-colors",
          "hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
          "pointer-coarse:h-9 pointer-coarse:w-9",
        )}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </motion.li>
  );
}

/**
 * The question this tab could not answer: is the ensemble balanced? A voice
 * type reads gold at zero only when the roster actually holds candidates for
 * it — nobody cast with nobody available is an ensemble without that voice,
 * not a hole in the casting.
 */
function BalanceRail({
  balance,
}: {
  balance: readonly CastBalanceEntry[];
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      {balance.map((entry) => {
        const isGap = entry.castCount === 0 && entry.poolCount > 0;
        return (
          <span
            key={entry.voiceType}
            className="inline-flex items-baseline gap-1.5"
          >
            <Eyebrow as="span" size="overline-sm" color="muted">
              {entry.label}
            </Eyebrow>
            <Text
              as="span"
              size="base"
              weight="medium"
              color={isGap ? "gold" : "graphite"}
            >
              {entry.castCount}
            </Text>
          </span>
        );
      })}
    </div>
  );
}

export const CastTab = ({ project }: CastTabProps): React.JSX.Element => {
  const { t } = useTranslation();
  const {
    isLoading,
    castSections,
    poolSections,
    castCount,
    poolCount,
    castBalance,
    seatOptions,
    setSeat,
    setSectionLeader,
    isSaving,
    searchQuery,
    setSearchQuery,
    processingId,
    mobileView,
    setMobileView,
    addToCast,
    removeFromCast,
  } = useCastTab(String(project.id));

  const showAnswerState = project.status !== PROJECT_STATUS.DRAFT;
  const isSearching = searchQuery.trim().length > 0;

  if (isLoading) {
    return (
      <TabLoadingCard
        icon={<UserCheck size={15} aria-hidden="true" />}
        title={t("projects.cast.sections.assigned", "Obsada projektu")}
      />
    );
  }

  return (
    <div className="flex w-full flex-col pb-8">
      <div className="mb-5 shrink-0 lg:hidden">
        <SegmentedTabs
          value={mobileView}
          onChange={setMobileView}
          ariaLabel={t(
            "projects.cast.mobile.switch_aria",
            "Przełącz listę obsady",
          )}
          items={[
            {
              id: "ASSIGNED",
              label: `${t("projects.cast.mobile.assigned", "Obsada")} (${castCount})`,
              Icon: UserCheck,
            },
            {
              id: "AVAILABLE",
              label: `${t("projects.cast.mobile.available", "Baza")} (${poolCount})`,
              Icon: Users,
            },
          ]}
        />
      </div>

      <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-5 lg:items-start">
        {/* ── The cast ─────────────────────────────────────────────────────── */}
        <SectionCard
          as="h2"
          scroll
          className={cn(
            "max-h-[70dvh] lg:col-span-3",
            mobileView === "ASSIGNED" ? "flex" : "hidden lg:flex",
          )}
          bodyClassName="p-0 [scrollbar-gutter:stable]"
          icon={<UserCheck size={15} aria-hidden="true" />}
          title={t("projects.cast.sections.assigned", "Obsada projektu")}
          action={<Badge variant="neutral">{castCount}</Badge>}
          toolbar={
            castCount > 0 ? (
              <div className="pb-3">
                {/* Both controls in one sentence, because both are quiet: the
                    seat now also decides the order of this list, and the star
                    is the only thing on the row that does not name itself. */}
                <Caption color="muted">
                  {t(
                    "projects.cast.seat.hint",
                    "Miejsce w składzie mówi, na którą linię trafi śpiewak przy automatycznym uzupełnianiu divisi — i porządkuje tę listę. Gwiazdką oznacz osobę prowadzącą sekcję.",
                  )}
                </Caption>
              </div>
            ) : undefined
          }
          footer={
            castCount > 0 && castBalance.length > 0 ? (
              <BalanceRail balance={castBalance} />
            ) : undefined
          }
        >
          {castCount > 0 ? (
            castSections.map((section) => (
              <section key={section.key}>
                <ListGroupHeader
                  label={section.label}
                  count={section.entries.length}
                />
                <ul className="divide-y divide-hairline">
                  {section.entries.map((entry) => (
                    <CastRow
                      key={entry.participationId}
                      entry={entry}
                      showAnswerState={showAnswerState}
                      isBusy={processingId === entry.artistId}
                      seatOptions={seatOptions}
                      onSeatChange={(seat) =>
                        void setSeat(entry.participationId, seat)
                      }
                      onToggleLeader={() =>
                        void setSectionLeader(
                          entry.participationId,
                          !entry.isSectionLeader,
                        )
                      }
                      onRemove={() =>
                        void removeFromCast(
                          entry.artistId,
                          entry.participationId,
                        )
                      }
                    />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <StatePanel
              variant="inline"
              className="px-5 py-10"
              icon={<UserCheck size={26} aria-hidden="true" />}
              title={t("projects.cast.empty_assigned", "Obsada jest pusta")}
              description={t(
                "projects.cast.empty_assigned_desc",
                "Dodaj śpiewaków z bazy, aby zbudować obsadę projektu.",
              )}
            />
          )}
        </SectionCard>

        {/* ── The roster still available (pinned on desktop) ────────────────── */}
        <SectionCard
          as="h2"
          scroll
          className={cn(
            "max-h-[70dvh] lg:col-span-2 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-9rem)]",
            mobileView === "AVAILABLE" ? "flex" : "hidden lg:flex",
          )}
          bodyClassName="p-0 pt-2 [scrollbar-gutter:stable]"
          icon={<Users size={15} aria-hidden="true" />}
          title={t("projects.cast.sections.available", "Baza artystów")}
          action={<Badge variant="neutral">{poolCount}</Badge>}
          toolbar={
            <Input
              type="text"
              placeholder={t(
                "projects.cast.search_placeholder",
                "Szukaj artysty...",
              )}
              aria-label={t(
                "projects.cast.search_placeholder",
                "Szukaj artysty...",
              )}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              leftIcon={<Search size={16} aria-hidden="true" />}
            />
          }
        >
          {poolCount > 0 ? (
            poolSections.map((section) => (
              <section key={section.key}>
                <ListGroupHeader
                  label={section.label}
                  count={section.entries.length}
                />
                <ul className="divide-y divide-hairline">
                  {section.entries.map((entry) => (
                    <PickerRow
                      key={entry.artistId}
                      title={entry.displayName}
                      meta={buildSingerMeta(entry, t)}
                      isBusy={processingId === entry.artistId}
                      onPick={() => void addToCast(entry.artistId)}
                      pickLabel={t(
                        "projects.cast.card.add_aria",
                        "Dodaj {{name}} do obsady",
                        { name: entry.displayName },
                      )}
                    />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <StatePanel
              variant="inline"
              className="px-5 py-10"
              icon={
                isSearching ? (
                  <Search size={24} aria-hidden="true" />
                ) : (
                  <Users size={24} aria-hidden="true" />
                )
              }
              title={
                isSearching
                  ? t("projects.cast.empty_no_matches", "Brak wyników")
                  : t(
                      "projects.cast.empty_available",
                      "Cały zespół jest w obsadzie",
                    )
              }
            />
          )}
        </SectionCard>
      </div>

      <AutosaveStatus isSaving={isSaving} />
    </div>
  );
};
