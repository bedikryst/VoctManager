/**
 * @file layers.ts
 * @description Which layer a mark belongs to, answered once.
 *
 * `layer_name` is a free string on the wire (ad-hoc names like
 * `rehearsal-2026-05-18` are still possible), so every reader has to fold it
 * onto one of the four the panel knows. That fold lived in two components and
 * they agreed only by accident: both ended in `: "shared"`, which means a layer
 * neither had heard of was drawn as the CHOIR's — the one bucket where being
 * wrong publishes something. One function, and the fallback is stated once.
 * @module features/annotations/lib
 */

import type { TFunction } from "i18next";
import { Users, UserCheck, UserCog } from "lucide-react";

import type { EtherealAccent } from "@/shared/ui/primitives/accents";

import type { AnnotationLayer, ScoreAnnotation } from "../types/annotations.dto";

/**
 * The layer this mark is rendered and counted as.
 *
 * An unrecognised name reads as `shared` because that is how the server treats
 * it for a manager (everything that is not somebody's `personal` is theirs to
 * see) — and because these marks only ever reach a reader the server already
 * decided may have them. The fold decides presentation, never access.
 */
export const layerOf = (a: ScoreAnnotation): AnnotationLayer => {
  switch (a.layer_name) {
    case "conductor":
      return "conductor";
    case "leader":
      return "leader";
    case "personal":
      return "personal";
    default:
      return "shared";
  }
};

/** Layers that are addressed to SOMEBODY IN PARTICULAR rather than the choir —
 *  drawn with the private treatment, and never described as "from the conductor"
 *  to the whole ensemble. */
export const isPrivateLayer = (a: ScoreAnnotation): boolean =>
  layerOf(a) !== "shared";

/**
 * The layers a manager may WRITE to, widest audience first.
 *
 * The three are NESTED, not parallel: the choir's marks reach whoever runs the
 * rehearsal and the managers too, and the leader's reach the managers. That is
 * why one rung is picked rather than a set ticked — every combination a reader
 * could want is already a rung, and the two that are not ("the choir but not
 * the stand-in") describe an audience the access rules cannot produce.
 *
 * `personal` is absent on purpose: it is nobody's audience, and it is reached by
 * opening the score as oneself rather than by a control over the choir's marks.
 */
export type WriteLayer = "shared" | "leader" | "conductor";

export const WRITE_LAYERS: readonly WriteLayer[] = ["shared", "leader", "conductor"];

/** One tap from the resting state NARROWS the audience rather than widening it. */
export const NEXT_WRITE_LAYER: Record<WriteLayer, WriteLayer> = {
  shared: "leader",
  leader: "conductor",
  conductor: "shared",
};

export const isWriteLayer = (layer: string): layer is WriteLayer =>
  (WRITE_LAYERS as readonly string[]).includes(layer);

/**
 * A layer set outside this cycle (an ad-hoc name from an older score) reads as
 * the choir's — the only answer that cannot quietly widen an audience, and the
 * same fold `layerOf` performs.
 */
export const asWriteLayer = (layer: string): WriteLayer =>
  isWriteLayer(layer) ? layer : "shared";

export interface WriteLayerCopy {
  Icon: typeof Users;
  /** Full sentence — the accessible name. */
  label: string;
  /** One or two words, for a pill that has to fit a phone. */
  short: string;
  /** Who ends up reading it, stated plainly — the whole answer, because this is
   *  the only line the audience picker gives a reader to decide on. */
  hint: string;
  /**
   * The taxonomy's accent, read through `ACCENT_TILE_*` / `ACCENT_TEXT` on the
   * in-flow surfaces (the cards anchored to a mark).
   */
  accent: EtherealAccent;
  /**
   * The same rung on the viewer's frosted inverse chrome, where the accent
   * tables — written for a light ground — do not reach.
   */
  tone: string;
}

/**
 * How each rung names itself, in one place. Three surfaces read this — the
 * toolbar pill that arms the NEXT mark, and the two cards that move an existing
 * one — and a rung described differently on two of them is a rung the reader
 * cannot trust.
 */
export const writeLayerCopy = (t: TFunction): Record<WriteLayer, WriteLayerCopy> => ({
  shared: {
    Icon: Users,
    label: t("annotations.layer.shared", "Widoczne dla chóru"),
    short: t("annotations.layer.shared_short", "Chór"),
    hint: t("annotations.layer.shared_hint", "Widzi cały chór śpiewający ten utwór"),
    accent: "sage",
    tone: "bg-ethereal-sage/20 text-ethereal-sage",
  },
  leader: {
    Icon: UserCheck,
    label: t("annotations.layer.leader", "Dla prowadzącego próbę"),
    short: t("annotations.layer.leader_short", "Prowadzący"),
    hint: t(
      "annotations.layer.leader_hint",
      "Osoba, której powierzysz prowadzenie próby, i menedżerowie. Chór — nie.",
    ),
    accent: "amethyst",
    tone: "bg-ethereal-amethyst/20 text-ethereal-amethyst",
  },
  conductor: {
    Icon: UserCog,
    label: t("annotations.layer.private", "Prywatne (Ty i menedżerowie)"),
    short: t("annotations.layer.private_short", "Prywatne"),
    hint: t("annotations.layer.private_hint", "Tylko dla Ciebie i pozostałych menedżerów"),
    accent: "graphite",
    tone: "bg-ink-on-inverse/10 text-ink-on-inverse",
  },
});
