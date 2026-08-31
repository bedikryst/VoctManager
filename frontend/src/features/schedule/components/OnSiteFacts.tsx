/**
 * @file OnSiteFacts.tsx
 * @description What a singer would otherwise have to ask a stranger for at the
 * door: the entrance, the parking, the dressing room and the one number to call.
 * Shared by both chorister-facing concert surfaces — the spotlight and the event
 * sheet — because a door named one way on one of them and another way on the
 * next is two doors to the reader.
 *
 * They live in the app as well as on the printed day card because that card is a
 * blob fetched on demand and excluded from the query persister: outside a church
 * with no signal it is the one document that cannot open, while these surfaces
 * paint from the persisted cache.
 * @module features/schedule/components/OnSiteFacts
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { DoorOpen, Phone } from "lucide-react";

import type { Project } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

/** Only the day-of columns; the block never reads anything else off a project. */
export type OnSiteProject = Pick<
  Project,
  | "entrance_note"
  | "parking_note"
  | "dressing_room_note"
  | "onsite_contact_name"
  | "onsite_contact_phone"
>;

const read = (value?: string | null): string => value?.trim() || "";

/**
 * Whether there is anything to state at all. The caller owns the surrounding
 * layout and its empty state, so it has to be able to ask before it renders.
 */
export const hasOnSiteFacts = (project: OnSiteProject): boolean =>
  Boolean(
    read(project.entrance_note) ||
      read(project.parking_note) ||
      read(project.dressing_room_note) ||
      read(project.onsite_contact_name) ||
      read(project.onsite_contact_phone),
  );

interface OnSiteFactsProps {
  project: OnSiteProject;
  className?: string;
}

export const OnSiteFacts = ({
  project,
  className,
}: OnSiteFactsProps): React.JSX.Element => {
  const { t } = useTranslation();

  // Only what the producer actually entered: a row reading "Parking: —" answers
  // nothing and pushes the one fact that does answer something further down a
  // phone screen.
  const facts = [
    {
      id: "entrance",
      label: t("schedule.card.onsite.entrance", "Wejście"),
      value: read(project.entrance_note),
    },
    {
      id: "parking",
      label: t("schedule.card.onsite.parking", "Parking"),
      value: read(project.parking_note),
    },
    {
      id: "dressing_room",
      label: t("schedule.card.onsite.dressing_room", "Garderoba"),
      value: read(project.dressing_room_note),
    },
  ].filter((fact) => fact.value);

  const contactName = read(project.onsite_contact_name);
  const contactPhone = read(project.onsite_contact_phone);

  return (
    <div
      className={cn(
        "rounded-2xl border border-ethereal-incense/20 bg-ethereal-incense/10 p-4",
        className,
      )}
    >
      <Eyebrow color="parchment" className="mb-3 flex items-center gap-2">
        <DoorOpen size={13} aria-hidden="true" />
        {t("schedule.card.onsite.title", "Na miejscu")}
      </Eyebrow>

      {facts.length > 0 && (
        <div className="space-y-1.5">
          {facts.map((fact) => (
            <Text key={fact.id} as="p" size="sm" color="ink-on-inverse">
              <Text as="span" color="parchment-muted" className="mr-2">
                {fact.label}
              </Text>
              {fact.value}
            </Text>
          ))}
        </div>
      )}

      {(contactName || contactPhone) && (
        <div
          className={cn(
            facts.length > 0 && "mt-3 border-t border-ethereal-incense/20 pt-3",
          )}
        >
          {/* Unnamed, the role IS the name: a line reading "Kontakt na miejscu"
              under a label saying the same thing states one fact twice. */}
          <Eyebrow color="parchment-muted" className="mb-1.5">
            {t("schedule.card.onsite.contact", "Kontakt na miejscu")}
          </Eyebrow>
          {contactName && (
            <Text as="p" size="sm" color="ink-on-inverse" className="mb-2">
              {contactName}
            </Text>
          )}
          {contactPhone && (
            <Button
              variant="outline"
              size="touch"
              asChild
              leftIcon={<Phone size={13} aria-hidden="true" />}
              className="w-full border-ethereal-incense/40 bg-ethereal-incense/10 text-ethereal-parchment hover:border-ethereal-gold/50 hover:bg-ethereal-incense/20 sm:w-auto"
            >
              <a href={`tel:${contactPhone.replace(/\s+/g, "")}`}>
                {contactPhone}
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
