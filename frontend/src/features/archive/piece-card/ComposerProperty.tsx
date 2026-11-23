/**
 * @file ComposerProperty.tsx
 * @description Composer catalogue selection, creation and reference links for
 * the piece. `CreateComposer` is also the composers list's "Dodaj kompozytora".
 */

import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { ArrowUpRight, Info, Plus } from "lucide-react";

import { toastApiError } from "@/shared/api/errors";
import { BodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { cn } from "@/shared/lib/utils";
import type { Composer, Piece } from "@/shared/types";
import { PropertyRow, PROPERTY_CONTROL_CLASS } from "@/shared/ui/composites/PropertyRow";
import { SearchSelect } from "@/shared/ui/composites/SearchSelect";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Text } from "@/shared/ui/primitives/typography";
import { useComposers, useCreateComposer } from "../api/archive.queries";
import { getArchiveEpochLabel } from "../constants/archiveEpochs";
import type { PieceAutosave } from "./usePieceAutosave";

const composerLabel = (composer: Composer): string => {
  const name = [composer.first_name, composer.last_name].filter(Boolean).join(" ");
  const years = [composer.birth_year, composer.death_year].filter(Boolean).join("–");
  return [name, years].filter(Boolean).join(", ");
};

const ComposerInfo = ({ composer, workId }: { composer?: Composer | null; workId?: string | null }) => {
  const { t, i18n } = useTranslation();
  const label = t("archive.piece_card.composer_info");
  const period = composer?.period ? getArchiveEpochLabel(composer.period, t) : "";
  // The catalogue stores the English Wikipedia extract without a language tag.
  const bio = (i18n.resolvedLanguage ?? i18n.language).startsWith("en") ? composer?.bio : "";
  const links = [
    composer?.mbid && {
      href: `https://musicbrainz.org/artist/${composer.mbid}`,
      label: t("archive.piece_card.composer_musicbrainz"),
    },
    composer?.wikidata_qid && {
      href: `https://www.wikidata.org/wiki/${composer.wikidata_qid}`,
      label: "Wikidata",
    },
    workId && { href: `https://musicbrainz.org/work/${workId}`, label: "MusicBrainz" },
  ];
  if (!period && !bio && !links.some(Boolean)) return null;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="icon"
          size="icon"
          className="size-9 min-h-9 shrink-0"
          aria-label={label}
        >
          <Info size={16} aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={label}
          sideOffset={6}
          collisionPadding={12}
          className="z-popover w-80 max-w-(--radix-popover-content-available-width) origin-(--radix-popover-content-transform-origin) space-y-2 rounded-nested border border-hairline-strong bg-ethereal-alabaster p-4 shadow-glass-ethereal popover-motion"
        >
          {composer && <Text as="p" size="md" weight="semibold">{composerLabel(composer)}</Text>}
          {period && <Text as="p" color="graphite">{period}</Text>}
          {bio && <Text as="p">{bio}</Text>}
          {links.map((link) => link && (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-fit items-center gap-1 rounded-control text-sm text-ethereal-ink underline underline-offset-4 focus-visible:outline-ethereal-gold"
            >
              {link.label}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

interface CreateComposerProps {
  /** Already in the surname field on open: what the picker's search held. */
  readonly initialLastName?: string;
  /** Takes focus when the dialog closes; without it, focus returns to whatever opened the dialog. */
  readonly returnFocusId?: string;
  /**
   * What the new composer is for: the card assigns it to the piece, the
   * composers list opens its record. A rejection keeps the dialog open, and
   * "Ponów" runs this again without creating the composer twice.
   */
  readonly onCreated: (composer: Composer) => Promise<void> | void;
  readonly onClose: () => void;
}

/**
 * A new catalogue composer: surname, first name and the two years, in the
 * record's order. The rest of the record (period, MusicBrainz) is filled in
 * its record or by the refresh.
 */
export const CreateComposer = ({ initialLastName = "", returnFocusId, onCreated, onClose }: CreateComposerProps) => {
  const { t } = useTranslation();
  const { mutateAsync: create } = useCreateComposer();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<Composer>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    const fields = new FormData(event.currentTarget);
    const read = (name: string) => String(fields.get(name) ?? "").trim();
    let composer = created;
    setIsSubmitting(true);
    try {
      if (!composer) {
        composer = await create({
          first_name: read("first_name"),
          last_name: read("last_name"),
          birth_year: read("birth_year"),
          death_year: read("death_year"),
        });
        setCreated(composer);
      }
      await onCreated(composer);
      onClose();
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t(composer ? "archive.piece_card.autosave_failed" : "archive.piece_card.composer_error"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !isSubmitting) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-focus-trap bg-surface-inverse/70" />
        {/* Anchored a fifth from the top, as the library's new-piece dialog
            is: on a phone the keyboard covers the lower half, and a centred
            dialog would put its buttons under it. Both side insets plus auto
            margins centre it under its width cap and keep a gutter on a
            phone. */}
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            if (!returnFocusId) return;
            event.preventDefault();
            document.getElementById(returnFocusId)?.focus();
          }}
          className="fixed inset-x-4 top-1/5 z-focus-trap mx-auto max-h-3/4 max-w-md overflow-y-auto rounded-nested border border-hairline-strong bg-ethereal-alabaster p-5 shadow-glass-solid"
        >
          <BodyScrollLock />
          <Dialog.Title asChild>
            <Text as="h2" size="lg" weight="semibold">{t("archive.composers.add_form_title")}</Text>
          </Dialog.Title>
          <form className="mt-4 space-y-4" onSubmit={(event) => void submit(event)}>
            <fieldset disabled={isSubmitting || Boolean(created)} className="grid grid-cols-2 gap-3">
              <Input
                name="last_name"
                label={t("archive.composers.add_last")}
                labelCasing="sentence"
                defaultValue={initialLastName}
                required
              />
              <Input name="first_name" label={t("archive.composers.add_first")} labelCasing="sentence" />
              <Input name="birth_year" label={t("archive.composers.add_birth")} labelCasing="sentence" />
              <Input name="death_year" label={t("archive.composers.add_death")} labelCasing="sentence" />
            </fieldset>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" casing="sentence" disabled={isSubmitting} onClick={onClose}>
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" variant="primary" casing="sentence" isLoading={isSubmitting}>
                {t(created ? "common.actions.retry" : "archive.composers.add_submit")}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export const ComposerProperty = ({ piece, autosave }: { piece: Piece; autosave: PieceAutosave }) => {
  const { t } = useTranslation();
  const { data: catalogue = [] } = useComposers();
  const [newComposer, setNewComposer] = useState<string | null>(null);
  const label = t("archive.form.fields.composer");
  const composer = piece.composer;
  const composerId = composer ? String(composer.id) : "";
  const options = (composer && !catalogue.some((entry) => String(entry.id) === composerId)
    ? [composer, ...catalogue]
    : catalogue
  ).map((entry) => ({ value: String(entry.id), label: composerLabel(entry) }));

  return (
    <PropertyRow label={label} accessory={<ComposerInfo composer={composer} workId={piece.mbid_work} />}>
      {(id) => (
        <>
          <SearchSelect
            id={id}
            ariaLabel={label}
            variant="property"
            className={cn(PROPERTY_CONTROL_CLASS, "w-fit max-w-full")}
            options={options}
            value={composerId}
            placeholder="—"
            clearLabel={t("archive.form.composer_none")}
            searchPlaceholder={t("archive.piece_card.composer_search")}
            onValueChange={(value) => void autosave.saveChoice({ field: "composer_id" }, value || null, id, label).catch(autosave.showSaveError)}
            action={{
              label: t("archive.composers.add_form_title"),
              icon: <Plus size={16} aria-hidden="true" />,
              onSelect: setNewComposer,
            }}
          />
          {newComposer !== null && (
            <CreateComposer
              initialLastName={newComposer}
              returnFocusId={id}
              onCreated={(created) => autosave.saveChoice({ field: "composer_id" }, String(created.id), id, label)}
              onClose={() => setNewComposer(null)}
            />
          )}
        </>
      )}
    </PropertyRow>
  );
};
