/**
 * @file ArchiveWelcomeState.tsx
 * @description True-empty-state for a fresh archive (zero pieces ever).
 * Replaces the panel-stack noise (decorative metrics + filters + empty list)
 * with a single welcoming surface: big drop zone front-and-centre, plus a
 * secondary "add manually" escape hatch for the folk-song / no-PDF case.
 *
 * Conductor mental model: "First time here — what do I do?" Answer: drag a
 * PDF in. No filters to navigate, no metrics to puzzle over.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ArchiveWelcomeState
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Sparkles } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Heading, Text } from "@/shared/ui/primitives/typography";

import { EditionUploadZone } from "./EditionUploadZone";

interface ArchiveWelcomeStateProps {
  readonly onAddManually: () => void;
}

export const ArchiveWelcomeState = ({
  onAddManually,
}: ArchiveWelcomeStateProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8">
      <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
        <div className="flex flex-col items-center gap-4 py-8 text-center md:py-12">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-3xl border border-ethereal-gold/40 bg-ethereal-gold/10 text-ethereal-gold"
            aria-hidden="true"
          >
            <Sparkles size={28} strokeWidth={1.5} />
          </span>
          <Heading as="h2" size="3xl" weight="medium" className="font-serif">
            {t(
              "archive.welcome.title",
              "Witaj w bibliotece nut",
            )}
          </Heading>
          <Text color="graphite" className="max-w-xl">
            {t(
              "archive.welcome.body",
              "Przeciągnij PDF partytury poniżej — AI rozpozna utwór w MusicBrainz, doda kompozytora, ekstrahuje IPA i tłumaczenia, zaproponuje notkę programową. Cały pipeline trwa pół minuty.",
            )}
          </Text>
        </div>
        <EditionUploadZone compact />
      </GlassCard>

      <div className="flex flex-col items-center gap-2">
        <Text size="xs" color="muted" className="uppercase tracking-widest">
          {t("archive.welcome.or", "Albo")}
        </Text>
        <Button
          variant="outline"
          onClick={onAddManually}
          leftIcon={<Plus size={16} aria-hidden="true" />}
        >
          {t(
            "archive.welcome.manual_btn",
            "Dodaj utwór ręcznie (bez PDF-u)",
          )}
        </Button>
        <Text size="xs" color="muted" className="mt-1 max-w-md text-center">
          {t(
            "archive.welcome.manual_hint",
            "Użyj dla utworów ludowych, hand-outów albo gdy PDF-a dostaniesz później.",
          )}
        </Text>
      </div>
    </div>
  );
};
