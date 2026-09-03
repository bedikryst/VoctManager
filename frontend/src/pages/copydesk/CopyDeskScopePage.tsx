/**
 * @file CopyDeskScopePage.tsx
 * @description `/redakcja/:scope` — one page of the site, editable, in the
 * order it is read. Default export required for the lazy route.
 *
 * The surface is a column of the page's own text, not a table of keys: the
 * contract's declaration order IS the sequence `/koncerty/[id]` prints, so an
 * editor scrolling this is walking the concert page. Everything else on screen
 * is either a language of the same paragraph or an exception worth a chip.
 *
 * The width follows the locale switch. One language wants a measure a person
 * can read; three want the room, and a page that stayed 3xl wide would print
 * the French of a several-hundred-word `note` in a ribbon.
 * @architecture Enterprise SaaS 2026
 * @module pages/copydesk/CopyDeskScopePage
 */

import React, { useCallback, useMemo } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FileQuestion } from "lucide-react";

import { ScopeReviewMark } from "@/features/copydesk/components/ScopeReviewMark";
import { SegmentRow } from "@/features/copydesk/components/SegmentRow";
import {
  useCopyDeskSegments,
  useSaveProposal,
  useWithdrawProposal,
} from "@/features/copydesk/api/copydesk.queries";
import { buildFields } from "@/features/copydesk/lib/fields";
import { formatCount, seenOnDate } from "@/features/copydesk/lib/scopeGroups";
import {
  LOCALE_VIEWS,
  LOCALE_VIEW_ORDER,
  type LocaleViewId,
} from "@/features/copydesk/lib/localeView";
import { isOpen } from "@/features/copydesk/lib/proposals";
import { useCopyDeskSitting } from "@/features/copydesk/model/sittingStore";
import type { CopyDeskProposalWrite } from "@/features/copydesk/types/copydesk.dto";
import type { CopyDeskOutletContext } from "@/widgets/copy-desk-shell/CopyDeskShell";
import { AutosaveStatus } from "@/shared/ui/composites/AutosaveStatus";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { StatLine, type StatLineItem } from "@/shared/ui/composites/StatLine";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Heading } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";

/**
 * Whole strings: a width assembled from a variable generates no CSS.
 *
 * One language is capped at a reading measure and the others are not: a column
 * of prose stops being readable somewhere past 80 characters, but two or three
 * columns each need that measure of their own, and a cap sized for one of them
 * squeezes all three into ribbons with the screen empty on both sides. `all`
 * takes whatever the shell allows.
 */
const VIEW_WIDTH: Readonly<Record<LocaleViewId, string>> = {
  pl: "max-w-3xl",
  "pl-en": "max-w-295",
  "pl-fr": "max-w-295",
  all: "max-w-none",
};

/** The switch says what it does in the languages themselves; nothing to translate. */
const VIEW_LABELS: Readonly<Record<LocaleViewId, string>> = {
  pl: "PL",
  "pl-en": "+EN",
  "pl-fr": "+FR",
  all: "+EN +FR",
};

/**
 * In French, to a French typist, whatever language the desk's chrome is in.
 * `lib/typo.ts` inserts the narrow no-break spaces before `? ! : ;` at build
 * time, so a hand-typed one doubles up — and the doubling is invisible here and
 * visible on the site.
 */
const FRENCH_SPACING_NOTE =
  "N'ajoutez pas d'espace avant « ? ! : ; » : le site les compose lui-même.";

export default function CopyDeskScopePage(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const language = i18n.language || "pl";
  const { scope = "" } = useParams<{ scope: string }>();
  const { contents } = useOutletContext<CopyDeskOutletContext>();

  const view = useCopyDeskSitting((state) => state.localeView);
  const setView = useCopyDeskSitting((state) => state.setLocaleView);
  const noteEdit = useCopyDeskSitting((state) => state.noteEdit);

  const { data, isLoading, error, refetch } = useCopyDeskSegments(scope);
  // `mutate` is stable across renders; the mutation object is not, and a cell
  // holds its save callback in a ref for the flush it runs on unmount.
  const save = useSaveProposal(scope);
  const withdraw = useWithdrawProposal(scope);
  const { mutate: saveProposal } = save;
  const { mutate: withdrawProposal } = withdraw;

  const segments = useMemo(() => data?.segments ?? [], [data]);
  const fields = useMemo(() => buildFields(segments), [segments]);
  const locales = LOCALE_VIEWS[view];

  const summary = contents.scopes.find((entry) => entry.scope === scope);
  const title = summary?.label || segments[0]?.scope_label || scope;

  const onSave = useCallback(
    (payload: CopyDeskProposalWrite) => {
      saveProposal(payload, {
        onSuccess: () => noteEdit(),
        onError: () =>
          toast.error(
            t(
              "copy_desk.editor.save_failed",
              "Nie udało się zapisać tej zmiany. Sprawdź połączenie — tekst nadal jest w polu.",
            ),
          ),
      });
    },
    [noteEdit, saveProposal, t],
  );

  const onWithdraw = useCallback(
    (proposalId: string) => {
      withdrawProposal(proposalId, {
        onError: () =>
          toast.error(
            t("copy_desk.editor.withdraw_failed", "Nie udało się cofnąć zmiany."),
          ),
      });
    },
    [t, withdrawProposal],
  );

  // Counted from the payload this page is drawing, not from the contents list:
  // two figures beside each other have to answer for the same set of rows.
  const touched = useMemo(
    () =>
      segments.filter((segment) =>
        segment.proposals.some(
          (proposal) => proposal.is_mine && isOpen(proposal),
        ),
      ).length,
    [segments],
  );

  const facts: StatLineItem[] = [
    {
      id: "fields",
      value: formatCount(fields.length, language),
      label: t("copy_desk.editor.fields", {
        count: fields.length,
        defaultValue: "pól",
      }),
    },
    {
      id: "segments",
      value: formatCount(segments.length, language),
      label: t("copy_desk.contents.segments", {
        count: segments.length,
        defaultValue: "segmentów",
      }),
    },
  ];
  if (touched > 0) {
    facts.push({
      id: "touched",
      value: formatCount(touched, language),
      label: t("copy_desk.contents.touched", {
        count: touched,
        defaultValue: "ruszonych",
      }),
    });
  }

  if (isLoading) {
    return <EtherealLoader message={t("copy_desk.editor.loading", "Otwieram stronę...")} />;
  }

  if (error || fields.length === 0) {
    return (
      <PageTransition className="min-h-0">
        <div className="mx-auto w-full max-w-xl py-12">
          <StatePanel
            icon={<FileQuestion size={22} aria-hidden="true" />}
            eyebrow={t("copy_desk.eyebrow", "Redakcja")}
            title={t("copy_desk.editor.missing_title", "Tej strony nie ma w redakcji")}
            description={t(
              "copy_desk.editor.missing_description",
              "Korpus wchodzi tu prosto z repozytorium, osobnym krokiem (copy:sync). Wróć do spisu i wybierz stronę z listy.",
            )}
            actions={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="secondary" size="sm" asChild>
                  <Link to="/redakcja">
                    {t("copy_desk.review.back", "Spis treści")}
                  </Link>
                </Button>
                {error && (
                  <Button variant="outline" size="sm" onClick={() => void refetch()}>
                    {t("copy_desk.unreachable.retry", "Spróbuj ponownie")}
                  </Button>
                )}
              </div>
            }
          />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="min-h-0">
      <div
        className={`mx-auto flex w-full flex-col gap-2 pb-16 pt-4 ${VIEW_WIDTH[view]}`}
      >
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            {/* Serif: a concert is a titled event, and the desk names it in the
                same voice the site and the panel do. */}
            <Heading as="h1" size="xl" className="truncate">
              {title}
            </Heading>
            <StatLine stats={facts} />
            {/* Where the reader stands on arrival. The ACT is at the foot, where
                a page has actually been read; this is the same fact stated on
                the way in, read from the same summary so the two cannot
                disagree. Silent on a page never marked — that is the resting
                state, and a line saying "not yet read" would be on every row of
                a corpus nobody has started. */}
            {summary?.seen_at && (
              <Caption color="graphite">
                {t("copy_desk.contents.seen_on", {
                  date: seenOnDate(summary.seen_at, language),
                  defaultValue: "Przejrzane {{date}}",
                })}
              </Caption>
            )}
          </div>
          <SegmentedTabs
            items={LOCALE_VIEW_ORDER.map((id) => ({
              id,
              label: VIEW_LABELS[id],
            }))}
            value={view}
            onChange={setView}
            ariaLabel={t("copy_desk.editor.locale_switch", "Języki na ekranie")}
            className="sm:w-auto"
          />
        </header>

        {/* The controls appear under a field only once it has been touched, and
            the chips appear only where a fact exists — so a legend is the one
            place an editor can meet either before meeting it unannounced. Above
            the text, because that is where the question gets asked, and stated
            in two lines rather than a panel, because it is chrome about chrome. */}
        <Caption color="graphite">
          {t(
            "copy_desk.editor.controls_note",
            "Pod polem, kiedy coś w nim napiszesz: „Oryginał” pokazuje tekst, który jest teraz na stronie, „Uwaga” dopisuje notkę dla wydawcy, „Cofnij” kasuje Twoją propozycję i zostawia tekst ze strony.",
          )}
        </Caption>
        <Caption color="graphite">
          {t(
            "copy_desk.editor.marks_note",
            "Oznaczenia przy polu: „Przyjęte” i „Odrzucone” to werdykt wydawcy, „Polski się zmienił” znaczy, że tłumaczenie napisano do starszej wersji polskiego, a „Nowe” — że pole pojawiło się od Twojej ostatniej wizyty.",
          )}
        </Caption>

        {locales.includes("fr") && (
          <Caption color="graphite" lang="fr">
            {FRENCH_SPACING_NOTE}
          </Caption>
        )}

        <ul className="flex flex-col">
          {fields.map((field) => (
            <SegmentRow
              key={field.key}
              field={field}
              locales={locales}
              onSave={onSave}
              onWithdraw={onWithdraw}
            />
          ))}
        </ul>

        {/* Two sentences at the foot, and they answer different questions. This
            one is the reader's claim about the PAGE — it clears it off the
            contents list and nothing else. */}
        <ScopeReviewMark scope={scope} summary={summary} language={language} />

        {/* And this one is the desk explaining its own silence. An editor who
            never presses "Skończyłem" has lost nothing, and the sentence that
            says so belongs where the question arises. */}
        <Caption color="graphite">
          {t(
            "copy_desk.editor.autosave_note",
            "Zapisuje się samo. Wydawca dostaje zestawienie pół godziny po tym, jak przestaniesz pisać — albo od razu, kiedy klikniesz „Skończyłem” u góry.",
          )}
        </Caption>
      </div>

      {/* The panel's own answer to "is my work saved". It costs the page no
          space — it is portalled, transient, and the desk's surface is already
          full of text. */}
      <AutosaveStatus isSaving={save.isPending || withdraw.isPending} />
    </PageTransition>
  );
}
