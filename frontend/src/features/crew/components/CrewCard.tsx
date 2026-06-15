/**
 * @file CrewCard.tsx
 * @description Roster card for a single collaborator. The whole card opens the
 * editor (click-to-open, matching projects/artists); the inline delete action
 * and the contact links stop propagation. Specialty colour comes from the shared
 * taxonomy badge.
 * @architecture Enterprise SaaS 2026
 * @module features/crew/components/CrewCard
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Briefcase, ChevronRight, Mail, Phone, Trash2 } from "lucide-react";

import type { Collaborator } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import {
  Caption,
  Eyebrow,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";

import { CrewSpecialtyBadge } from "./CrewSpecialtyBadge";

interface CrewCardProps {
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

const CrewCardComponent = ({
  person,
  onOpen,
  onDelete,
}: CrewCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const initials = computeInitials(person.first_name, person.last_name);
  const fullName = `${person.first_name} ${person.last_name}`.trim();

  return (
    <GlassCard
      variant="solid"
      padding="none"
      isHoverable
      role="button"
      tabIndex={0}
      onClick={() => onOpen(person)}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(person);
        }
      }}
      aria-label={t("crew.card.open_aria", {
        defaultValue: "Edytuj: {{name}}",
        name: fullName,
      })}
      className="flex h-full flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
    >
      <div className="flex items-start gap-3.5 p-5 pb-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster shadow-glass-solid"
          aria-hidden="true"
        >
          <Eyebrow color="incense" className="!tracking-[0.16em]">
            {initials}
          </Eyebrow>
        </div>
        <div className="min-w-0 flex-1">
          <Heading as="h3" size="sm" weight="bold" truncate>
            {fullName}
          </Heading>
          <div className="mt-1.5">
            <CrewSpecialtyBadge specialty={person.specialty} size="sm" />
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            stop(event);
            onDelete(person);
          }}
          title={t("crew.card.btn_delete", "Usuń")}
          aria-label={t("crew.card.btn_delete", "Usuń")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ethereal-graphite/40 transition-colors hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="mx-5 flex items-center justify-between gap-3 rounded-xl border border-ethereal-ink/6 bg-ethereal-alabaster/70 px-3.5 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-ethereal-graphite/70">
          <Briefcase size={12} strokeWidth={1.6} aria-hidden="true" />
          <Eyebrow color="muted">{t("crew.card.company", "Firma / Marka")}</Eyebrow>
        </span>
        {person.company_name ? (
          <Text
            as="span"
            size="xs"
            weight="bold"
            truncate
            className="max-w-[55%] text-right text-ethereal-ink"
            title={person.company_name}
          >
            {person.company_name}
          </Text>
        ) : (
          <Caption color="muted" className="italic">
            {t("crew.card.no_company", "Brak danych")}
          </Caption>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5 pt-4">
        {person.email ? (
          <a
            href={`mailto:${person.email}`}
            onClick={stop}
            className="inline-flex min-w-0 items-center gap-2 text-ethereal-graphite transition-colors hover:text-ethereal-ink"
          >
            <Mail size={14} className="shrink-0 text-ethereal-graphite/50" aria-hidden="true" />
            <Text size="sm" weight="medium" truncate>
              {person.email}
            </Text>
          </a>
        ) : (
          <span className="inline-flex items-center gap-2 text-ethereal-graphite/50">
            <Mail size={14} className="shrink-0" aria-hidden="true" />
            <Text size="sm" color="muted" className="italic">
              {t("crew.card.no_email", "Brak e-mail")}
            </Text>
          </span>
        )}
        {person.phone_number ? (
          <a
            href={`tel:${person.phone_number}`}
            onClick={stop}
            className="inline-flex min-w-0 items-center gap-2 text-ethereal-graphite transition-colors hover:text-ethereal-ink"
          >
            <Phone size={14} className="shrink-0 text-ethereal-graphite/50" aria-hidden="true" />
            <Text size="sm" weight="medium" truncate>
              {person.phone_number}
            </Text>
          </a>
        ) : (
          <span className="inline-flex items-center gap-2 text-ethereal-graphite/50">
            <Phone size={14} className="shrink-0" aria-hidden="true" />
            <Text size="sm" color="muted" className="italic">
              {t("crew.card.no_phone", "Brak telefonu")}
            </Text>
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-end border-t border-ethereal-ink/6 px-5 py-3">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ethereal-graphite/55 transition-colors group-hover:text-ethereal-gold">
          {t("crew.card.btn_edit", "Edytuj")}
          <ChevronRight
            size={14}
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </GlassCard>
  );
};

const arePropsEqual = (
  prev: Readonly<CrewCardProps>,
  next: Readonly<CrewCardProps>,
): boolean =>
  prev.person === next.person &&
  prev.onOpen === next.onOpen &&
  prev.onDelete === next.onDelete;

export const CrewCard = React.memo(CrewCardComponent, arePropsEqual);
CrewCard.displayName = "CrewCard";
