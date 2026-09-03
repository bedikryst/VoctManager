/**
 * @file CopyDeskPrimer.tsx
 * @description What happens to a sentence after it is edited here, in three
 * steps, on the desk's front page.
 *
 * It exists because the desk is the one surface in the app whose effect is not
 * visible from the surface itself: an edit changes nothing a reader can see,
 * and the distance between "I fixed that word" and "the site says it" is a
 * review, a command run from a checkout, and a deploy. An editor who does not
 * know that reads their own untouched page as a bug and edits it again.
 *
 * Stated once, at the front, and not repeated on the pages themselves — the
 * text is what those are for. The third step is deliberately vague about
 * timing: the honest answer is "when the developer next writes the patch out",
 * and inventing an interval would promise something nobody is holding.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/components/CopyDeskPrimer
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Route } from "lucide-react";

import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { Label, Text } from "@/shared/ui/primitives/typography";

interface PrimerStep {
  readonly id: string;
  readonly titleKey: string;
  readonly titleFallback: string;
  readonly bodyKey: string;
  readonly bodyFallback: string;
}

const STEPS: readonly PrimerStep[] = [
  {
    id: "propose",
    titleKey: "copy_desk.primer.propose.title",
    titleFallback: "Piszesz propozycję",
    bodyKey: "copy_desk.primer.propose.body",
    bodyFallback:
      "Klikasz w zdanie, poprawiasz je, zapis idzie sam. Serwis się nie zmienia — przy tym zdaniu staje propozycja.",
  },
  {
    id: "review",
    titleKey: "copy_desk.primer.review.title",
    titleFallback: "Recenzent ją rozstrzyga",
    bodyKey: "copy_desk.primer.review.body",
    bodyFallback:
      "Widzi stare i nowe brzmienie obok siebie i przyjmuje albo odrzuca. Przyjęcie wciąż nie dotyka strony.",
  },
  {
    id: "publish",
    titleKey: "copy_desk.primer.publish.title",
    titleFallback: "Zmiana wchodzi na stronę",
    bodyKey: "copy_desk.primer.publish.body",
    bodyFallback:
      "Przyjęte zdania wpisuje do repozytorium osobne polecenie, a na serwis wprowadza je wdrożenie. Do tego czasu strona mówi to, co mówiła.",
  },
];

export const CopyDeskPrimer = (): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <SectionCard
      as="h2"
      title={t("copy_desk.primer.title", "Jak to działa")}
      icon={<Route size={15} strokeWidth={1.5} aria-hidden="true" />}
    >
      <ol className="flex flex-col gap-3.5">
        {STEPS.map((step, index) => (
          <li key={step.id} className="flex gap-3">
            {/* The numeral carries the ordering, so the text never has to say
                "first" or "then" in three languages. */}
            <span
              aria-hidden="true"
              className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ethereal-gold/30 bg-ethereal-gold/8"
            >
              <Label size="xs" weight="semibold" color="gold">
                {index + 1}
              </Label>
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <Label size="sm" weight="semibold" color="default">
                {t(step.titleKey, step.titleFallback)}
              </Label>
              <Text size="sm" color="graphite">
                {t(step.bodyKey, step.bodyFallback)}
              </Text>
            </div>
          </li>
        ))}
      </ol>

      {/* The one rule that explains a chip an editor will otherwise read as an
          error: Polish is the source, and a translation whose source moved is
          work waiting rather than something broken. */}
      <Text size="sm" color="graphite" className="mt-4 border-t border-hairline pt-3.5">
        {t(
          "copy_desk.primer.source_note",
          "Polski jest źródłem. Kiedy polskie zdanie się zmieni, tłumaczenia przy nim zostają oznaczone jako nieaktualne — nic nie znika i nic nie publikuje się samo.",
        )}
      </Text>
    </SectionCard>
  );
};

CopyDeskPrimer.displayName = "CopyDeskPrimer";
