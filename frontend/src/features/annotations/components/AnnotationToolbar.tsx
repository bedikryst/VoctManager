/**
 * @file AnnotationToolbar.tsx
 * @description Compact conductor markup toolbar, injected into the PDF viewer's
 * floating control pill. Tool selection + ink colour + the shared/private layer
 * switch that decides whether a marking reaches the choir.
 * @module features/annotations/components
 */

import React, { useEffect, useState } from "react";
import {
  Check,
  Eraser,
  MessageSquarePlus,
  MousePointer2,
  PenLine,
  Trash2,
  Users,
  UserCog,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";

import {
  ANNOTATION_COLORS,
  type AnnotationTool,
  type AnnotationToolState,
} from "../lib/useAnnotationTools";

interface AnnotationToolbarProps extends AnnotationToolState {
  annotationCount: number;
  onClearAll: () => void;
}

const TOOLS: ReadonlyArray<{
  id: AnnotationTool;
  icon: typeof PenLine;
  labelKey: string;
  fallback: string;
}> = [
  { id: "pointer", icon: MousePointer2, labelKey: "annotations.tools.pointer", fallback: "Browse" },
  { id: "pen", icon: PenLine, labelKey: "annotations.tools.pen", fallback: "Pen" },
  { id: "comment", icon: MessageSquarePlus, labelKey: "annotations.tools.comment", fallback: "Comment" },
  { id: "eraser", icon: Eraser, labelKey: "annotations.tools.eraser", fallback: "Erase" },
];

const pillButton =
  "flex h-9 w-9 items-center justify-center rounded-full text-ethereal-marble transition-colors";

export const AnnotationToolbar = ({
  tool,
  setTool,
  color,
  setColor,
  layer,
  setLayer,
  annotationCount,
  onClearAll,
}: AnnotationToolbarProps): React.JSX.Element => {
  const { t } = useTranslation();
  const inkVisible = tool === "pen" || tool === "comment";

  // Two-tap confirm (avoids a modal-inside-the-PDF-modal); auto-resets so a
  // stray first tap never leaves the toolbar armed.
  const [confirmingClear, setConfirmingClear] = useState(false);
  useEffect(() => {
    if (!confirmingClear) return;
    const timer = window.setTimeout(() => setConfirmingClear(false), 3500);
    return () => window.clearTimeout(timer);
  }, [confirmingClear]);

  return (
    <div className="flex items-center gap-0.5">
      {TOOLS.map(({ id, icon: Icon, labelKey, fallback }) => (
        <button
          key={id}
          type="button"
          onClick={() => setTool(id)}
          aria-label={t(labelKey, fallback)}
          aria-pressed={tool === id}
          title={t(labelKey, fallback)}
          className={cn(
            pillButton,
            tool === id ? "bg-white/20 text-white" : "hover:bg-white/10",
          )}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}

      {inkVisible && (
        <>
          <div className="mx-1 h-4 w-px bg-white/15" />
          <div className="flex items-center gap-1 px-0.5">
            {ANNOTATION_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                aria-label={swatch}
                title={swatch}
                className={cn(
                  "h-5 w-5 rounded-full transition-transform hover:scale-110",
                  color === swatch
                    ? "ring-2 ring-white ring-offset-1 ring-offset-ethereal-ink"
                    : "ring-1 ring-white/30",
                )}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </>
      )}

      <div className="mx-1 h-4 w-px bg-white/15" />
      <button
        type="button"
        onClick={() => setLayer(layer === "shared" ? "conductor" : "shared")}
        aria-label={
          layer === "shared"
            ? t("annotations.layer.shared", "Visible to choir")
            : t("annotations.layer.private", "Private")
        }
        title={
          layer === "shared"
            ? t("annotations.layer.shared", "Visible to choir")
            : t("annotations.layer.private", "Private")
        }
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
          layer === "shared"
            ? "bg-emerald-500/20 text-emerald-200"
            : "bg-white/10 text-ethereal-marble",
        )}
      >
        {layer === "shared" ? (
          <Users size={14} aria-hidden="true" />
        ) : (
          <UserCog size={14} aria-hidden="true" />
        )}
        <span className="hidden sm:inline">
          {layer === "shared"
            ? t("annotations.layer.shared_short", "Choir")
            : t("annotations.layer.private_short", "Private")}
        </span>
      </button>

      {annotationCount > 0 && (
        <>
          <div className="mx-1 h-4 w-px bg-white/15" />
          {confirmingClear ? (
            <button
              type="button"
              onClick={() => {
                onClearAll();
                setConfirmingClear(false);
              }}
              className="flex h-9 items-center gap-1.5 rounded-full bg-ethereal-crimson/90 px-3 text-xs font-medium text-white transition-colors hover:bg-ethereal-crimson"
            >
              <Check size={14} aria-hidden="true" />
              <span>{t("annotations.clear_confirm", "Na pewno?")}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              aria-label={t("annotations.clear_all", "Usuń wszystkie adnotacje")}
              title={t("annotations.clear_all", "Usuń wszystkie adnotacje")}
              className={cn(pillButton, "hover:bg-ethereal-crimson/30 hover:text-white")}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </div>
  );
};
