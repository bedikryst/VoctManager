/**
 * @file TimezoneField.tsx
 * @description The timezone stated as a fact, and a listbox only when someone
 * asks for it. It follows the venue in every real booking and the raw IANA list
 * is ~420 unsearchable entries, so a permanent select spends a form's most
 * valuable slot on its least-touched field.
 * Both the concert form and the rehearsal form need exactly this, which is why
 * it lives here instead of being typed twice — two copies of one recipe is how
 * the panel drifted in the first place.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/TimezoneField
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

import { getAvailableTimezones } from "@/shared/lib/time/timezone";
import { Select } from "@/shared/ui/primitives/Select";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";

interface TimezoneFieldProps {
  readonly timezone: string;
  readonly onChange: (timezone: string) => void;
  readonly disabled?: boolean;
}

export const TimezoneField = ({
  timezone,
  onChange,
  disabled,
}: TimezoneFieldProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        // Pulled up against the field it qualifies: it is a caption on the time
        // above it, not a row of the form's own rhythm. `w-fit` as well as
        // `self-start`, because it sits in a flex column on one tab and a grid
        // cell on the other, and a stretched hover fill would read as a field.
        className="group -mt-2 flex w-fit items-center gap-2 self-start rounded-control px-1.5 py-1 transition-colors hover:bg-ethereal-ink/3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
      >
        <Globe
          size={13}
          className="shrink-0 text-ethereal-graphite/40 transition-colors group-hover:text-ethereal-gold"
          aria-hidden="true"
        />
        <Caption color="muted">
          {t("projects.timezone_field.resolved", "Czas w strefie: {{timezone}}", {
            timezone: timezone.replace(/_/g, " "),
          })}
        </Caption>
        <Eyebrow size="overline-sm" color="gold">
          {t("common.actions.change", "Zmień")}
        </Eyebrow>
      </button>
    );
  }

  return (
    <Select
      label={t("projects.timezone_field.label", "Strefa czasowa")}
      required
      leftIcon={<Globe aria-hidden="true" />}
      value={timezone}
      onValueChange={onChange}
      disabled={disabled}
      options={getAvailableTimezones().map((zone) => ({
        value: zone,
        label: zone.replace(/_/g, " "),
      }))}
    />
  );
};
