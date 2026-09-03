/**
 * @file DiffText.tsx
 * @description Old → new for one field, read as one paragraph.
 *
 * Three shapes, chosen from the change itself rather than from a control the
 * reviewer has to find:
 *
 *  - **A field the repository holds nothing for** — a first translation. There
 *    is no "old", so nothing is marked: the whole paragraph is the proposal.
 *  - **An edit** — the usual case the desk was built for (§1: nuance, word
 *    choice, clause order). One paragraph, with what left struck through and
 *    what arrived on gold. Two stacked copies of a three-hundred-word `note`
 *    would be six hundred words to read for a verdict about one.
 *  - **A replacement** — where too little survived for an alignment to be a
 *    reading rather than a shredding, the two texts are printed whole, in
 *    order. The threshold is the diff's own `kept` ratio; nobody is asked.
 *
 * Gold for what arrives, graphite for what leaves. A deletion is not an alarm,
 * and crimson on the desk would be the one colour the panel spends on things
 * that are actually wrong.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/components/DiffText
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

import { GROWING_PADDING, GROWING_TEXT } from "./GrowingTextarea";
import { wordDiff } from "../lib/wordDiff";

/**
 * Below this much of the longer text surviving, an inline diff stops being a
 * reading of a change: almost every word carries a mark, and the two versions
 * are easier to compare whole. Measured on letters, so a reflowed paragraph is
 * not mistaken for a rewritten one.
 */
const REPLACEMENT_FLOOR = 0.3;

/** The ground the text sits on, in both shapes, so switching does not reflow. */
const BLOCK = cn(
  "whitespace-pre-wrap wrap-break-word rounded-nested bg-ethereal-parchment/40",
  GROWING_TEXT,
  GROWING_PADDING,
);

interface DiffTextProps {
  /** What the repository holds today — what the site is serving. */
  readonly before: string;
  /** What is being proposed, as it stands right now. */
  readonly after: string;
  readonly lang?: string;
}

export const DiffText = ({
  before,
  after,
  lang,
}: DiffTextProps): React.JSX.Element => {
  const { t } = useTranslation();
  const diff = useMemo(() => wordDiff(before, after), [before, after]);

  if (before.trim() === "") {
    return (
      <Text lang={lang} className={BLOCK}>
        {after}
      </Text>
    );
  }

  if (diff.kept < REPLACEMENT_FLOOR) {
    return (
      <div className="flex flex-col gap-1.5">
        <div>
          <Eyebrow size="overline-sm" color="muted">
            {t("copy_desk.queue.on_the_site", "Na serwisie")}
          </Eyebrow>
          <Text lang={lang} color="graphite" className={BLOCK}>
            {before}
          </Text>
        </div>
        <div>
          <Eyebrow size="overline-sm" color="gold">
            {t("copy_desk.queue.proposed", "Propozycja")}
          </Eyebrow>
          <Text lang={lang} className={BLOCK}>
            {after}
          </Text>
        </div>
      </div>
    );
  }

  return (
    <Text lang={lang} className={BLOCK}>
      {diff.parts.map((part, index) => {
        // The unchanged text is a bare string child: it needs no element, and
        // one span per surviving word would be a few hundred nodes per entry.
        if (part.kind === "same") {
          return (
            <React.Fragment key={`${index}-same`}>{part.text}</React.Fragment>
          );
        }
        if (part.kind === "added") {
          return (
            <Text
              as="mark"
              key={`${index}-added`}
              className="bg-ethereal-gold/20 text-ethereal-ink"
            >
              {part.text}
            </Text>
          );
        }
        // `<del>` brings its own line-through and says what it is to a screen
        // reader; the tone only has to say that a removal is not an alarm.
        return (
          <Text
            as="del"
            key={`${index}-removed`}
            color="graphite"
            className="bg-ethereal-graphite/8"
          >
            {part.text}
          </Text>
        );
      })}
    </Text>
  );
};
