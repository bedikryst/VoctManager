/**
 * @file StandardRateField.tsx
 * @description The toolbar control that prices a whole roster at once. A
 * foundation pays one rate per concert and adjusts a couple of exceptions, so
 * typing the same figure into fifteen fields was the actual work this tab
 * asked for.
 * It writes into the draft, not to the server: the ledger below previews every
 * row it would change, and the shared save bar still owns the commit — so a
 * standard rate can be looked at and taken back like any other edit.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/StandardRateField
 */

import React, { useId } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/shared/ui/primitives/Input";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";

interface StandardRateFieldProps {
  readonly value: string;
  /** Rows the rate would actually reach — settled ones are out of its hands. */
  readonly affectedCount: number;
  readonly currencyLabel: string;
  readonly onChange: (value: string) => void;
}

export function StandardRateField({
  value,
  affectedCount,
  currencyLabel,
  onChange,
}: StandardRateFieldProps): React.JSX.Element {
  const { t } = useTranslation();
  // Rendered once per ledger, so the label/field pairing needs a unique id.
  const fieldId = useId();

  const label = t("projects.budget.standard_rate.label", "Stawka dla wszystkich");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Eyebrow as="label" color="muted" htmlFor={fieldId} className="ml-1">
        {label}
      </Eyebrow>
      <span className="flex items-center gap-1.5">
        <span className="w-24">
          <Input
            id={fieldId}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="–"
            aria-label={label}
            className="text-right tabular-nums"
          />
        </span>
        <Eyebrow size="overline-sm" color="muted">
          {currencyLabel}
        </Eyebrow>
      </span>
      <Caption color={value.trim() ? "gold" : "muted"}>
        {value.trim()
          ? t(
              "projects.budget.standard_rate.pending",
              "Obejmie {{count}} poz. — zapisz, aby zastosować",
              { count: affectedCount },
            )
          : t("projects.budget.standard_rate.hint", "Nadpisze {{count}} poz.", {
              count: affectedCount,
            })}
      </Caption>
    </div>
  );
}
