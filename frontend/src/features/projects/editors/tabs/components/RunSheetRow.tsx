/**
 * @file RunSheetRow.tsx
 * @description One editable point of the plan. Two lines, not three boxes
 * across: the clock and the name share a baseline because they are the point,
 * and the aside — the description, the day, the place and who it is for — sits
 * under them. Three equal-weight fields in a bordered strip gave a 170px column
 * to prose and made every row shout the same volume.
 *
 * The place is a venue the choir has saved, never typed text, because the answer
 * a singer needs at a car park at 6:40 is a route — and only a stored venue
 * carries the address a route can be built from. Leaving it unset is the normal
 * case and means the event's own venue. The day works the same way: unset is
 * concert day, and only a trip's points name another.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/RunSheetRow
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { CalendarDays, Luggage, MapPin, MapPinPlus, Trash2 } from "lucide-react";

import type { RunSheetItem } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { TimeField } from "@/shared/ui/composites/DateTimeField";
import { Input } from "@/shared/ui/primitives/Input";
import { Select, type SelectOption } from "@/shared/ui/primitives/Select";
import { Caption } from "@/shared/ui/primitives/typography";
import { readRunSheetDay } from "../../../lib/dayTimeline";
import type { RunSheetItemUpdater } from "../../hooks/useDetailsForm";

interface RunSheetRowProps {
  readonly item: RunSheetItem;
  /** The saved venues, already shaped by the tab that owns the locations query. */
  readonly locationOptions: readonly SelectOption[];
  /**
   * The plan's days as dates, concert day marked. Concert day is also the
   * empty value, so an untouched row stores no `day` at all.
   */
  readonly dayOptions: readonly SelectOption[];
  /** What the empty day reads as — the event's own day. */
  readonly dayPlaceholder: string;
  readonly onUpdate: RunSheetItemUpdater;
  readonly onCommitOrder: () => void;
  readonly onRemove: (id: string) => void;
  /** Opens the venue editor for this row; the new venue lands in its picker. */
  readonly onCreatePlace: (id: string) => void;
}

export const RunSheetRow = ({
  item,
  locationOptions,
  dayOptions,
  dayPlaceholder,
  onUpdate,
  onCommitOrder,
  onRemove,
  onCreatePlace,
}: RunSheetRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const id = String(item.id);
  const day = readRunSheetDay(item.day);
  const travellersOnly = item.travellers_only === true;

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

        {/* All ghost, so the row has one field that carries weight and the
            rest wait to be asked: nothing here is required. The prose takes
            what the controls leave, and the controls wrap under it as one group
            where the card is too narrow for both — a day is planned by writing
            what happens, not by naming where. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Input
            variant="ghost"
            type="text"
            className="min-w-48 flex-1"
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

          <div className="flex flex-wrap items-center gap-1">
            {/* Unset is an answer, not a gap — hence placeholders that name the
                default rather than report an absence. Picking a day re-sorts
                the plan at once; it is chosen, not typed. */}
            <div className="w-36">
              <Select
                variant="ghost"
                size="sm"
                value={day === undefined ? "" : String(day)}
                onValueChange={(value) =>
                  onUpdate(id, "day", readRunSheetDay(Number(value)))
                }
                options={dayOptions}
                leftIcon={<CalendarDays size={14} aria-hidden="true" />}
                placeholder={dayPlaceholder}
                ariaLabel={t(
                  "projects.details_tab.run_sheet.day",
                  "Dzień tego punktu",
                )}
              />
            </div>

            <div className="flex w-56 items-center gap-1">
              <div className="min-w-0 flex-1">
                <Select
                  variant="ghost"
                  size="sm"
                  value={item.location_id || ""}
                  onValueChange={(locationId) =>
                    onUpdate(id, "location_id", locationId)
                  }
                  options={locationOptions}
                  leftIcon={<MapPin size={14} aria-hidden="true" />}
                  placeholder={t(
                    "projects.details_tab.run_sheet.place_default",
                    "Miejsce wydarzenia",
                  )}
                  clearLabel={t(
                    "projects.details_tab.run_sheet.place_default",
                    "Miejsce wydarzenia",
                  )}
                  ariaLabel={t(
                    "projects.details_tab.run_sheet.place",
                    "Miejsce tego punktu",
                  )}
                />
              </div>

              {/* The restaurant on the way is a venue nobody had a reason to save
                  before this row existed. Opening the editor here, over the tab,
                  is what keeps that from costing the producer their unsaved form. */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onCreatePlace(id)}
                aria-label={t(
                  "projects.details_tab.run_sheet.place_new",
                  "Dodaj nowe miejsce",
                )}
                className="shrink-0 text-ethereal-graphite/50 hover:text-ethereal-gold"
              >
                <MapPinPlus size={15} aria-hidden="true" />
              </Button>
            </div>

            {/* Worded, not an icon alone: whether a singer who joins on site is
                due here is the question the row answers, and on a phone there
                is no hover to explain a glyph. Lit, it is also the row's label. */}
            <button
              type="button"
              aria-pressed={travellersOnly}
              onClick={() => onUpdate(id, "travellers_only", !travellersOnly)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-chip border px-2 py-1 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                "pointer-coarse:min-h-9",
                travellersOnly
                  ? "border-ethereal-gold/40 bg-ethereal-gold/10 text-ethereal-gold"
                  : "border-transparent text-ethereal-graphite/50 hover:bg-ethereal-gold/10 hover:text-ethereal-gold",
              )}
            >
              <Luggage size={13} aria-hidden="true" />
              <Caption as="span" color="inherit" weight="medium">
                {t(
                  "projects.details_tab.run_sheet.travellers_only",
                  "Tylko dla jadących",
                )}
              </Caption>
            </button>
          </div>
        </div>
      </div>
    </motion.li>
  );
};
