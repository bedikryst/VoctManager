/**
 * @file PropertyRow.tsx
 * @description Fixed label and value alignment for directly editable document properties.
 * From 1024 px the label, value and action share one line, the action at its
 * end. Below that the value goes under its label and the action sits right
 * after the label, clear of the shell's floating feedback button, which rides
 * at the bottom right edge of a phone.
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
    <div className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 py-1 lg:grid-cols-[10.5rem_minmax(0,1fr)_auto] lg:gap-x-3 lg:py-0">
      <Label
        as="label"
        htmlFor={controlId}
        size="base"
        color="graphite"
        className="relative col-start-1 self-start py-2 lg:py-3"
      >
        {marker && (
          <span aria-hidden="true" className="absolute -left-4 top-1/2 flex size-3.5 -translate-y-1/2 items-center justify-center lg:-left-5">
            {marker}
          </span>
        )}
        {label}
      </Label>
      <div className="col-span-2 row-start-2 -ml-2 flex min-w-0 items-start gap-1 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:py-1">
        <div className={cn("min-w-0", !accessory && "flex-1")}>{children(controlId)}</div>
        {accessory}
      </div>
      {action && <div className="col-start-2 row-start-1 self-start justify-self-start lg:col-start-3 lg:pt-1">{action}</div>}
    </div>
  );
};
