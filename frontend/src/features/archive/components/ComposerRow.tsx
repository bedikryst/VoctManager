/**
 * @file ComposerRow.tsx
 * @description One composer in the composers list, as a `RecordRow`: the row
 * opens the composer's record, where every edit happens. The name is set
 * surname first, the order the list is sorted in; under it the lifespan, and
 * to the right the number of pieces the library holds by this composer.
 *
 * The row carries no flags and no portrait: a composer missing its MusicBrainz
 * link is found through the list's filter, not by a chip on most rows, and a
 * portrait on some rows only would break the names' left edge (the record shows
 * it). A composer with no
 * pieces has a menu with "Usuń"; in merge mode the row is one toggle
 * (`RecordRow`'s `row` scope) and the menu steps aside.
 * @module features/archive/components/ComposerRow
 */

import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, Trash2 } from "lucide-react";

import type { Composer } from "@/shared/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import { RecordRow, recordActionClass } from "@/shared/ui/composites/RecordList";
import { Button } from "@/shared/ui/primitives/Button";

interface ComposerRowProps {
  readonly composer: Composer;
  readonly onOpen: (composer: Composer) => void;
  readonly onDelete: (composer: Composer) => void;
  /** The list is in merge mode: a tap toggles the composer instead of opening it. */
  readonly selectionMode?: boolean;
  readonly selected?: boolean;
  readonly onToggleSelect?: (id: string) => void;
}

/** Surname, then first name: the catalogue order the list is sorted in. */
export const composerListName = (composer: Composer): string =>
  composer.first_name ? `${composer.last_name}, ${composer.first_name}` : composer.last_name;

/** First name and surname, the way a record names a person. */
export const composerFullName = (composer: Composer): string =>
  [composer.first_name, composer.last_name].filter(Boolean).join(" ");

/** "1685–1750", "1943–" for a living composer, "?–1652" for an unknown birth; null when neither is known. */
export const composerLifespan = (composer: Composer): string | null => {
  if (!composer.birth_year && !composer.death_year) return null;
  return `${composer.birth_year || "?"}–${composer.death_year ?? ""}`;
};

export const ComposerRow = ({
  composer,
  onOpen,
  onDelete,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: ComposerRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const deleteChosen = useRef(false);
  const name = composerListName(composer);
  const piecesCount = composer.pieces_count ?? 0;
  const isOrphan = composer.is_orphan ?? piecesCount === 0;

  return (
    <RecordRow
      open={{ onOpen: () => onOpen(composer) }}
      title={name}
      voice="name"
      facts={[composerLifespan(composer)]}
      meta={[
        piecesCount > 0
          ? t("archive.composers.pieces", "{{count}} utworów", { count: piecesCount })
          : null,
      ]}
      select={
        selectionMode
          ? {
              scope: "row",
              checked: selected,
              label: t("archive.composers.select_aria", "Zaznacz: {{name}}", { name }),
              onChange: () => onToggleSelect?.(String(composer.id)),
            }
          : undefined
      }
      actions={
        isOrphan ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="icon"
                size="icon"
                className={recordActionClass}
                aria-label={t("archive.composers.menu_aria", "Więcej: {{name}}", { name })}
              >
                <MoreHorizontal size={16} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            {/* The confirmation opens once the menu has handed focus back to its
                trigger, so the dialog returns focus there when it closes. */}
            <DropdownMenuContent
              onCloseAutoFocus={() => {
                if (!deleteChosen.current) return;
                deleteChosen.current = false;
                onDelete(composer);
              }}
            >
              <DropdownMenuItem
                destructive
                icon={<Trash2 size={16} />}
                onSelect={() => {
                  deleteChosen.current = true;
                }}
              >
                {t("archive.composers.delete", "Usuń kompozytora")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : undefined
      }
    />
  );
};
