/**
 * @file SetAsideSection.tsx
 * @description "Odłóż uwagi", at the foot of the annotation drawer, for managers.
 * A piece back for a new season brings last season's marks with its edition;
 * this puts them away without erasing them, lists the sets put away, and brings
 * one back.
 *
 * It acts on the edition in front of the reader — in the concert book, the
 * piece whose page is open. A singer's own pencil is never part of a set, and
 * the count on the button says so by counting only the rest. Putting away takes
 * two taps, like clearing the page; bringing a set back takes one, because
 * nothing is lost by it — though to the choir those marks are new again.
 * @module features/annotations/components
 */

import React, { useEffect, useState } from "react";
import { Archive, ArchiveRestore, Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatLocalizedDateTime } from "@/shared/lib/time/intl";
import { Eyebrow } from "@/shared/ui/primitives/typography";

import { useSetAsideMutations, useSetAsideSets } from "../api/choirMarks.queries";

interface SetAsideSectionProps {
  editionId: string;
  /** How many marks on the edition a set would take: everything but personal pencil. */
  count: number;
}

/** How long a first tap stays armed before it lets go on its own. */
const ARMED_MS = 3500;

export const SetAsideSection = ({
  editionId,
  count,
}: SetAsideSectionProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const { data: sets = [] } = useSetAsideSets(editionId, true);
  const { setAside, restoreSet } = useSetAsideMutations(editionId);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), ARMED_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  // A different piece under the reader is a different question.
  useEffect(() => setArmed(false), [editionId]);

  const busy = setAside.isPending || restoreSet.isPending;

  const press = (): void => {
    if (busy || count === 0) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    setAside.mutate();
  };

  return (
    <section className="mt-4 border-t border-line-on-inverse pt-3">
      <Eyebrow as="p" color="ink-on-inverse-muted" className="mb-1">
        {t("annotations.set_aside.title")}
      </Eyebrow>
      <p className="mb-2 text-[11px] leading-snug text-ink-on-inverse/60">
        {t("annotations.set_aside.hint")}
      </p>
      <button
        type="button"
        onClick={press}
        disabled={busy || count === 0}
        className={
          armed
            ? "flex w-full items-center justify-center gap-1.5 rounded-lg bg-ethereal-gold/90 px-2.5 py-1.5 text-xs font-medium text-surface-inverse"
            : "flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink-on-inverse/10 px-2.5 py-1.5 text-xs font-medium text-ink-on-inverse transition-colors hover:bg-ink-on-inverse/20 disabled:opacity-40"
        }
      >
        {armed ? <Check size={13} aria-hidden="true" /> : <Archive size={13} aria-hidden="true" />}
        {armed
          ? t("annotations.set_aside.confirm")
          : t("annotations.set_aside.cta", { count })}
      </button>

      {sets.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {sets.map((set) => (
            <li
              key={set.archived_at}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-xs text-ink-on-inverse">
                  {formatLocalizedDateTime(
                    set.archived_at,
                    { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" },
                    i18n.language,
                  )}
                </span>
                <span className="block text-[10px] text-ink-on-inverse/50">
                  {t("annotations.set_aside.set_count", { count: set.count })}
                </span>
              </span>
              <button
                type="button"
                onClick={() => restoreSet.mutate(set.archived_at)}
                disabled={busy}
                className="flex shrink-0 items-center gap-1 rounded-full bg-ink-on-inverse/10 px-2.5 py-1 text-[11px] font-medium text-ink-on-inverse transition-colors hover:bg-ink-on-inverse/20 disabled:opacity-40"
              >
                <ArchiveRestore size={12} aria-hidden="true" />
                {t("annotations.set_aside.restore")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
