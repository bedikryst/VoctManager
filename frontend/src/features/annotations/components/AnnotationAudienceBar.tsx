/**
 * @file AnnotationAudienceBar.tsx
 * @description The toolbar's "who sees it" strip, kept apart from the tools as
 * Photoshop keeps its options bar: where the NEXT mark goes (the layer pill,
 * with its label and the voices it is addressed to), "Powiadom chór", and the
 * marks still waiting for the network. In conductor mode the layer cycles
 * choir → leader → private; in leader mode it steps through the reader's own
 * pencil and the layers their grant opens (the choir, "Z dyrygentem"); in
 * personal mode every mark lands on the reader's private layer and a static
 * chip says so.
 *
 * The label is the most consequential word on the bar, so it is always
 * spelled out — the strip has its own line for exactly that reason, and the
 * layer is never reduced to an icon in a 48 px rail.
 *
 * The pill arms the NEXT mark and nothing else. Moving one that already exists
 * is a different question, asked of a different subject, and it is answered on
 * a card anchored to that mark — not from a bar at the far corner of a tablet.
 * @module features/annotations/components
 */

import React, { useMemo } from "react";
import { CloudOff, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";

import type { AnnotationLayer } from "../types/annotations.dto";
import {
  asWriteLayer,
  delegateTargetCopy,
  NEXT_WRITE_LAYER,
  writeLayerCopy,
  type DelegateTarget,
} from "../lib/layers";
import { layerTakesVoices, type VoiceSection } from "../lib/voices";
import type { DelegateLayer, ScoreAnnotatorMode } from "../useScoreAnnotator";
import { wrappingBarChrome } from "./toolbarChrome";

const layerPill =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors";

/**
 * Markup writes this device is still holding for the network. Shown, because
 * the alternative is a reader who has no way to tell "saved" from "saved
 * somewhere I cannot see" and stops trusting the pencil.
 */
export const PendingPill = ({ count }: { count: number }): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (count <= 0) return null;
  return (
    <span
      title={t(
        "annotations.pending_hint",
        "Zapisane na tym urządzeniu. Wyślą się same, gdy wróci internet.",
      )}
      className="flex shrink-0 items-center gap-1 rounded-full bg-ethereal-gold/20 px-2 py-1 text-[10px] font-semibold text-ethereal-gold"
    >
      <CloudOff size={11} aria-hidden="true" />
      {count}
    </span>
  );
};

/**
 * Personal mode writes to one fixed layer — said, instead of offered as a
 * toggle that could suggest the choir might see these marks. `compact` is the
 * chip at the head of a phone's tool row, where the word gives way to the lock
 * below `sm`; nothing there can widen the audience, so the icon says enough.
 */
export const PersonalLayerChip = ({
  compact = false,
}: {
  compact?: boolean;
}): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <span
      title={t("annotations.layer.personal_hint", "Widoczne tylko dla Ciebie")}
      className={cn(layerPill, "bg-ink-on-inverse/10 text-ink-on-inverse")}
    >
      <Lock size={12} aria-hidden="true" />
      <span className={cn(compact && "hidden sm:inline")}>
        {t("annotations.layer.personal_short", "Moje")}
      </span>
    </span>
  );
};

interface AnnotationAudienceBarProps {
  mode: ScoreAnnotatorMode;
  delegateLayers: readonly DelegateLayer[];
  layer: AnnotationLayer;
  setLayer: (layer: AnnotationLayer) => void;
  voices: readonly VoiceSection[];
  pendingCount: number;
  notifySlot?: React.ReactNode;
}

export const AnnotationAudienceBar = ({
  mode,
  delegateLayers,
  layer,
  setLayer,
  voices,
  pendingCount,
  notifySlot,
}: AnnotationAudienceBarProps): React.JSX.Element => {
  const { t } = useTranslation();

  // Said on the layer pill too, so a mark about to go to the tenors only is
  // never a surprise with the options panel closed.
  const voicesBadge =
    mode !== "personal" && layerTakesVoices(layer) && voices.length > 0 ? (
      <span className="rounded-full bg-ink-on-inverse/15 px-1.5 text-[10px] font-semibold tracking-wide">
        {voices.join("")}
      </span>
    ) : null;

  // A layer set outside this cycle (an ad-hoc name from an older score) reads as
  // the choir's, because that is the only answer that cannot quietly widen an
  // audience: the pill then shows where the NEXT mark goes, which is the one
  // thing it is there to say.
  const writeLayer = asWriteLayer(layer);
  const layerCopy = useMemo(() => writeLayerCopy(t), [t]);
  const activeLayerCopy = layerCopy[writeLayer];

  // A leader's targets are their own pencil and whatever their grant opens: the
  // choir's page, the desk shared with the conductor, or both. A layer outside
  // them reads as the pencil, the one target that publishes nothing.
  const targetCopy = useMemo(() => delegateTargetCopy(t), [t]);
  const targets: readonly DelegateTarget[] = ["personal", ...delegateLayers];
  const target = targets.find((candidate) => candidate === layer) ?? "personal";
  const nextTarget = targets[(targets.indexOf(target) + 1) % targets.length];
  const activeTargetCopy = targetCopy[target];

  return (
    <div className={cn(wrappingBarChrome, "max-w-full gap-1 p-1.5")}>
      {mode === "conductor" && (
        <button
          type="button"
          onClick={() => setLayer(NEXT_WRITE_LAYER[writeLayer])}
          aria-label={activeLayerCopy.label}
          title={activeLayerCopy.hint}
          className={cn(layerPill, activeLayerCopy.tone)}
        >
          <activeLayerCopy.Icon size={14} aria-hidden="true" />
          {activeLayerCopy.short}
          {voicesBadge}
        </button>
      )}

      {mode === "leader" && (
        // No ladder between a leader's targets, only a turn: one tap moves the
        // NEXT mark to the next of them. The pill wears its target's tone, so a
        // glance says whether the choir, the conductor, or nobody is about to
        // see this.
        <button
          type="button"
          onClick={() => setLayer(nextTarget)}
          aria-label={activeTargetCopy.label}
          title={activeTargetCopy.hint}
          className={cn(
            layerPill,
            activeTargetCopy.tone,
            target === "personal" && "hover:bg-ink-on-inverse/20",
          )}
        >
          <activeTargetCopy.Icon size={target === "personal" ? 12 : 14} aria-hidden="true" />
          {activeTargetCopy.short}
          {target !== "personal" && voicesBadge}
        </button>
      )}

      {mode === "personal" && <PersonalLayerChip />}

      {notifySlot}
      <PendingPill count={pendingCount} />
    </div>
  );
};
