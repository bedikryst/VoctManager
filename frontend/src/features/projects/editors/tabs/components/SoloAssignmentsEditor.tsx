/**
 * @file SoloAssignmentsEditor.tsx
 * @description The named solos of the open piece, under its divisi board. Each
 * position is a passage the conductor names ("Soprano — mark 7"), optionally
 * pins to the score, and hands to one performer or leaves open. The picker
 * offers every live singer of the project, seated or not: a solo is added to a
 * singer's choral part, never taken from it, so nothing here touches a chip on
 * the board. Positions may overlap musically and one singer may hold several.
 * Legacy SOLO rows — solos written before positions had names — are listed
 * apart, read-only, with one action: give the passage a name.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/SoloAssignmentsEditor
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, KeyRound, Plus, Trash2 } from "lucide-react";

import type { PieceCasting } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select, type SelectOption } from "@/shared/ui/primitives/Select";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

import type { CastMember } from "../../hooks/useMicroCasting";
import {
  SCORE_REFERENCE_MAX_LENGTH,
  soloPerformerState,
  type SoloCoverage,
  type SoloDraftRow,
} from "../../../lib/soloAssignments";

type SoloRowPatch = Partial<
  Pick<
    SoloDraftRow,
    "label" | "scoreReference" | "participation" | "notes" | "givesPitch"
  >
>;

interface SoloAssignmentsEditorProps {
  readonly rows: readonly SoloDraftRow[];
  readonly legacy: readonly PieceCasting[];
  /** Everyone on the project, in cast order. */
  readonly members: readonly CastMember[];
  readonly memberMap: Map<string, CastMember>;
  readonly coverage: SoloCoverage;
  /** Soloists the piece's divisi declares; a hint, never a quota. */
  readonly declaredCount: number;
  /** The choral line a performer holds on this piece, for the picker. */
  readonly choralLineOf: (participationId: string) => string | null;
  readonly disabled: boolean;
  /** Conversion writes at once, so it waits until the solo draft is clean. */
  readonly canConvert: boolean;
  readonly showLabelErrors: boolean;
  readonly onAdd: () => void;
  readonly onUpdate: (key: string, patch: SoloRowPatch) => void;
  readonly onMove: (key: string, delta: -1 | 1) => void;
  readonly onRemove: (key: string) => void;
  readonly onConvert: (castingId: string, label: string) => Promise<boolean>;
}

const ICON_ACTION =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-ethereal-graphite/55 transition-colors hover:bg-ethereal-incense/10 hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 disabled:pointer-events-none disabled:opacity-30";

export const SoloAssignmentsEditor = ({
  rows,
  legacy,
  members,
  memberMap,
  coverage,
  declaredCount,
  choralLineOf,
  disabled,
  canConvert,
  showLabelErrors,
  onAdd,
  onUpdate,
  onMove,
  onRemove,
  onConvert,
}: SoloAssignmentsEditorProps): React.JSX.Element => {
  const { t } = useTranslation();

  const performerLabel = (member: CastMember): string => {
    const line = choralLineOf(member.participationId);
    return line ? `${member.displayName} · ${line}` : member.displayName;
  };

  const statusOf = (participationId: string) =>
    memberMap.get(participationId)?.status;

  // A declined singer cannot be given a passage; one who declined after being
  // given it, or left the project, stays visible on their row so the
  // conductor sees the hole.
  const optionsFor = (row: SoloDraftRow): SelectOption[] => {
    const options: SelectOption[] = members
      .filter(
        (member) =>
          member.status !== "DEC" || member.participationId === row.participation,
      )
      .map((member) => ({
        value: member.participationId,
        label: performerLabel(member),
        disabled: member.status === "DEC",
      }));
    if (row.participation && !memberMap.has(row.participation)) {
      options.unshift({
        value: row.participation,
        label: row.performerName ?? "—",
        disabled: true,
      });
    }
    return options;
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-strong pb-1.5">
        <div className="flex items-baseline gap-3">
          <Eyebrow color="gold">
            {t("projects.micro_cast.solos.title", "Solówki")}
          </Eyebrow>
          {coverage.total > 0 && (
            <Text
              as="span"
              size="sm"
              weight="medium"
              color={coverage.filled === coverage.total ? "sage" : "gold"}
              className="tabular-nums"
              title={t(
                "projects.micro_cast.solos.coverage_hint",
                "Obsadzone solówki spośród wszystkich nazwanych",
              )}
            >
              {coverage.filled}/{coverage.total}
            </Text>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus size={12} aria-hidden="true" />}
          onClick={onAdd}
          disabled={disabled}
        >
          {t("projects.micro_cast.solos.add", "Dodaj solówkę")}
        </Button>
      </div>

      {declaredCount > coverage.total + coverage.legacy && (
        <Caption color="muted">
          {t(
            "projects.micro_cast.solos.declared",
            "Wymagania utworu przewidują solistów: {{count}}.",
            { count: declaredCount },
          )}
        </Caption>
      )}

      {rows.length === 0 && legacy.length === 0 && (
        <Caption color="muted">
          {t(
            "projects.micro_cast.solos.empty",
            "Solówka dochodzi do partii w chórze — ta sama osoba może śpiewać w swojej linii i mieć kilka solówek.",
          )}
        </Caption>
      )}

      {rows.length > 0 && (
        <ol className="flex flex-col gap-2">
          {rows.map((row, index) => {
            const performerState = soloPerformerState(row.participation, statusOf);
            const hasDeclined = performerState === "declined";
            const hasDeparted = performerState === "departed";
            const isBlank = row.label.trim() === "";

            return (
              <li
                key={row.key}
                className="flex flex-col gap-2 rounded-nested border border-hairline bg-ethereal-alabaster/60 p-3"
              >
                <div className="flex items-start gap-2">
                  <Text
                    as="span"
                    size="xs"
                    weight="bold"
                    className="mt-3 w-5 shrink-0 tabular-nums text-ethereal-gold/70"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </Text>
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input
                      value={row.label}
                      onChange={(event) =>
                        onUpdate(row.key, { label: event.target.value })
                      }
                      maxLength={200}
                      disabled={disabled}
                      hasError={showLabelErrors && isBlank}
                      placeholder={t(
                        "projects.micro_cast.solos.label_placeholder",
                        "Nazwa, np. Sopran solo",
                      )}
                      aria-label={t(
                        "projects.micro_cast.solos.label",
                        "Nazwa solówki",
                      )}
                    />
                    <Input
                      value={row.scoreReference}
                      onChange={(event) =>
                        onUpdate(row.key, {
                          scoreReference: event.target.value,
                        })
                      }
                      maxLength={SCORE_REFERENCE_MAX_LENGTH}
                      disabled={disabled}
                      placeholder={t(
                        "projects.micro_cast.solos.reference_placeholder",
                        "Miejsce w nutach, np. lit. 7, t. 12–20",
                      )}
                      aria-label={t(
                        "projects.micro_cast.solos.reference",
                        "Miejsce w nutach",
                      )}
                    />
                    <Select
                      value={row.participation ?? ""}
                      onValueChange={(value) =>
                        onUpdate(row.key, { participation: value || null })
                      }
                      options={optionsFor(row)}
                      disabled={disabled}
                      placeholder={t(
                        "projects.micro_cast.solos.open",
                        "Nieobsadzona",
                      )}
                      clearLabel={t(
                        "projects.micro_cast.solos.unassign",
                        "Bez wykonawcy",
                      )}
                      ariaLabel={t(
                        "projects.micro_cast.solos.performer",
                        "Wykonawca",
                      )}
                    />
                    <Input
                      value={row.notes}
                      onChange={(event) =>
                        onUpdate(row.key, { notes: event.target.value })
                      }
                      maxLength={200}
                      disabled={disabled}
                      placeholder={t(
                        "projects.micro_cast.solos.notes_placeholder",
                        "Notatka (opcjonalnie)",
                      )}
                      aria-label={t(
                        "projects.micro_cast.solos.notes",
                        "Notatka do solówki",
                      )}
                    />
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-0.5 sm:flex-row">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate(row.key, { givesPitch: !row.givesPitch })
                      }
                      disabled={disabled}
                      aria-pressed={row.givesPitch}
                      title={t("projects.micro_cast.artist.gives_pitch", "Podaje ton")}
                      aria-label={t(
                        "projects.micro_cast.artist.gives_pitch",
                        "Podaje ton",
                      )}
                      className={cn(
                        ICON_ACTION,
                        row.givesPitch && "bg-ethereal-gold/15 text-ethereal-gold",
                      )}
                    >
                      <KeyRound size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(row.key, -1)}
                      disabled={disabled || index === 0}
                      aria-label={t("projects.micro_cast.solos.move_up", "Wyżej")}
                      title={t("projects.micro_cast.solos.move_up", "Wyżej")}
                      className={ICON_ACTION}
                    >
                      <ArrowUp size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(row.key, 1)}
                      disabled={disabled || index === rows.length - 1}
                      aria-label={t("projects.micro_cast.solos.move_down", "Niżej")}
                      title={t("projects.micro_cast.solos.move_down", "Niżej")}
                      className={ICON_ACTION}
                    >
                      <ArrowDown size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(row.key)}
                      disabled={disabled}
                      aria-label={t("projects.micro_cast.solos.remove", "Usuń solówkę")}
                      title={t("projects.micro_cast.solos.remove", "Usuń solówkę")}
                      className={cn(ICON_ACTION, "hover:text-ethereal-crimson")}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {(row.referenceNeedsReview || hasDeclined || hasDeparted) && (
                  <div className="flex flex-col gap-1 pl-7">
                    {row.referenceNeedsReview && (
                      <Caption color="gold">
                        {t(
                          "projects.micro_cast.solos.reference_review",
                          "Program korzysta teraz z innego wydania niż to, do którego wpisano miejsce w nutach — sprawdź je.",
                        )}
                      </Caption>
                    )}
                    {hasDeclined && (
                      <Caption color="gold">
                        {t(
                          "projects.micro_cast.solos.declined",
                          "Wykonawca odmówił udziału — solówka czeka na obsadę.",
                        )}
                      </Caption>
                    )}
                    {hasDeparted && (
                      <Caption color="gold">
                        {t(
                          "projects.micro_cast.solos.departed",
                          "Wykonawca nie należy już do projektu — solówka czeka na obsadę.",
                        )}
                      </Caption>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {legacy.length > 0 && (
        <LegacySoloList
          legacy={legacy}
          memberMap={memberMap}
          disabled={disabled}
          canConvert={canConvert}
          onConvert={onConvert}
        />
      )}
    </section>
  );
};

interface LegacySoloListProps {
  readonly legacy: readonly PieceCasting[];
  readonly memberMap: Map<string, CastMember>;
  readonly disabled: boolean;
  readonly canConvert: boolean;
  readonly onConvert: (castingId: string, label: string) => Promise<boolean>;
}

const LegacySoloList = ({
  legacy,
  memberMap,
  disabled,
  canConvert,
  onConvert,
}: LegacySoloListProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [namingId, setNamingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  const confirm = async (castingId: string): Promise<void> => {
    if (!label.trim()) return;
    if (await onConvert(castingId, label)) {
      setNamingId(null);
      setLabel("");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Caption color="muted">
        {t(
          "projects.micro_cast.solos.legacy_hint",
          "Solówki zapisane, zanim pozycje miały nazwy. Nie wiadomo, którego fragmentu dotyczą — nadaj im nazwę, a wykonawca, notatka i podawanie tonu przejdą bez zmian.",
        )}
      </Caption>
      <ul className="flex flex-col gap-2">
        {legacy.map((casting) => {
          const castingId = String(casting.id);
          const member = memberMap.get(String(casting.participation));
          const name =
            member?.displayName ?? casting.artist_name ?? castingId;
          const isNaming = namingId === castingId;

          return (
            <li
              key={castingId}
              className="flex flex-col gap-2 rounded-nested border border-dashed border-hairline-strong px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="shrink-0">
                  {t("projects.micro_cast.solos.legacy_badge", "Solo bez nazwy")}
                </Badge>
                <Text as="span" size="sm" weight="medium" className="min-w-0 flex-1" truncate>
                  {name}
                </Text>
                {casting.gives_pitch && (
                  <KeyRound
                    size={13}
                    className="shrink-0 text-ethereal-gold"
                    aria-label={t("projects.micro_cast.artist.gives_pitch", "Podaje ton")}
                  />
                )}
                {!isNaming && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNamingId(castingId);
                      setLabel("");
                    }}
                    disabled={disabled || !canConvert}
                    title={
                      canConvert
                        ? undefined
                        : t(
                            "projects.micro_cast.solos.convert_dirty",
                            "Najpierw zapisz albo odrzuć zmiany solówek.",
                          )
                    }
                  >
                    {t("projects.micro_cast.solos.convert", "Nadaj nazwę")}
                  </Button>
                )}
              </div>
              {casting.notes && (
                <Caption color="muted">{casting.notes}</Caption>
              )}
              {member?.status === "DEC" && (
                <Caption color="gold">
                  {t(
                    "projects.micro_cast.solos.legacy_declined",
                    "Wykonawca odmówił udziału — po nadaniu nazwy solówka będzie czekać na obsadę.",
                  )}
                </Caption>
              )}
              {isNaming && (
                <form
                  className="flex flex-wrap items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void confirm(castingId);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <Input
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      maxLength={200}
                      autoFocus
                      disabled={disabled}
                      placeholder={t(
                        "projects.micro_cast.solos.label_placeholder",
                        "Nazwa, np. Sopran solo",
                      )}
                      aria-label={t(
                        "projects.micro_cast.solos.label",
                        "Nazwa solówki",
                      )}
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={disabled || !label.trim()}
                  >
                    {t("projects.micro_cast.solos.convert_confirm", "Zapisz jako solówkę")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setNamingId(null)}
                  >
                    {t("common.actions.cancel", "Anuluj")}
                  </Button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
