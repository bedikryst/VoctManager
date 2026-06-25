/**
 * @file ComposerRow.tsx
 * @description Compact composer row with inline pencil edits on name +
 * lifespan + nationality. Click row to expand → portrait, bio,
 * MB/Wikidata links, pieces in the library, refresh-from-MB action.
 *
 * Bulk select via leading checkbox enables the parent page's merge UI.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ComposerRow
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Library,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { Text } from "@/shared/ui/primitives/typography";
import { InlineEditable } from "@/shared/ui/primitives/InlineEditable";
import type { Composer } from "@/shared/types";
import { cn } from "@/shared/lib/utils";

import { useUpdateComposer } from "../api/archive.queries";
import { ComposerRowExpanded } from "./ComposerRowExpanded";

interface ComposerRowProps {
  readonly composer: Composer;
  readonly isSelected: boolean;
  readonly onToggleSelected: (composerId: string) => void;
  readonly onDelete: (composer: Composer) => void;
}

const composerDisplayName = (composer: Composer): string =>
  composer.full_name?.trim() ||
  `${composer.last_name}${composer.first_name ? `, ${composer.first_name}` : ""}`;

const lifespanString = (composer: Composer): string | null => {
  if (!composer.birth_year && !composer.death_year) return null;
  return `${composer.birth_year ?? "?"}–${composer.death_year ?? ""}`.trim();
};

// ---------------------------------------------------------------------------
// Stat chips — pieces-count + MusicBrainz link state. Shared between the
// desktop right rail and the mobile meta line so the markup lives in one place.
// ---------------------------------------------------------------------------

interface ComposerStatsProps {
  readonly piecesCount: number;
  readonly hasMB: boolean;
}

const ComposerStats = ({
  piecesCount,
  hasMB,
}: ComposerStatsProps): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest",
          piecesCount > 0
            ? "border-ethereal-amethyst/30 bg-ethereal-amethyst/10 text-ethereal-amethyst"
            : "border-ethereal-incense/25 bg-ethereal-marble/40 text-ethereal-graphite/70",
        )}
        title={t(
          "archive.composer_row.pieces_tooltip",
          "{{count}} utworów w bibliotece",
          { count: piecesCount },
        )}
      >
        <Library size={10} aria-hidden="true" />
        {piecesCount}
      </span>
      {hasMB ? (
        <span
          className="inline-flex items-center gap-1 rounded-md border border-ethereal-sage/35 bg-ethereal-sage/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ethereal-sage"
          title={t("archive.composer_row.mb_tooltip", "Powiązany z MusicBrainz")}
        >
          <CheckCircle2 size={10} aria-hidden="true" />
          MB
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1 rounded-md border border-ethereal-gold/40 bg-ethereal-gold/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ethereal-gold"
          title={t(
            "archive.composer_row.no_mb_tooltip",
            "Brak MBID — rozważ 'Odśwież z MusicBrainz'",
          )}
        >
          <AlertTriangle size={10} aria-hidden="true" />
          MB?
        </span>
      )}
    </>
  );
};

export const ComposerRow = ({
  composer,
  isSelected,
  onToggleSelected,
  onDelete,
}: ComposerRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const updateComposer = useUpdateComposer();

  const piecesCount = composer.pieces_count ?? 0;
  const isOrphan = composer.is_orphan ?? piecesCount === 0;
  const hasPortrait = Boolean(composer.portrait_url);
  const hasMB = Boolean(composer.mbid);

  const patch = (
    field: keyof Composer,
    value: string,
  ) =>
    updateComposer.mutateAsync({
      id: String(composer.id),
      data: { [field]: value } as Parameters<
        typeof updateComposer.mutateAsync
      >[0]["data"],
    });

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-ethereal-alabaster/60 transition-all",
        isExpanded
          ? "border-ethereal-gold/30 shadow-glass-ethereal"
          : "border-ethereal-incense/20 hover:border-ethereal-gold/25 hover:bg-ethereal-parchment/30",
        isSelected && "ring-2 ring-ethereal-gold/40",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsExpanded((v) => !v);
          }
        }}
        className="group flex w-full cursor-pointer items-start gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 focus-visible:ring-inset md:items-center"
        aria-expanded={isExpanded}
      >
        {/* Bulk-select checkbox */}
        <span
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelected(String(composer.id));
          }}
          className="flex shrink-0 items-center"
        >
          <Checkbox
            checked={isSelected}
            onChange={() => onToggleSelected(String(composer.id))}
            aria-label={t(
              "archive.composer_row.select_aria",
              "Zaznacz {{name}} do łączenia",
              { name: composerDisplayName(composer) },
            )}
          />
        </span>

        {/* Avatar */}
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ethereal-incense/20 bg-ethereal-alabaster shadow-sm"
          aria-hidden="true"
        >
          {hasPortrait ? (
            <img
              src={composer.portrait_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <Sparkles
              size={14}
              className="text-ethereal-gold/60"
              strokeWidth={1.6}
            />
          )}
        </span>

        {/* Name + lifespan + nationality */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span
              className="inline-flex items-baseline"
              onClick={(event) => event.stopPropagation()}
            >
              <InlineEditable
                value={composer.last_name}
                onSave={(next) => patch("last_name", next)}
                ariaLabel={t("archive.composer_row.edit_last", "Nazwisko")}
                variant="title"
              />
              <Text size="sm" color="graphite" aria-hidden="true">
                ,
              </Text>
            </span>
            <div onClick={(event) => event.stopPropagation()}>
              <InlineEditable
                value={composer.first_name ?? ""}
                onSave={(next) => patch("first_name", next)}
                ariaLabel={t("archive.composer_row.edit_first", "Imię")}
                emptyDisplay={t("archive.composer_row.first_empty", "imię?")}
              />
            </div>
          </div>
          <div
            className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
            onClick={(event) => event.stopPropagation()}
          >
            <InlineEditable
              value={composer.birth_year ?? ""}
              onSave={(next) => patch("birth_year", next)}
              type="number"
              ariaLabel={t("archive.composer_row.edit_birth", "Rok urodzenia")}
              variant="subtle"
              emptyDisplay={t("archive.composer_row.birth_empty", "ur.?")}
            />
            <Text size="xs" color="graphite" aria-hidden="true">
              –
            </Text>
            <InlineEditable
              value={composer.death_year ?? ""}
              onSave={(next) => patch("death_year", next)}
              type="number"
              ariaLabel={t("archive.composer_row.edit_death", "Rok śmierci")}
              variant="subtle"
              emptyDisplay={t("archive.composer_row.death_empty", "—")}
            />
            <Text size="xs" color="graphite" aria-hidden="true">
              ·
            </Text>
            <InlineEditable
              value={composer.nationality ?? ""}
              onSave={(next) => patch("nationality", next)}
              ariaLabel={t("archive.composer_row.edit_nationality", "Narodowość")}
              variant="subtle"
              emptyDisplay={t("archive.composer_row.nationality_empty", "kraj?")}
            />
          </div>

          {/* Mobile meta — stat chips on their own line below the name so they
              never crowd or overlap it. Desktop shows them on the right rail. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
            <ComposerStats piecesCount={piecesCount} hasMB={hasMB} />
          </div>
        </div>

        {/* Stats chips — desktop right rail (mobile renders them above). */}
        <div className="hidden shrink-0 items-center gap-1.5 md:flex">
          <ComposerStats piecesCount={piecesCount} hasMB={hasMB} />
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {isOrphan && (
            <Button
              variant="icon"
              size="icon"
              aria-label={t(
                "archive.composer_row.delete_aria",
                "Usuń kompozytora {{name}}",
                { name: composerDisplayName(composer) },
              )}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(composer);
              }}
              className="h-8 w-8 text-ethereal-graphite transition-opacity hover:text-ethereal-crimson focus-visible:opacity-100 fine-pointer:opacity-0 fine-pointer:group-hover:opacity-100"
            >
              <Trash2 size={13} aria-hidden="true" />
            </Button>
          )}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn(
              "shrink-0 text-ethereal-graphite/70 transition-transform",
              isExpanded && "rotate-180 text-ethereal-gold",
            )}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-ethereal-incense/15"
          >
            <ComposerRowExpanded composer={composer} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Helper for parents that need the lifespan elsewhere (e.g. merge dialog).
export const useComposerSubtitle = (composer: Composer): string => {
  const parts = [
    lifespanString(composer),
    composer.nationality,
    composer.period,
  ].filter(Boolean);
  return parts.join(" · ");
};
