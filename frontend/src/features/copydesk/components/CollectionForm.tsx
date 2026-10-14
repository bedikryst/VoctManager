/**
 * @file CollectionForm.tsx
 * @description The collection desk's form: one running total per offline
 * source, the gateway half beside them read-only, then the goal and the rail
 * switch, under one save.
 *
 * The form keeps a draft only for a field somebody has typed in. Every other
 * field shows the server's value, so a refetch (a colleague's save, a payment
 * through the gateway) moves what nobody is editing without touching what
 * somebody is. A save sends only the sources whose figure differs from the
 * server's, which is what lets two people bring two sources up to date without
 * either putting the other's back.
 *
 * Gateway donations are never typed: they are listed apart, with the total the
 * site prints at the top of the page, so nobody enters the total into a source.
 * @module features/copydesk/components/CollectionForm
 */

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, HandCoins, Target } from "lucide-react";
import { toast } from "sonner";

import { toastApiError } from "@/shared/api/errors";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { Input } from "@/shared/ui/primitives/Input";
import { Caption, Text, Unit } from "@/shared/ui/primitives/typography";
import { useSaveCollection } from "../api/collection.queries";
import {
  COLLECTION_SOURCES,
  MAX_TALLY_AMOUNT,
  MAX_TALLY_DONORS,
  RAIL_ADVICE_PERCENT,
  formatPln,
  goalPercent,
  parseWholeNumber,
} from "../lib/collection";
import type {
  CollectionDesk,
  CollectionSource,
  CollectionTally,
  CollectionTallyWrite,
  CollectionWrite,
} from "../types/collection.dto";

type TallyField = "amount" | "donors";
type FieldKey = `${CollectionSource}.${TallyField}` | "goal";

const tallyKey = (source: CollectionSource, field: TallyField): FieldKey =>
  `${source}.${field}`;

interface CollectionFormProps {
  readonly desk: CollectionDesk;
}

export const CollectionForm = ({
  desk,
}: CollectionFormProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const language = i18n.language || "pl";
  const save = useSaveCollection();
  const [drafts, setDrafts] = useState<Partial<Record<FieldKey, string>>>({});
  const [railDraft, setRailDraft] = useState<boolean | null>(null);

  const tallies = useMemo(
    () =>
      new Map<CollectionSource, CollectionTally>(
        desk.tallies.map((tally) => [tally.source, tally]),
      ),
    [desk.tallies],
  );

  const serverValue = (key: FieldKey): string => {
    if (key === "goal") return desk.goal === null ? "" : String(desk.goal);
    const [source, field] = key.split(".") as [CollectionSource, TallyField];
    return String(tallies.get(source)?.[field] ?? 0);
  };
  const valueOf = (key: FieldKey): string => drafts[key] ?? serverValue(key);
  const setDraft = (key: FieldKey, value: string): void =>
    setDrafts((current) => ({ ...current, [key]: value }));

  const errorFor = (key: FieldKey): string | undefined => {
    if (drafts[key] === undefined) return undefined;
    const text = valueOf(key).trim();
    if (key === "goal" && text === "") return undefined;
    const parsed = parseWholeNumber(text);
    if (parsed === null) {
      return t("copy_desk.collection.errors.whole_number", "Wpisz liczbę całkowitą.");
    }
    const max = key === "goal" || key.endsWith(".amount") ? MAX_TALLY_AMOUNT : MAX_TALLY_DONORS;
    if (parsed > max) {
      return t("copy_desk.collection.errors.too_large", "Ta liczba jest za duża.");
    }
    if (key === "goal" && parsed < 1) {
      return t("copy_desk.collection.errors.goal_positive", "Cel musi być większy od zera.");
    }
    return undefined;
  };

  const fieldKeys: readonly FieldKey[] = [
    ...COLLECTION_SOURCES.flatMap((source) => [
      tallyKey(source, "amount"),
      tallyKey(source, "donors"),
    ]),
    "goal",
  ];
  const hasErrors = fieldKeys.some((key) => errorFor(key) !== undefined);

  // Built only when every touched field parses; `hasErrors` gates the save.
  const buildPayload = (): CollectionWrite => {
    const changedTallies: CollectionTallyWrite[] = COLLECTION_SOURCES.flatMap(
      (source) => {
        const amountKey = tallyKey(source, "amount");
        const donorsKey = tallyKey(source, "donors");
        if (drafts[amountKey] === undefined && drafts[donorsKey] === undefined) {
          return [];
        }
        const amount = parseWholeNumber(valueOf(amountKey)) ?? 0;
        const donors = parseWholeNumber(valueOf(donorsKey)) ?? 0;
        const stored = tallies.get(source);
        if (stored && stored.amount === amount && stored.donors === donors) {
          return [];
        }
        return [{ source, amount, donors }];
      },
    );

    const goalText = drafts.goal?.trim();
    const goal =
      goalText === undefined
        ? undefined
        : goalText === ""
          ? null
          : parseWholeNumber(goalText);
    const goalChanged = goal !== undefined && goal !== desk.goal;
    const railChanged = railDraft !== null && railDraft !== desk.show_rail;

    return {
      ...(changedTallies.length > 0 ? { tallies: changedTallies } : {}),
      ...(goalChanged ? { goal } : {}),
      ...(railChanged ? { show_rail: railDraft } : {}),
    };
  };

  const payload = hasErrors ? null : buildPayload();
  const isDirty = payload !== null && Object.keys(payload).length > 0;
  const showRail = railDraft ?? desk.show_rail;
  const percent = goalPercent(desk);

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!payload || !isDirty) return;
    save.mutate(payload, {
      onSuccess: () => {
        setDrafts({});
        setRailDraft(null);
        toast.success(
          t(
            "copy_desk.collection.saved",
            "Zapisane. Strona pokaże nowe liczby w ciągu minuty.",
          ),
        );
      },
      onError: (error) =>
        toastApiError(error, t, {
          fallbackDescription: t(
            "copy_desk.collection.save_failed",
            "Nic nie zostało zapisane. Spróbuj ponownie za chwilę.",
          ),
        }),
    });
  };

  const sourceLabel = (source: CollectionSource): string =>
    t(`copy_desk.collection.source.${source}.label`);
  const sourceHint = (source: CollectionSource): string =>
    t(`copy_desk.collection.source.${source}.hint`);

  const lastChange = (tally: CollectionTally | undefined): string => {
    if (!tally?.updated_at) {
      return t("copy_desk.collection.never_saved", "jeszcze nie wpisane");
    }
    const day = formatLocalizedDate(
      tally.updated_at,
      { year: "numeric", month: "long", day: "numeric" },
      language,
    );
    return tally.updated_by_name
      ? t("copy_desk.collection.changed_by", {
          day,
          name: tally.updated_by_name,
          defaultValue: "zmienione {{day}} · {{name}}",
        })
      : t("copy_desk.collection.changed_on", {
          day,
          defaultValue: "zmienione {{day}}",
        });
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
      <SectionCard
        title={t("copy_desk.collection.sources_title", "Wpłaty poza stroną")}
        icon={<HandCoins size={16} aria-hidden="true" />}
        bodyClassName="flex flex-col gap-6"
      >
        <Text size="sm" color="graphite">
          {t(
            "copy_desk.collection.sources_intro",
            "Przy każdym źródle wpisz całą sumę, jaką widzisz w jego panelu lub na wyciągu, a nie tylko nowe wpłaty.",
          )}
        </Text>

        {COLLECTION_SOURCES.map((source) => {
          const tally = tallies.get(source);
          const amountKey = tallyKey(source, "amount");
          const donorsKey = tallyKey(source, "donors");
          return (
            <div
              key={source}
              role="group"
              aria-label={sourceLabel(source)}
              className="flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <Text weight="medium">{sourceLabel(source)}</Text>
                <Caption color="muted">{lastChange(tally)}</Caption>
              </div>
              <Caption color="muted">{sourceHint(source)}</Caption>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t("copy_desk.collection.amount", "Kwota")}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={valueOf(amountKey)}
                  onChange={(event) => setDraft(amountKey, event.target.value)}
                  error={errorFor(amountKey)}
                  className="tabular-nums"
                  rightElement={<Unit>zł</Unit>}
                />
                <Input
                  label={t("copy_desk.collection.donors", "Darczyńcy")}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={valueOf(donorsKey)}
                  onChange={(event) => setDraft(donorsKey, event.target.value)}
                  error={errorFor(donorsKey)}
                  className="tabular-nums"
                />
              </div>
            </div>
          );
        })}

        <div className="flex flex-col gap-1 border-t border-hairline pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <Text weight="medium" className="inline-flex items-center gap-2">
              <Globe size={14} aria-hidden="true" />
              {t("copy_desk.collection.gateway_label", "Płatności na stronie")}
            </Text>
            <Text size="sm" className="tabular-nums">
              {`${formatPln(desk.gateway.raised, language)} · ${t(
                "copy_desk.collection.donor_count",
                { count: desk.gateway.donors, defaultValue: "{{count}} darczyńców" },
              )}`}
            </Text>
          </div>
          <Caption color="muted">
            {t(
              "copy_desk.collection.gateway_hint",
              "Liczone automatycznie z bramki płatności. Nie wpisuj ich w pola wyżej, bo policzą się dwa razy.",
            )}
          </Caption>
        </div>
      </SectionCard>

      <SectionCard
        title={t("copy_desk.collection.settings_title", "Cel i pasek")}
        icon={<Target size={16} aria-hidden="true" />}
        bodyClassName="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1">
          <Input
            label={t("copy_desk.collection.goal", "Cel zbiórki")}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={String(desk.default_goal)}
            value={valueOf("goal")}
            onChange={(event) => setDraft("goal", event.target.value)}
            error={errorFor("goal")}
            className="tabular-nums"
            rightElement={<Unit>zł</Unit>}
          />
          <Caption color="muted">
            {t("copy_desk.collection.goal_hint", {
              amount: formatPln(desk.default_goal, language),
              defaultValue:
                "Puste pole oznacza cel z konfiguracji serwera: {{amount}}.",
            })}
          </Caption>
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox
            size="md"
            className="mt-0.5"
            checked={showRail}
            onChange={(event) => setRailDraft(event.target.checked)}
          />
          <span className="flex flex-col gap-1">
            <Text as="span" weight="medium">
              {t("copy_desk.collection.rail_label", "Pokazuj pasek postępu w skarbcu")}
            </Text>
            <Caption as="span" color="muted">
              {t("copy_desk.collection.rail_hint", {
                threshold: RAIL_ADVICE_PERCENT,
                percent,
                defaultValue:
                  "Rada: włączaj od około {{threshold}}% celu. Krótki pasek obok zapowiedzianego koncertu wygląda jak wątpliwość, czy wieczór się odbędzie. Teraz: {{percent}}%.",
              })}
            </Caption>
          </span>
        </label>
      </SectionCard>

      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Caption color="muted">
          {t(
            "copy_desk.collection.live_note",
            "Zapis trafia na stronę od razu, bez przeglądu. Każda zmiana kwoty zostaje w historii poniżej.",
          )}
        </Caption>
        <Button
          type="submit"
          variant="primary"
          disabled={!isDirty || hasErrors}
          isLoading={save.isPending}
        >
          {t("copy_desk.collection.save", "Zapisz")}
        </Button>
      </div>
    </form>
  );
};

CollectionForm.displayName = "CollectionForm";
