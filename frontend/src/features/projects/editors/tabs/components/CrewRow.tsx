/**
 * @file CrewRow.tsx
 * @description One booked collaborator on this concert, in the row language the
 * cast and the setlist already share: name on top, one metadata line under it,
 * secondary actions on the right edge that surface on hover.
 * The role is edited in place. It is the only thing an assignment adds beyond
 * "this person is on this job", and a whole form column for one text field is
 * what made this tab a third composition for a job two other tabs already do.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/CrewRow
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check, Trash2 } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { InlineEditable } from "@/shared/ui/primitives/InlineEditable";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import type { CrewMemberEntry } from "../../hooks/useCrewAssignments";

interface CrewRowProps {
  readonly entry: CrewMemberEntry;
  readonly isBusy: boolean;
  readonly onSetRole: (role: string) => void;
  readonly onToggleConfirmed: () => void;
  readonly onRemove: () => void;
}

/** Quiet until the pointer is on the row, then it takes its own colour. */
const ACTION_CLASS =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-chip transition-colors pointer-coarse:h-9 pointer-coarse:w-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40";

export function CrewRow({
  entry,
  isBusy,
  onSetRole,
  onToggleConfirmed,
  onRemove,
}: CrewRowProps): React.JSX.Element {
  const { t } = useTranslation();

  const isConfirmed = entry.status === "CON";

  const confirmLabel = isConfirmed
    ? t("projects.crew.card.unconfirm", "Cofnij potwierdzenie rezerwacji")
    : t("projects.crew.card.confirm", "Oznacz rezerwację jako potwierdzoną");

  const removeLabel = t(
    "projects.crew.card.remove_aria",
    "Usuń {{name}} z ekipy",
    { name: entry.displayName },
  );

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-ethereal-ink/3",
        isBusy && "opacity-50",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <Text
          as="span"
          size="sm"
          weight="medium"
          truncate
          color={entry.isUnresolved ? "muted" : "graphite"}
          className={entry.isUnresolved ? "italic" : undefined}
        >
          {entry.displayName}
        </Text>

        <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
          {/* The role is human text, so it is set as text. Uppercased and
              tracked out — the recipe this row used to use — it read as a
              machine-written status rather than as something a producer typed. */}
          <InlineEditable
            value={entry.role}
            onSave={onSetRole}
            variant="subtle"
            disabled={isBusy}
            ariaLabel={t(
              "projects.crew.card.role_aria",
              "Rola na tym koncercie — {{name}}",
              { name: entry.displayName },
            )}
            placeholder={t("projects.crew.card.role_placeholder", "np. Akustyk FOH")}
            emptyDisplay={
              entry.specialtyLabel ||
              t("projects.crew.card.role_empty", "Dodaj rolę")
            }
            className="max-w-full text-ethereal-graphite/60"
          />
          {entry.company && (
            <Caption as="span" color="muted" className="truncate">
              · {entry.company}
            </Caption>
          )}
        </span>
      </span>

      {/* A booking is confirmed by the producer over the phone, not answered
          inside the app — so unlike a singer's invitation this state is theirs
          to set at any point, published or not. The call sheet counts it. */}
      <button
        type="button"
        role="switch"
        aria-checked={isConfirmed}
        onClick={onToggleConfirmed}
        disabled={isBusy}
        title={confirmLabel}
        aria-label={confirmLabel}
        className={cn(
          ACTION_CLASS,
          isConfirmed
            ? "bg-ethereal-sage/12 text-ethereal-sage"
            : "text-ethereal-graphite/35 hover:bg-ethereal-sage/10 hover:text-ethereal-sage",
        )}
      >
        <Check size={14} strokeWidth={isConfirmed ? 3 : 2} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onRemove}
        disabled={isBusy}
        title={removeLabel}
        aria-label={removeLabel}
        className={cn(
          ACTION_CLASS,
          "text-ethereal-graphite/35 hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson",
        )}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </motion.li>
  );
}
