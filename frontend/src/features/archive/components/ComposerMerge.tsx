/**
 * @file ComposerMerge.tsx
 * @description Merging duplicate composers, the list's one act on many rows.
 * "Połącz duplikaty" turns the rows into toggles; `ComposerMergeBar` stands on
 * the dock with the count and "Połącz", which opens `ComposerMergeDialog`. The
 * dialog asks which entry stays: the others' pieces move to it and the others
 * are deleted.
 *
 * The entry that stays is chosen on evidence, so each candidate shows its
 * lifespan, its pieces and whether it is tied to MusicBrainz, and the one tied
 * to MusicBrainz with the most pieces is chosen to begin with.
 * @module features/archive/components/ComposerMerge
 */

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { GitMerge, X } from "lucide-react";

import { toastApiError } from "@/shared/api/errors";
import { Portal } from "@/shared/lib/dom/Portal";
import { BodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { useBottomBarSlot } from "@/shared/lib/dom/useBottomBarSlot";
import type { Composer } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";

import { useMergeComposers } from "../api/archive.queries";
import { composerFullName, composerLifespan, composerListName } from "./ComposerRow";

interface ComposerMergeBarProps {
  readonly selectedCount: number;
  readonly onMerge: () => void;
  readonly onExit: () => void;
}

export const ComposerMergeBar = ({
  selectedCount,
  onMerge,
  onExit,
}: ComposerMergeBarProps): React.JSX.Element => {
  const { t } = useTranslation();
  const slotRef = useBottomBarSlot();

  return (
    <Portal>
      {/* The transform as one string, so the entrance runs on the compositor. */}
      <motion.div
        ref={slotRef}
        initial={{ transform: "translateY(80px)", opacity: 0 }}
        animate={{ transform: "translateY(0px)", opacity: 1 }}
        exit={{ transform: "translateY(80px)", opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 bottom-dock z-dock-bar mx-auto flex w-[min(100%-2rem,36rem)] flex-wrap items-center justify-between gap-3 rounded-nested border border-hairline-strong bg-ethereal-alabaster/90 px-4 py-3 shadow-glass-ethereal"
        role="region"
        aria-label={t("archive.composers.merge_bar_aria", "Łączenie duplikatów")}
      >
        <Text size="sm" color="graphite" role="status">
          {selectedCount < 2
            ? t("archive.composers.merge_hint", "Zaznacz wpisy tego samego kompozytora")
            : t("archive.composers.selected", "Zaznaczono {{count}}", { count: selectedCount })}
        </Text>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            casing="sentence"
            onClick={onMerge}
            disabled={selectedCount < 2}
            leftIcon={<GitMerge size={16} aria-hidden="true" />}
          >
            {t("archive.composers.merge_open", "Połącz")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            casing="sentence"
            onClick={onExit}
            leftIcon={<X size={16} aria-hidden="true" />}
          >
            {t("archive.composers.merge_done", "Zakończ")}
          </Button>
        </div>
      </motion.div>
    </Portal>
  );
};

/** Tied to MusicBrainz first, then the most pieces: the record worth keeping. */
const richestFirst = (a: Composer, b: Composer): number =>
  Number(Boolean(b.mbid)) - Number(Boolean(a.mbid)) || (b.pieces_count ?? 0) - (a.pieces_count ?? 0);

interface ComposerMergeDialogProps {
  readonly composers: readonly Composer[];
  readonly onClose: () => void;
  readonly onMerged: () => void;
}

export const ComposerMergeDialog = ({
  composers,
  onClose,
  onMerged,
}: ComposerMergeDialogProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { mutateAsync: merge, isPending } = useMergeComposers();
  const [targetId, setTargetId] = useState<string>(() =>
    String([...composers].sort(richestFirst)[0]?.id ?? ""),
  );
  const target = composers.find((composer) => String(composer.id) === targetId);
  const sources = composers.filter((composer) => String(composer.id) !== targetId);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target || isPending) return;
    try {
      // One at a time: each merge moves the source's pieces onto the target
      // and deletes the source, and two at once would race on the target.
      for (const source of sources) {
        await merge({ sourceId: String(source.id), targetId });
      }
      toast.success(
        t("archive.composers.merge_success", "Połączono w: {{target}}", {
          target: composerFullName(target),
        }),
      );
      onMerged();
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t("archive.composers.merge_error", "Nie udało się połączyć kompozytorów."),
      });
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !isPending) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-focus-trap bg-surface-inverse/70" />
        <Dialog.Content className="fixed inset-x-4 top-1/5 z-focus-trap mx-auto max-h-3/4 max-w-md overflow-y-auto rounded-nested border border-hairline-strong bg-ethereal-alabaster p-5 shadow-glass-solid">
          <BodyScrollLock />
          <Dialog.Title asChild>
            <Text as="h2" size="lg" weight="semibold">
              {t("archive.composers.merge_title", "Połącz duplikaty")}
            </Text>
          </Dialog.Title>
          <Dialog.Description asChild>
            <Text as="p" size="sm" color="graphite" className="mt-1">
              {t(
                "archive.composers.merge_desc",
                "Wybierz wpis, który zostaje. Utwory pozostałych przejdą do niego, a ich wpisy zostaną usunięte.",
              )}
            </Text>
          </Dialog.Description>

          <form className="mt-4 flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
            <fieldset disabled={isPending}>
              <legend className="sr-only">
                {t("archive.composers.merge_target_group_aria", "Wpis, który zostaje")}
              </legend>
              <div className="border-b border-hairline">
                {composers.map((composer) => {
                  const id = String(composer.id);
                  const pieces = composer.pieces_count ?? 0;
                  const facts = [
                    composerLifespan(composer),
                    t("archive.composers.pieces", "{{count}} utworów", { count: pieces }),
                    composer.mbid ? "MusicBrainz" : null,
                  ].filter(Boolean);
                  return (
                    <label
                      key={id}
                      className="-mx-2 flex cursor-pointer items-start gap-3 rounded-control border-t border-hairline px-2 py-3 transition-colors hover:bg-ethereal-ink/3 has-checked:bg-ethereal-gold/5"
                    >
                      {/* The native radio ignores the theme, so it is drawn
                          beside a visually hidden input that keeps the
                          semantics, the arrow keys and the focus. */}
                      <input
                        type="radio"
                        name="merge-target"
                        value={id}
                        checked={id === targetId}
                        onChange={() => setTargetId(id)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border border-ethereal-incense/50 transition-colors after:size-2 after:rounded-full after:bg-ethereal-gold after:opacity-0 peer-checked:border-ethereal-gold peer-checked:after:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-ethereal-gold/50"
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <Text as="span" size="base" weight="medium" className="wrap-break-word leading-snug">
                          {composerListName(composer)}
                        </Text>
                        <Text as="span" size="sm" color="muted">
                          {facts.join(" · ")}
                        </Text>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <Text as="p" size="sm" color="graphite" role="status">
              {sources.length > 0
                ? t("archive.composers.merge_removed", "Zostaną usunięte: {{names}}", {
                    names: sources.map(composerListName).join("; "),
                  })
                : null}
            </Text>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" casing="sentence" disabled={isPending} onClick={onClose}>
                {t("common.actions.cancel", "Anuluj")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                casing="sentence"
                isLoading={isPending}
                disabled={!target || sources.length === 0}
                leftIcon={<GitMerge size={16} aria-hidden="true" />}
              >
                {t("archive.composers.merge_confirm", "Połącz")}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
