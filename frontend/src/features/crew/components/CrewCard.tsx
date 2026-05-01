/**
 * @file CrewCard.tsx
 * @description Memoised card surface for a single collaborator.
 * Built around Ethereal typography primitives, GlassCard surfaces, and
 * specialty-driven accents — zero raw HTML typography or stone palette.
 * @architecture Enterprise SaaS 2026
 * @module features/crew/components/CrewCard
 */

import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Briefcase, Edit2, Mail, Phone, Trash2 } from "lucide-react";

import type { Collaborator } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import {
  Emphasis,
  Eyebrow,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";

import { CrewSpecialtyBadge } from "./CrewSpecialtyBadge";

interface CrewCardProps {
  person: Collaborator;
  onEdit: (person: Collaborator) => void;
  onDelete: (person: Collaborator) => void;
}

interface ContactRowProps {
  icon: React.ReactNode;
  href?: string;
  value?: string;
  fallback: string;
}

function ContactRow({
  icon,
  href,
  value,
  fallback,
}: ContactRowProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 text-ethereal-graphite">
      <span
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-ethereal-incense/15 bg-ethereal-alabaster/60 text-ethereal-graphite/70"
        aria-hidden="true"
      >
        {icon}
      </span>
      {value && href ? (
        <Text
          as="a"
          size="sm"
          href={href}
          color="graphite"
          truncate
          className="transition-colors duration-300 hover:text-ethereal-gold"
        >
          {value}
        </Text>
      ) : (
        <Text size="sm" color="muted" truncate>
          <Emphasis>{fallback}</Emphasis>
        </Text>
      )}
    </div>
  );
}

const computeInitials = (firstName: string, lastName: string): string => {
  const first = firstName?.charAt(0) ?? "";
  const last = lastName?.charAt(0) ?? "";
  return `${first}${last}`.toUpperCase() || "—";
};

const CrewCardComponent = ({
  person,
  onEdit,
  onDelete,
}: CrewCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const initials = computeInitials(person.first_name, person.last_name);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <GlassCard
        variant="ethereal"
        padding="md"
        isHoverable={false}
        className="flex h-full flex-col justify-between border border-ethereal-incense/20 transition-[transform,box-shadow,border-color] duration-500 hover:-translate-y-0.5 hover:border-ethereal-gold/30 hover:shadow-glass-ethereal-hover"
      >
        <div className="flex flex-1 flex-col gap-5">
          <header className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/80 shadow-sm"
              aria-hidden="true"
            >
              <Eyebrow color="incense" className="!tracking-[0.18em]">
                {initials}
              </Eyebrow>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Heading as="h3" size="xl" truncate>
                {person.first_name} {person.last_name}
              </Heading>
              <CrewSpecialtyBadge specialty={person.specialty} size="sm" />
            </div>
          </header>

          <div className="rounded-2xl border border-ethereal-incense/15 bg-ethereal-alabaster/45 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-ethereal-graphite/70">
                <Briefcase size={12} strokeWidth={1.6} aria-hidden="true" />
                <Eyebrow color="muted">
                  {t("crew.card.company", "Firma / Marka")}
                </Eyebrow>
              </div>
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
                <Text as="span" size="xs" color="muted">
                  <Emphasis>{t("crew.card.no_company", "Brak danych")}</Emphasis>
                </Text>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <ContactRow
              icon={<Mail size={14} strokeWidth={1.5} />}
              href={person.email ? `mailto:${person.email}` : undefined}
              value={person.email}
              fallback={t("crew.card.no_email", "Brak e-mail")}
            />
            <ContactRow
              icon={<Phone size={14} strokeWidth={1.5} />}
              href={
                person.phone_number ? `tel:${person.phone_number}` : undefined
              }
              value={person.phone_number}
              fallback={t("crew.card.no_phone", "Brak telefonu")}
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3 border-t border-ethereal-incense/15 pt-5">
          <Button
            variant="outline"
            onClick={() => onEdit(person)}
            leftIcon={<Edit2 size={14} aria-hidden="true" />}
            className="flex-1 justify-center"
          >
            {t("crew.card.btn_edit", "Edytuj")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onDelete(person)}
            leftIcon={<Trash2 size={14} aria-hidden="true" />}
            className="flex-1 justify-center text-ethereal-crimson hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
          >
            {t("crew.card.btn_delete", "Usuń")}
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  );
};

const arePropsEqual = (
  prev: Readonly<CrewCardProps>,
  next: Readonly<CrewCardProps>,
): boolean =>
  prev.person.id === next.person.id &&
  prev.person.first_name === next.person.first_name &&
  prev.person.last_name === next.person.last_name &&
  prev.person.email === next.person.email &&
  prev.person.phone_number === next.person.phone_number &&
  prev.person.company_name === next.person.company_name &&
  prev.person.specialty === next.person.specialty &&
  prev.onEdit === next.onEdit &&
  prev.onDelete === next.onDelete;

export const CrewCard = React.memo(CrewCardComponent, arePropsEqual);
CrewCard.displayName = "CrewCard";
