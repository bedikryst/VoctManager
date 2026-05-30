/**
 * @file LyricsBlock.tsx
 * @description IPA pronunciation guide plus translations into target
 * languages. Single component for both the conductor review surface and the
 * artist-facing materials view — same shape, same rendering.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/repertoire/LyricsBlock
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import type { Translation } from "@/shared/types";

interface LyricsBlockProps {
  readonly ipa?: string;
  readonly translations: readonly Translation[];
}

export const LyricsBlock = ({
  ipa,
  translations,
}: LyricsBlockProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (!ipa && translations.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {ipa && (
        <article className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 p-4">
          <Eyebrow color="muted" size="caption">
            {t("repertoire.lyrics.ipa", "IPA · wymowa")}
          </Eyebrow>
          <pre className="mt-2 whitespace-pre-wrap font-serif text-[13px] leading-relaxed text-ethereal-ink">
            {ipa}
          </pre>
        </article>
      )}
      {translations.map((tr) => (
        <article
          key={tr.id}
          className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 p-4"
        >
          <div className="flex items-baseline justify-between">
            <Eyebrow color="muted" size="caption">
              {t("repertoire.lyrics.translation", "Tłumaczenie · {{lang}}", {
                lang: tr.target_language.toUpperCase(),
              })}
            </Eyebrow>
            {tr.is_singable && (
              <Caption color="muted">
                {t("repertoire.lyrics.singable", "śpiewalne")}
              </Caption>
            )}
          </div>
          <Text
            size="sm"
            className="mt-2 whitespace-pre-wrap leading-relaxed"
          >
            {tr.text}
          </Text>
        </article>
      ))}
    </div>
  );
};
