/**
 * @file CrewRow.tsx
 * @description Dense, click-to-open list row — the list-view counterpart to
 * CrewCard. Click opens the editor; inline delete and contact links stop
 * propagation. Mirrors the artists' ArtistRow rhythm.
 * @architecture Enterprise SaaS 2026
 * @module features/crew/components/CrewRow
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Briefcase, ChevronRight, Mail, Phone, Trash2 } from "lucide-react";

import type { Collaborator } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

import { CrewSpecialtyBadge } from "./CrewSpecialtyBadge";

interface CrewRowProps {
  person: Collaborator;
  onOpen: (person: Collaborator) => void;
  onDelete: (person: Collaborator) => void;
}

const stop = (event: React.SyntheticEvent) => event.stopPropagation();

const computeInitials = (firstName: string, lastName: string): string => {
  const first = firstName?.charAt(0) ?? "";
  const last = lastName?.charAt(0) ?? "";
  return `${first}${last}`.toUpperCase() || "—";
};

const CrewRowComponent = ({
  person,
  onOpen,
  onDelete,
}: CrewRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const initials = computeInitials(person.first_name, person.last_name);
  const fullName = `${person.first_name} ${person.last_name}`.trim();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(person)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(person);
        }
      }}
      aria-label={t("crew.card.open_aria", {
        defaultValue: "Edytuj: {{name}}",
        name: fullName,
      })}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-ethereal-ink/8 bg-ethereal-alabaster px-4 py-3 transition-all hover:border-ethereal-gold/30 hover:bg-ethereal-parchment/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 focus-visible:ring-inset",
      )}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ethereal-incense/20 bg-ethereal-alabaster shadow-glass-solid"
        aria-hidden="true"
      >
        <Eyebrow color="incense" className="!tracking-[0.14em]">
          {initials}
        </Eyebrow>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Text weight="semibold" truncate className="text-ethereal-ink">
            {fullName}
          </Text>
          <CrewSpecialtyBadge specialty={person.specialty} size="sm" />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {person.company_name && (
            <Caption color="muted" className="inline-flex max-w-[14rem] items-center gap-1 truncate">
              <Briefcase size={11} aria-hidden="true" />
              <span className="truncate">{person.company_name}</span>
            </Caption>
          )}
          {person.email && (
            <Caption color="muted" className="inline-flex max-w-[15rem] items-center gap-1 truncate">
              <Mail size={11} aria-hidden="true" />
              <span className="truncate">{person.email}</span>
            </Caption>
          )}
          {person.phone_number && (
            <Caption color="muted" className="inline-flex items-center gap-1">
              <Phone size={11} aria-hidden="true" />
              {person.phone_number}
            </Caption>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={(event) => {
            stop(event);
            onDelete(person);
          }}
          title={t("crew.card.btn_delete", "Usuń")}
          aria-label={t("crew.card.btn_delete", "Usuń")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ethereal-graphite/50 transition-colors hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
        <ChevronRight
          size={16}
          aria-hidden="true"
          className="shrink-0 text-ethereal-graphite/50 transition-transform group-hover:translate-x-0.5 group-hover:text-ethereal-gold"
        />
      </div>
    </div>
  );
};

const arePropsEqual = (
  prev: Readonly<CrewRowProps>,
  next: Readonly<CrewRowProps>,
): boolean =>
  prev.person === next.person &&
  prev.onOpen === next.onOpen &&
  prev.onDelete === next.onDelete;

export const CrewRow = React.memo(CrewRowComponent, arePropsEqual);
CrewRow.displayName = "CrewRow";
