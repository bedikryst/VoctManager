/**
 * @file ToolFamilySlot.tsx
 * @description One toolbar slot for a family of tools, as in Photoshop: "Rysuj"
 * (pen, highlighter, shapes) and "Wstaw" (note, symbol, jump). The slot wears
 * the family's last-armed member and a tap arms that member; the siblings are
 * the first row of the options panel. A key (P H R T S J) arms its member
 * directly and the slot follows, because the slot reads the armed tool rather
 * than holding a choice of its own. Which member a slot shows is remembered per
 * device, like the tool itself.
 *
 * "Rysuj" stays on the bar when the page is too small to write on. It shows
 * dimmed with a zoom badge, and a tap says why in a toast — held, not
 * disabled, because a disabled button takes no tap and the tap is the only way
 * the reason reaches a reader on a phone.
 * @module features/annotations/components
 */

import React, { useEffect, useState } from "react";
import { ZoomIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { cn } from "@/shared/lib/utils";

import { readStored, writeStored } from "../lib/deviceStorage";
import { TOOL_KEYS, type AnnotationTool } from "../lib/useAnnotationTools";
import { pillButton } from "./toolbarChrome";
import type { ToolDef } from "./AnnotationToolbar";

export interface ToolFamily {
  id: "draw" | "insert";
  members: readonly AnnotationTool[];
  labelKey: string;
  fallback: string;
  storageKey: string;
}

export const DRAW_FAMILY: ToolFamily = {
  id: "draw",
  members: ["pen", "highlighter", "shape"],
  labelKey: "annotations.families.draw",
  fallback: "Rysuj",
  storageKey: "voct.annotations.draw_member",
};

export const INSERT_FAMILY: ToolFamily = {
  id: "insert",
  members: ["note", "stamp", "link"],
  labelKey: "annotations.families.insert",
  fallback: "Wstaw",
  storageKey: "voct.annotations.insert_member",
};

/** The family a tool belongs to, or null for the single slots. */
export const familyOf = (tool: AnnotationTool): ToolFamily | null =>
  DRAW_FAMILY.members.includes(tool)
    ? DRAW_FAMILY
    : INSERT_FAMILY.members.includes(tool)
      ? INSERT_FAMILY
      : null;

const NEEDS_ROOM_TOAST_ID = "annotations-draw-needs-room";

/**
 * The member a family's slot shows: the armed tool when it belongs to the
 * family, otherwise the one armed last (on this device), otherwise the first.
 */
export const useFamilyMember = (family: ToolFamily, armed: AnnotationTool): AnnotationTool => {
  const { members, storageKey } = family;
  const [last, setLast] = useState<AnnotationTool>(() => {
    const stored = readStored(storageKey);
    const remembered = members.find((member) => member === stored);
    return remembered ?? (members.includes(armed) ? armed : members[0] ?? armed);
  });
  useEffect(() => {
    if (!members.includes(armed)) return;
    setLast(armed);
    writeStored(storageKey, armed);
  }, [armed, members, storageKey]);
  return members.includes(armed) ? armed : last;
};

interface ToolFamilySlotProps {
  family: ToolFamily;
  /** The member the slot wears (see `useFamilyMember`). */
  member: ToolDef;
  armed: AnnotationTool;
  onArm: (tool: AnnotationTool) => void;
  /** False while the page is too small to write on (see useCanDraw). */
  available?: boolean;
}

export const ToolFamilySlot = ({
  family,
  member,
  armed,
  onArm,
  available = true,
}: ToolFamilySlotProps): React.JSX.Element => {
  const { t } = useTranslation();
  const familyLabel = t(family.labelKey, family.fallback);
  const memberLabel = t(member.labelKey, member.fallback);
  const name = t("annotations.families.slot", {
    family: familyLabel,
    tool: memberLabel,
    defaultValue: "{{family}}: {{tool}}",
  });
  const needsRoom = t("annotations.draw_needs_room", "Powiększ, by rysować");
  const isArmed = available && family.members.includes(armed);
  const Icon = member.icon;

  return (
    <button
      type="button"
      onClick={() => {
        if (!available) {
          toast.info(needsRoom, { id: NEEDS_ROOM_TOAST_ID });
          return;
        }
        onArm(member.id);
      }}
      aria-disabled={!available}
      aria-label={available ? name : `${name}. ${needsRoom}`}
      aria-pressed={isArmed}
      aria-keyshortcuts={available ? TOOL_KEYS[member.id].toUpperCase() : undefined}
      title={available ? `${name} (${TOOL_KEYS[member.id].toUpperCase()})` : needsRoom}
      className={cn(
        pillButton,
        "relative",
        isArmed ? "bg-ink-on-inverse/20" : "hover:bg-ink-on-inverse/10",
      )}
    >
      <Icon size={16} aria-hidden="true" className={cn(!available && "opacity-40")} />
      {!available && (
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface-inverse text-ethereal-gold ring-1 ring-ethereal-gold/40"
        >
          <ZoomIn size={10} />
        </span>
      )}
    </button>
  );
};
