/**
 * @file PlanAttendanceStrip.tsx
 * @description Who is actually coming, over the plan editor: per section
 * letter "expected / called" — the seats the rehearsal calls, less those who
 * reported they will not come — so the conductor lays out the evening for
 * the room he will have, not the one he summoned. A seat counts toward each
 * of its letters, as the call does (a mezzo is in S and in A); the players
 * are a figure of their own when the rehearsal calls any. "Not coming" is an
 * absence of either kind — reported by the singer (`ABSENT`) or entered as
 * excused by a manager (`EXCUSED`); a late arrival still comes. A sectional
 * called by rule shows only the sections it calls: a mezzo called as a
 * soprano does not make the altos a section of the evening. Read-only, off
 * the flat attendance register the roll call writes, so an absence reported
 * while the sheet is open moves the figure on the next refetch.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/PlanAttendanceStrip
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { isInstrumentalist } from "@/shared/lib/voiceTypes";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import {
  SECTION_LETTERS,
  sectionLettersOfSeat,
  type SectionLetter,
} from "@/features/projects/lib/voiceFamilies";
import type { Attendance, Participation, Rehearsal } from "@/shared/types";
import { resolveInvited } from "../../lib/attendanceStats";
import { sectionNamesLabel } from "../../lib/sectionLabels";

interface PlanAttendanceStripProps {
  readonly rehearsal: Rehearsal;
  /** The project's seats still in play — declined pruned. */
  readonly participations: readonly Participation[];
  readonly attendances: readonly Attendance[];
}

interface Figure {
  readonly key: SectionLetter | "players";
  readonly label: string;
  readonly name: string;
  readonly expected: number;
  readonly called: number;
}

export const PlanAttendanceStrip = ({
  rehearsal,
  participations,
  attendances,
}: PlanAttendanceStripProps): React.JSX.Element | null => {
  const { t } = useTranslation();

  const figures = useMemo<Figure[]>(() => {
    const rehearsalId = String(rehearsal.id);
    const notComing = new Set(
      attendances
        .filter(
          (row) =>
            String(row.rehearsal) === rehearsalId &&
            (row.status === "ABSENT" || row.status === "EXCUSED"),
        )
        .map((row) => String(row.participation)),
    );

    const byLetter = new Map<SectionLetter, { expected: number; called: number }>();
    const players = { expected: 0, called: 0 };
    for (const seat of resolveInvited(rehearsal, [...participations])) {
      const coming = !notComing.has(String(seat.id));
      if (isInstrumentalist(seat.artist_voice_type)) {
        players.called += 1;
        if (coming) players.expected += 1;
        continue;
      }
      const letters = sectionLettersOfSeat(
        seat.artist_voice_type ?? null,
        seat.default_voice_line ?? null,
      );
      for (const letter of SECTION_LETTERS) {
        if (!letters.includes(letter)) continue;
        const tally = byLetter.get(letter) ?? { expected: 0, called: 0 };
        tally.called += 1;
        if (coming) tally.expected += 1;
        byLetter.set(letter, tally);
      }
    }

    const byRule =
      (rehearsal.invited_participations ?? []).length === 0
        ? (rehearsal.called_sections ?? "")
        : "";
    const shown: Figure[] = SECTION_LETTERS.flatMap((letter) => {
      const tally = byLetter.get(letter);
      if (!tally || tally.called === 0) return [];
      if (byRule !== "" && !byRule.includes(letter)) return [];
      return [{ key: letter, label: letter, name: sectionNamesLabel(letter, t), ...tally }];
    });
    if (players.called > 0) {
      shown.push({
        key: "players",
        label: t("rehearsals.plan.attendance.players_short", "Instr."),
        name: t("rehearsals.plan.exclude.instrumentalists", "Instrumentaliści"),
        ...players,
      });
    }
    return shown;
  }, [rehearsal, participations, attendances, t]);

  if (figures.length === 0) return null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 pb-3">
      <Eyebrow color="muted">
        {t("rehearsals.plan.attendance.title", "Przyjdzie")}
      </Eyebrow>
      <ul className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {figures.map((figure) => {
          const short = figure.expected < figure.called;
          return (
            <li key={figure.key} className="inline-flex items-baseline gap-1">
              <Caption color="muted" aria-hidden="true">
                {figure.label}
              </Caption>
              <Text
                as="span"
                size="sm"
                color={short ? "default" : "muted"}
                className="tabular-nums"
                aria-hidden="true"
              >
                {figure.expected}/{figure.called}
              </Text>
              <Caption className="sr-only">
                {t("rehearsals.plan.attendance.figure", "{{name}}: przyjdzie {{expected}} z {{called}}", {
                  name: figure.name,
                  expected: figure.expected,
                  called: figure.called,
                })}
              </Caption>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
