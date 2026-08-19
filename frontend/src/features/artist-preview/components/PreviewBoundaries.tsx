/**
 * @file PreviewBoundaries.tsx
 * @description The two lists — what the member cannot see, and what this screen
 * will not show you — behind one trigger in the preview's header.
 *
 * The four tabs answer "what does their app look like". These lists answer the
 * question that is actually asked out loud: "can they see the fees?", "why is
 * there no Messages tab here?". Neither answer lives on any of the surfaces —
 * an absence is invisible by definition, and a manager reading a page that does
 * not mention money cannot tell whether money is withheld or simply absent
 * today.
 *
 * A sheet rather than an inline panel: fifteen sentences above the preview
 * would push the thing being previewed off a phone screen, and the lists are
 * reference material — read once, then closed. The trigger sits in the identity
 * bar because that bar is the manager's chrome; everything below it belongs to
 * the member.
 * @module features/artist-preview/components/PreviewBoundaries
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { EyeOff, Lock, ShieldCheck } from "lucide-react";

import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { Button } from "@/shared/ui/primitives/Button";
import { Heading, Text } from "@/shared/ui/primitives/typography";

/** One line of either list. The dot is decoration; the sentence is the answer. */
const BoundaryItem = ({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element => (
  <li className="flex gap-2.5">
    <span
      aria-hidden="true"
      className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ethereal-gold/60"
    />
    <Text color="graphite" className="block leading-relaxed">
      {children}
    </Text>
  </li>
);

const BoundaryList = ({
  icon,
  title,
  lead,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  lead: string;
  children: React.ReactNode;
}): React.JSX.Element => (
  <section className="min-w-0">
    <div className="mb-2 flex items-center gap-2">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-ethereal-incense/25 bg-ethereal-parchment/50 text-ethereal-graphite"
      >
        {icon}
      </span>
      <Heading as="h3" size="md" weight="bold">
        {title}
      </Heading>
    </div>
    <Text size="sm" color="muted" className="mb-3 block">
      {lead}
    </Text>
    <ul className="flex flex-col gap-2">{children}</ul>
  </section>
);

export const PreviewBoundaries = (): React.JSX.Element => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        leftIcon={<EyeOff size={13} aria-hidden="true" />}
      >
        {t("artist_preview.boundaries.trigger", "Co jest ukryte")}
      </Button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t("artist_preview.boundaries.sheet_title", "Co jest ukryte")}
        subtitle={t(
          "artist_preview.boundaries.sheet_subtitle",
          "Po obu stronach tego ekranu",
        )}
      >
        <div className="grid gap-7 pb-2 sm:grid-cols-2 sm:gap-8">
          <BoundaryList
            icon={<Lock size={14} />}
            title={t(
              "artist_preview.boundaries.from_member.title",
              "Czego nie widzi chórzysta",
            )}
            lead={t(
              "artist_preview.boundaries.from_member.lead",
              "Ty masz to w panelu — na ich urządzeniu tego nie ma",
            )}
          >
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_member.money",
                "Żadnych kwot — łącznie z własną stawką. Honorarium dociera do człowieka umową, nie aplikacją.",
              )}
            </BoundaryItem>
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_member.budgets",
                "Budżetów, umów i PDF-ów umów.",
              )}
            </BoundaryItem>
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_member.drafts",
                "Projektów w przygotowaniu — dopóki projekt jest szkicem, nie ma go w ich kalendarzu ani prób do niego.",
              )}
            </BoundaryItem>
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_member.announcements",
                "Ogłoszeń przed publikacją — szkic to cisza.",
              )}
            </BoundaryItem>
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_member.absences",
                "Kto jeszcze był nieobecny — karta próby podaje liczbę, nigdy nazwiska.",
              )}
            </BoundaryItem>
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_member.capabilities",
                "Danych warsztatowych: czytania a vista i skali głosu.",
              )}
            </BoundaryItem>
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_member.contacts",
                "Kontaktu do innych śpiewaków — w katalogu zespołu jest imię, nazwisko, awatar i głos.",
              )}
            </BoundaryItem>
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_member.documents",
                "Dokumentów z kategorii nieudostępnionych chórzystom.",
              )}
            </BoundaryItem>
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_member.archive",
                "Archiwum utworów — widzą program swoich koncertów, nigdy katalogu.",
              )}
            </BoundaryItem>
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_member.after_concert",
                "Nut i nagrań po koncercie — materiały zamykają się dla projektów zakończonych i odwołanych.",
              )}
            </BoundaryItem>
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_member.protected",
                "Wydań chronionych licencją — nieznana licencja też jest traktowana jak chroniona.",
              )}
            </BoundaryItem>
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_member.manager_panel",
                "Całego panelu menedżera: artystów, obecności, archiwum, logistyki, ekipy i projektów.",
              )}
            </BoundaryItem>
          </BoundaryList>

          <BoundaryList
            icon={<ShieldCheck size={14} />}
            title={t(
              "artist_preview.boundaries.from_you.title",
              "Czego nie zobaczysz tutaj",
            )}
            lead={t(
              "artist_preview.boundaries.from_you.lead",
              "Świadomie — to należy wyłącznie do tej osoby",
            )}
          >
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_you.readiness",
                "Gotowości partii — obiecaliśmy chórzyście, że tej notatki nie widzi nikt poza nim. Podgląd pokazuje w jej miejscu „ukryta”.",
              )}
            </BoundaryItem>
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_you.messages",
                "Wiadomości 1:1 — rozmowy są prywatne, także przed menedżerem. Dlatego nie ma tu zakładki Wiadomości.",
              )}
            </BoundaryItem>
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_you.notifications",
                "Skrzynki powiadomień — licznik należy do konta, które ją czyta.",
              )}
            </BoundaryItem>
            <BoundaryItem>
              {t(
                "artist_preview.boundaries.from_you.controls",
                "Żadnego przycisku nie da się tu nacisnąć: obecność, dokumenty i pobieranie offline zostają na ekranie, ale nie działają.",
              )}
            </BoundaryItem>
          </BoundaryList>
        </div>
      </BottomSheet>
    </>
  );
};
