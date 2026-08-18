/**
 * @file CrewTab.tsx
 * @description Who runs this concert from the technical side: the booked crew
 * on the left, the collaborator base still available on the right.
 * It is the same two-pane transfer board as Program and Obsada, and now the
 * same row language and search placement — it used to be a form column beside
 * a list, a third composition for a job the hub already does twice.
 * Every write is immediate; the shared `AutosaveStatus` pill confirms it.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/CrewTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, UsersRound, Wrench } from "lucide-react";

import { AutosaveStatus } from "@/shared/ui/composites/AutosaveStatus";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { TabLoadingCard } from "./components/TabLoadingCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Eyebrow } from "@/shared/ui/primitives/typography";
import { useCrewAssignments } from "../hooks/useCrewAssignments";
import { CrewRow } from "./components/CrewRow";
import { ListGroupHeader } from "./components/ListGroupHeader";
import { PickerRow } from "./components/PickerRow";

interface CrewTabProps {
  readonly projectId: string;
}

/**
 * What the call sheet prints under "Pokrycie crew". A confirmed booking is the
 * achievement, so it is the figure that appears; the tentative remainder only
 * shows up while there is one, because a rail that reads "0 wstępnie" on a
 * finished crew states the resting case in the loudest slot the card has.
 */
function CoverageRail({
  total,
  confirmed,
}: {
  readonly total: number;
  readonly confirmed: number;
}): React.JSX.Element {
  const { t } = useTranslation();
  const tentative = total - confirmed;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      {confirmed > 0 && (
        <Eyebrow as="span" color="sage">
          {t("projects.crew.footer.confirmed", "Potwierdzonych: {{count}}", {
            count: confirmed,
          })}
        </Eyebrow>
      )}
      {tentative > 0 && (
        <Eyebrow as="span" color="gold">
          {t("projects.crew.footer.tentative", "Wstępnie: {{count}}", {
            count: tentative,
          })}
        </Eyebrow>
      )}
    </div>
  );
}

export const CrewTab = ({ projectId }: CrewTabProps): React.JSX.Element => {
  const { t } = useTranslation();
  const {
    isLoading,
    isMutating,
    crewGroups,
    poolGroups,
    crewCount,
    poolCount,
    confirmedCount,
    isBaseExhausted,
    searchQuery,
    setSearchQuery,
    processingId,
    assign,
    remove,
    setRole,
    setConfirmed,
  } = useCrewAssignments(projectId);

  const isSearching = searchQuery.trim().length > 0;

  if (isLoading) {
    return (
      <TabLoadingCard
        icon={<Wrench size={15} aria-hidden="true" />}
        title={t("projects.crew.sections.assigned", "Ekipa techniczna")}
      />
    );
  }

  return (
    <div className="flex w-full flex-col pb-8">
      <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-5 lg:items-start">
        {/* ── The booked crew ──────────────────────────────────────────────── */}
        <SectionCard
          as="h2"
          scroll
          className="max-h-[70dvh] lg:col-span-3"
          bodyClassName="p-0 [scrollbar-gutter:stable]"
          icon={<Wrench size={15} aria-hidden="true" />}
          title={t("projects.crew.sections.assigned", "Ekipa techniczna")}
          action={<Badge variant="neutral">{crewCount}</Badge>}
          footer={
            crewCount > 0 ? (
              <CoverageRail total={crewCount} confirmed={confirmedCount} />
            ) : undefined
          }
        >
          {crewCount > 0 ? (
            crewGroups.map((group) => (
              <section key={group.key}>
                <ListGroupHeader
                  label={group.label}
                  count={group.entries.length}
                  icon={<group.Icon size={12} aria-hidden="true" />}
                />
                <ul className="divide-y divide-hairline">
                  <AnimatePresence initial={false}>
                    {group.entries.map((entry) => (
                      <CrewRow
                        key={entry.assignmentId}
                        entry={entry}
                        isBusy={processingId === entry.assignmentId}
                        onSetRole={(role) =>
                          void setRole(entry.assignmentId, role)
                        }
                        onToggleConfirmed={() =>
                          void setConfirmed(
                            entry.assignmentId,
                            entry.status !== "CON",
                          )
                        }
                        onRemove={() => void remove(entry.assignmentId)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            ))
          ) : (
            <StatePanel
              variant="inline"
              className="px-5 py-10"
              icon={<Wrench size={26} aria-hidden="true" />}
              title={t("projects.crew.empty_assigned", "Nikt jeszcze nie obsługuje tego wydarzenia")}
              description={t(
                "projects.crew.empty_assigned_desc",
                "Zatrudnij współpracowników z bazy — ekipa nie dostaje kont ani powiadomień, to notatka produkcyjna dla dyrygenta.",
              )}
            />
          )}
        </SectionCard>

        {/* ── The collaborator base (pinned on desktop) ─────────────────────── */}
        <SectionCard
          as="h2"
          scroll
          className="max-h-[70dvh] lg:col-span-2 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-9rem)]"
          bodyClassName="p-0 pt-2 [scrollbar-gutter:stable]"
          icon={<UsersRound size={15} aria-hidden="true" />}
          title={t("projects.crew.sections.available", "Baza współpracowników")}
          action={<Badge variant="neutral">{poolCount}</Badge>}
          toolbar={
            <Input
              type="text"
              placeholder={t(
                "projects.crew.search_placeholder",
                "Szukaj po nazwisku, firmie lub specjalizacji...",
              )}
              aria-label={t(
                "projects.crew.search_placeholder",
                "Szukaj po nazwisku, firmie lub specjalizacji...",
              )}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              leftIcon={<Search size={16} aria-hidden="true" />}
            />
          }
        >
          {poolCount > 0 ? (
            poolGroups.map((group) => (
              <section key={group.key}>
                <ListGroupHeader
                  label={group.label}
                  count={group.entries.length}
                  icon={<group.Icon size={12} aria-hidden="true" />}
                />
                <ul className="divide-y divide-hairline">
                  {group.entries.map((entry) => (
                    <PickerRow
                      key={entry.collaboratorId}
                      title={entry.displayName}
                      meta={entry.company}
                      isBusy={processingId === entry.collaboratorId}
                      onPick={() => void assign(entry.collaboratorId)}
                      pickLabel={t(
                        "projects.crew.card.add_aria",
                        "Dodaj {{name}} do ekipy",
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
                  <UsersRound size={24} aria-hidden="true" />
                )
              }
              title={
                isSearching
                  ? t("projects.crew.empty_no_matches", "Brak wyników")
                  : isBaseExhausted
                    ? t("projects.crew.empty_base", "Baza współpracowników jest pusta")
                    : t(
                        "projects.crew.empty_available",
                        "Cała baza jest już w ekipie",
                      )
              }
              // The base is managed outside the project, so an empty one is a
              // dead end here unless the card says where it is filled.
              actions={
                !isSearching && isBaseExhausted ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/panel/crew">
                      {t("projects.crew.empty_base_action", "Otwórz bazę")}
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          )}
        </SectionCard>
      </div>

      <AutosaveStatus isSaving={isMutating} />
    </div>
  );
};
