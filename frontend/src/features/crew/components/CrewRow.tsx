/**
 * @file CrewRow.tsx
 * @description One collaborator, as a `RecordRow`: the row opens the editor
 * panel. The specialty's icon leads, a category in the canon's sense; under
 * the name, the specialty and the company as a byline. "Inne" names no
 * specialty, so the byline leaves it out and the company stands alone.
 *
 * Contact is why this list is opened, so it sits in the row's one menu, with
 * the number or the address under each act, rather than leaving the row:
 * "Zadzwoń" and "Napisz e-mail" where there is something to dial or write to,
 * then "Usuń".
 * @module features/crew/components/CrewRow
 */

import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Mail, MoreHorizontal, Phone, Trash2 } from "lucide-react";

import type { Collaborator } from "@/shared/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import { RecordRow, recordActionClass } from "@/shared/ui/composites/RecordList";
import { Button } from "@/shared/ui/primitives/Button";

import { getCrewSpecialtyOption } from "../constants/crewSpecialties";

interface CrewRowProps {
  readonly person: Collaborator;
  readonly onOpen: (person: Collaborator) => void;
  readonly onDelete: (person: Collaborator) => void;
}

const CrewRowComponent = ({ person, onOpen, onDelete }: CrewRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  // Delete opens a confirmation once the menu has handed focus back to its
  // trigger, so the dialog returns focus there when it closes.
  const deleteChosen = useRef(false);

  const fullName = `${person.first_name} ${person.last_name}`.trim();
  const specialty = getCrewSpecialtyOption(t, person.specialty);
  const SpecialtyIcon = specialty.icon;
  const phone = person.phone_number?.trim() || null;
  const email = person.email?.trim() || null;

  return (
    <RecordRow
      open={{ onOpen: () => onOpen(person) }}
      title={fullName}
      voice="name"
      leading={
        <span className="flex size-9 items-center justify-center text-ethereal-graphite">
          <SpecialtyIcon size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
      }
      facts={[specialty.value === "OTHER" ? null : specialty.label, person.company_name?.trim() || null]}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="icon"
              size="icon"
              className={recordActionClass}
              aria-label={t("crew.row.menu_aria", "Więcej: {{name}}", { name: fullName })}
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            onCloseAutoFocus={() => {
              if (!deleteChosen.current) return;
              deleteChosen.current = false;
              onDelete(person);
            }}
          >
            {phone && (
              <DropdownMenuItem
                icon={<Phone size={16} />}
                description={phone}
                onSelect={() => window.location.assign(`tel:${phone.replace(/\s+/g, "")}`)}
              >
                {t("crew.row.call", "Zadzwoń")}
              </DropdownMenuItem>
            )}
            {email && (
              <DropdownMenuItem
                icon={<Mail size={16} />}
                description={email}
                onSelect={() => window.location.assign(`mailto:${email}`)}
              >
                {t("crew.row.email", "Napisz e-mail")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              destructive
              icon={<Trash2 size={16} />}
              onSelect={() => {
                deleteChosen.current = true;
              }}
            >
              {t("crew.row.delete", "Usuń")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
};

export const CrewRow = React.memo(CrewRowComponent);
CrewRow.displayName = "CrewRow";
