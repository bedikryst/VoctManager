/**
 * @file RunSheetRow.tsx
 * @description One editable point of the concert-day plan. Two lines, not three
 * boxes across: the clock and the name share a baseline because they are the
 * point, and the description sits under them as the optional aside it is. Three
 * equal-weight fields in a bordered strip gave a 170px column to prose and made
 * every row shout the same volume.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/RunSheetRow
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";

import type { RunSheetItem } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { TimeField } from "@/shared/ui/composites/DateTimeField";
import { Input } from "@/shared/ui/primitives/Input";

interface RunSheetRowProps {
  readonly item: RunSheetItem;
  readonly onUpdate: (
    id: string,
    field: keyof RunSheetItem,
    value: string,
  ) => void;
  readonly onCommitOrder: () => void;
  readonly onRemove: (id: string) => void;
}

export const RunSheetRow = ({
  item,
  onUpdate,
  onCommitOrder,
  onRemove,
}: RunSheetRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const id = String(item.id);

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="relative"
    >
      <span
        className="absolute -left-[1.6rem] top-4 h-2.5 w-2.5 rounded-full border-2 border-ethereal-gold bg-ethereal-marble"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-28 shrink-0">
            <TimeField
              required
              value={item.time}
              onChange={(time) => onUpdate(id, "time", time)}
              onBlur={onCommitOrder}
              ariaLabel={t("projects.details_tab.run_sheet.time", "Godzina")}
            />
          </div>

          <div className="min-w-0 flex-1">
            <Input
              type="text"
              value={item.title}
              onChange={(event) => onUpdate(id, "title", event.target.value)}
              placeholder={t(
                "projects.details_tab.run_sheet.title",
                "Nazwa punktu",
              )}
              aria-label={t(
                "projects.details_tab.run_sheet.title",
                "Nazwa punktu",
              )}
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(id)}
            aria-label={t("common.actions.delete", "Usuń")}
            className="shrink-0 text-ethereal-graphite/40 hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>

        {/* Ghost, so the row has one field that carries weight and one that
            waits to be asked: a description is genuinely optional here. */}
        <Input
          variant="ghost"
          type="text"
          value={item.description || ""}
          onChange={(event) => onUpdate(id, "description", event.target.value)}
          placeholder={t(
            "projects.details_tab.run_sheet.description",
            "Opis (opcjonalny)",
          )}
          aria-label={t(
            "projects.details_tab.run_sheet.description",
            "Opis (opcjonalny)",
          )}
        />
      </div>
    </motion.li>
  );
};
