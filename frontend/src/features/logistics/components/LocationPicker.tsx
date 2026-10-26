/**
 * @file LocationPicker.tsx
 * @description The field a form picks a saved venue with. Venue names are long
 * and many begin alike ("Kościół…"), so the list is searched rather than
 * scanned — by name and by address, diacritics folded — and each name carries
 * its address on a line of its own instead of glued on after a dash.
 * A venue nobody has saved yet is created from the same list, in the editor laid
 * over the form, so the form's unsaved fields survive it; the words already
 * typed into the filter start the editor's place search.
 * @module features/logistics/components/LocationPicker
 */

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPinPlus } from "lucide-react";

import {
  SearchSelect,
  type SearchSelectOption,
} from "@/shared/ui/composites/SearchSelect";
import type { FieldShellVariantProps } from "@/shared/ui/primitives/fieldShell";
import { useLocations } from "../api/logistics.queries";
import type { LocationDto } from "../types/logistics.dto";
import { LocationEditorPanel } from "./LocationEditorPanel";

interface LocationPickerProps extends Omit<FieldShellVariantProps, "hasError"> {
  /** The chosen venue's id, or `""` for none. */
  readonly value: string;
  /**
   * Hands back the venue as well as its id — a form adopts the venue's
   * timezone. `null` when the field is cleared.
   */
  readonly onChange: (locationId: string, location: LocationDto | null) => void;
  readonly label?: string;
  readonly ariaLabel?: string;
  readonly placeholder?: string;
  /** Offers "no venue" as an answer — only where empty means something. */
  readonly clearLabel?: string;
  readonly leftIcon?: React.ReactNode;
  readonly size?: "default" | "sm";
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly error?: string;
}

export const LocationPicker = ({
  value,
  onChange,
  ...fieldProps
}: LocationPickerProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { data: locations } = useLocations();

  /**
   * The venue created from this field. The list refetches after the save, and
   * until it lands the field would name a venue its options do not hold yet.
   */
  const [created, setCreated] = useState<LocationDto | null>(null);
  /** The filter's words while the editor is open; `null` while it is closed. */
  const [draftQuery, setDraftQuery] = useState<string | null>(null);
  /**
   * The editor mounts on the first request and stays: a row of the run sheet
   * that never creates a venue never builds the editor's form, and one that did
   * keeps it mounted so its exit still animates.
   */
  const [hasEditor, setHasEditor] = useState(false);

  const venues = useMemo<readonly LocationDto[]>(
    () =>
      created && !locations.some((location) => location.id === created.id)
        ? [...locations, created]
        : locations,
    [locations, created],
  );

  const options = useMemo<SearchSelectOption[]>(
    () =>
      venues.map((location) => ({
        value: String(location.id),
        label: location.name,
        description: location.formatted_address || undefined,
      })),
    [venues],
  );

  const handleValueChange = (next: string): void => {
    onChange(
      next,
      venues.find((location) => String(location.id) === next) ?? null,
    );
  };

  const handleCreated = (location: LocationDto): void => {
    setCreated(location);
    onChange(String(location.id), location);
  };

  return (
    <>
      <SearchSelect
        {...fieldProps}
        value={value}
        onValueChange={handleValueChange}
        options={options}
        searchPlaceholder={t(
          "logistics.picker.search",
          "Szukaj po nazwie lub adresie",
        )}
        action={{
          label: t("logistics.picker.create", "Dodaj nowe miejsce"),
          icon: <MapPinPlus size={15} />,
          onSelect: (query) => {
            setHasEditor(true);
            setDraftQuery(query);
          },
        }}
      />

      {hasEditor && (
        // The editor is portalled, but React bubbles its `submit` along this
        // tree all the same — into the form the picker sits in, which would
        // then save itself together with the venue. It stops here.
        <div className="contents" onSubmit={(event) => event.stopPropagation()}>
          <LocationEditorPanel
            isOpen={draftQuery !== null}
            onClose={() => setDraftQuery(null)}
            location={null}
            initialQuery={draftQuery ?? ""}
            onCreated={handleCreated}
          />
        </div>
      )}
    </>
  );
};
