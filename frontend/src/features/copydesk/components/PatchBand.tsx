/**
 * @file PatchBand.tsx
 * @description What has been accepted and is still only a decision.
 *
 * It is the half of this screen that keeps the other half honest. Accepting
 * changes nothing on the public site: it says a value is one the reviewer means
 * to commit, and the road from there is `npm run copy:apply` → `git diff` →
 * commit. Without this band the queue would empty as things were settled and
 * the surface would read as publication — which it is not, and a desk that
 * implied otherwise would be lying to the one person who can tell.
 *
 * So the band states facts and one command, and appears only when the pile
 * exists. How long the oldest decision has been waiting is the figure that
 * matters most: it is the only thing on the desk that says the command has been
 * forgotten.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/components/PatchBand
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { GitCommitHorizontal } from "lucide-react";

import { formatRelativeTime } from "@/shared/lib/time/intl";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatLine, type StatLineItem } from "@/shared/ui/composites/StatLine";
import { Caption, Text } from "@/shared/ui/primitives/typography";

import { formatCount } from "../lib/scopeGroups";
import type { CopyDeskPatchSummary } from "../types/copydesk.dto";

/**
 * The two commands that move an accepted value into the repository, in the
 * order they are run. A dry run is the default and `--write` is what touches
 * the disk, so both lines are printed: the flag is the whole difference between
 * looking and writing, and it is not something to remember at a terminal.
 */
const APPLY_COMMANDS = ["npm run copy:apply", "npm run copy:apply -- --write"];

interface PatchBandProps {
  readonly patch: CopyDeskPatchSummary;
}

export const PatchBand = ({ patch }: PatchBandProps): React.JSX.Element | null => {
  const { t, i18n } = useTranslation();
  const language = i18n.language || "pl";

  if (patch.rows === 0) return null;

  const facts: StatLineItem[] = [
    {
      id: "rows",
      value: formatCount(patch.rows, language),
      label: t("copy_desk.queue.patch_rows", {
        count: patch.rows,
        defaultValue: "zmian",
      }),
    },
    {
      id: "pages",
      value: formatCount(patch.scopes.length, language),
      label: t("copy_desk.contents.pages", {
        count: patch.scopes.length,
        defaultValue: "stron",
      }),
    },
  ];

  return (
    <SectionCard
      as="h2"
      title={t("copy_desk.queue.patch_title", "Paczka do wpisania")}
      icon={<GitCommitHorizontal size={15} strokeWidth={1.5} aria-hidden="true" />}
    >
      <div className="flex flex-col gap-2">
        <StatLine stats={facts} />

        <Caption color="muted">
          {patch.scopes
            .map(
              (scope) =>
                `${scope.label} (${formatCount(scope.rows, language)})`,
            )
            .join(" · ")}
        </Caption>

        <div className="flex flex-col rounded-nested border border-hairline bg-ethereal-ink/4 px-3 py-2">
          {APPLY_COMMANDS.map((command) => (
            <Text key={command} as="code" size="sm" className="font-mono">
              {command}
            </Text>
          ))}
        </div>

        <Text size="sm" color="graphite">
          {t(
            "copy_desk.queue.patch_note",
            "Pierwsze polecenie tylko pokazuje, co wpisze; drugie wpisuje. Potem git diff, commit i wdrożenie — dopiero to zmienia serwis.",
          )}
        </Text>

        {patch.since && (
          <Caption color="muted">
            {t("copy_desk.queue.patch_since", {
              when: formatRelativeTime(patch.since, language),
              defaultValue: "Najstarsza decyzja czeka od: {{when}}.",
            })}
          </Caption>
        )}
      </div>
    </SectionCard>
  );
};
