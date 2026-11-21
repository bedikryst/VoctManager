/**
 * @file PropertyRow.tsx
 * @description Fixed label and value alignment for directly editable document properties.
 * From 1024 px the label, value and action share one line, the action at its
 * end. Below that the value goes under its label and the action sits at the
 * end of the value's line, so a check belongs visibly to the value it checks.
 *
 * The row is the positioned box its `marker` runs along: a marker that places
 * itself absolutely (the piece card's review edge) spans the whole row.
 */

import { useId, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Label } from "@/shared/ui/primitives/typography";

export const PROPERTY_CONTROL_CLASS =
  "min-w-0 min-h-9 px-2 py-1.5 text-base fine-pointer:text-base transition-colors";

interface PropertyRowProps {
  readonly label: string;
  readonly marker?: ReactNode;
  readonly action?: ReactNode;
  readonly accessory?: ReactNode;
  /** The control's id, when something outside the row has to reach it. */
  readonly controlId?: string;
  readonly children: (controlId: string) => ReactNode;
}

export const PropertyRow = ({
  label,
  marker,
  action,
  accessory,
  controlId: givenId,
  children,
}: PropertyRowProps) => {
  const generatedId = useId();
  const controlId = givenId ?? generatedId;

  return (
    <div className="relative grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 py-1 lg:grid-cols-[10.5rem_minmax(0,1fr)_auto] lg:gap-x-3 lg:py-0">
      {marker}
      <Label
        as="label"
        htmlFor={controlId}
        size="base"
        color="graphite"
        className="col-span-2 self-start pt-2 lg:col-span-1 lg:py-3"
      >
        {label}
      </Label>
      <div className="row-start-2 -ml-2 flex min-w-0 items-start gap-1 lg:col-start-2 lg:row-start-1 lg:py-1">
        <div className={cn("min-w-0", !accessory && "flex-1")}>{children(controlId)}</div>
        {accessory}
      </div>
      {action && <div className="col-start-2 row-start-2 self-center lg:col-start-3 lg:row-start-1 lg:self-start lg:pt-1">{action}</div>}
    </div>
  );
};
