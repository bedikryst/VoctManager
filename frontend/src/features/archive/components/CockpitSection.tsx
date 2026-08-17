/**
 * @file CockpitSection.tsx
 * @description The Piece Card's structural shells: a collapsible section card,
 * the titled sub-block that clusters related fields inside it, and the label +
 * provenance-chip header that sits over a single control. Presentation only —
 * they hold no piece data and no form state, which is what lets the long review
 * cockpit be assembled from them without the page owning their internals.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/CockpitSection
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Eyebrow } from "@/shared/ui/primitives/typography";

/**
 * Label + provenance chip header over a control. It exists because the `Input`
 * API has no label-adornment slot, so the chip cannot ride along inside it — but
 * the label itself is the same `Eyebrow` the primitive renders, at the same
 * size, colour and offset. The wrapped control uses `aria-label`, not a second
 * visible label, which is why this one is not an `as="label"`.
 */
export const LabeledField = ({
  label,
  chip,
  children,
}: {
  label: string;
  chip?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element => (
  <div className="flex w-full flex-col gap-1.5">
    <div className="flex items-center gap-2">
      <Eyebrow color="muted" className="ml-1">
        {label}
      </Eyebrow>
      {chip}
    </div>
    {children}
  </div>
);

/**
 * A cockpit section. Only opacity/transform animate (the chevron rotates, the
 * body fades) — height is not animated, per the motion guidelines.
 *
 * `collapsible` is off for the sections the reader came for (metadata, details,
 * editions): a disclosure over a body that is always open is a control with
 * nothing to control, and its only reachable outcome is hiding the work. The
 * chevron stays where collapsing is a real choice — a generated note, a list of
 * reference recordings, a backlog already cleared.
 *
 * `pending` is the section's own review backlog and `dirty` its unsaved-edit
 * flag. A collapsed header that says only "Tłumaczenia · 3" hides whether any of
 * the three still needs a human — or whether one of them holds a correction
 * nobody has saved; both chips carry that to the outside, because the work a
 * review exists to do must never be behind a chevron.
 */
export const CockpitSection = ({
  label,
  icon,
  count,
  pending = 0,
  dirty = false,
  collapsible = true,
  defaultOpen = false,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  count?: number;
  pending?: number;
  dirty?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);

  const marks = (
    <>
      {dirty && (
        <Badge variant="warning" casing="natural" className="py-0">
          {t("archive.piece_card.section_dirty", "Niezapisane")}
        </Badge>
      )}
      {pending > 0 && (
        <Badge variant="amethyst" casing="natural" className="py-0">
          {t("archive.piece_card.section_pending", "{{count}} do sprawdzenia", {
            count: pending,
          })}
        </Badge>
      )}
      {typeof count === "number" && (
        <Badge variant="neutral" className="py-0 tabular-nums">
          {count}
        </Badge>
      )}
    </>
  );
  const glyph = icon && (
    <span className="text-ethereal-gold" aria-hidden="true">
      {icon}
    </span>
  );

  if (!collapsible) {
    return (
      <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
        <div className="flex w-full items-center gap-3">
          {glyph}
          <Eyebrow color="graphite" className="flex-1">
            {label}
          </Eyebrow>
          {marks}
        </div>
        <div className="mt-4">{children}</div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-left"
      >
        {glyph}
        <Eyebrow color="graphite" className="flex-1">
          {label}
        </Eyebrow>
        {marks}
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-ethereal-graphite/50"
          aria-hidden="true"
        >
          <ChevronRight size={16} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-4"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};

/**
 * A titled sub-block inside a cockpit section. The gradient hairline beside the
 * title reads as a divider, so related fields cluster (Identity / Musical / Text)
 * instead of pooling into one undifferentiated stack — the layout controls its
 * own inner grid via `className`.
 */
export const FieldGroup = ({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element => (
  <div className="space-y-3">
    <div className="flex items-center gap-2.5">
      <Eyebrow color="graphite" className="shrink-0">
        {title}
      </Eyebrow>
      <span
        aria-hidden="true"
        className="h-px flex-1 bg-linear-to-r from-hairline-strong to-transparent"
      />
    </div>
    <div className={className}>{children}</div>
  </div>
);
