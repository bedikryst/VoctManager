/**
 * @file PieceProperties.tsx
 * @description Editable metadata laid out in the piece's record sections.
 * `recordSections` names the sections in order, with the review group whose
 * count each carries; the page's section index reads the same list, so the
 * index and the record cannot disagree about what is on the page.
 *
 * An optional property of Dane that is empty, and that nobody has to check,
 * is not a row of its own: it is named on one closing line, "Dodaj: Opus,
 * Rok kompozycji", and choosing it puts its row in place with focus in it.
 * The row then stays for as long as the card is open, filled or not.
 */

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import type { Piece } from "@/shared/types";
import { isAiProvenance, pieceFieldProvenance, type ReviewSection } from "../constants/pieceProvenance";
import { PropertyRow, PROPERTY_CONTROL_CLASS } from "@/shared/ui/composites/PropertyRow";
import { Select, type SelectOption } from "@/shared/ui/primitives/Select";
import { Heading, Label, Text } from "@/shared/ui/primitives/typography";
import { pieceFieldSchema } from "./pieceFieldSchema";
import { getArchiveEpochLabel, getArchiveEpochOptions } from "../constants/archiveEpochs";
import { getArchiveLanguageChoices } from "../constants/archiveLanguages";
import { CommitText } from "./CommitText";
import { ComposerProperty } from "./ComposerProperty";
import { displayMusicalKey } from "./musicalKey";
import { PieceProgramNote, PieceTranslations } from "./PieceAudienceText";
import { usePieceFieldReview } from "./PieceFieldReview";
import { PieceLyrics } from "./PieceLyrics";
import { PieceMovements } from "./PieceMovements";
import { PieceRecordings } from "./PieceRecordings";
import { PieceVoices } from "./PieceVoices";
import { RecordText, RecordTextLabel } from "./RecordText";
import { RecordNote } from "./RecordNote";
import { pieceDuration } from "./pieceDuration";
import { recordContradictions } from "./recordContradictions";
import type { PieceAutosave } from "./usePieceAutosave";

interface PiecePropertiesProps {
  readonly piece: Piece;
  readonly autosave: PieceAutosave;
}

export type RecordSectionId =
  | "properties" | "voices" | "text" | "translations"
  | "movements" | "program-note" | "recordings" | "tracks" | "editions";

export interface RecordSectionEntry {
  readonly id: RecordSectionId;
  /** The element id the section is rendered under. */
  readonly anchor: string;
  readonly titleKey: string;
  /** A shorter name for the index, where the full title would push sections out of the row. */
  readonly indexKey?: string;
  /** The review group counted for this section, if it holds checkable fields. */
  readonly review: ReviewSection | null;
}

/** The element id a section is rendered under. */
export const sectionAnchor = (id: RecordSectionId): string => `record-${id}`;

const section = (
  id: RecordSectionId,
  titleKey: string,
  review: ReviewSection | null = null,
  indexKey?: string,
): RecordSectionEntry => ({ id, anchor: sectionAnchor(id), titleKey, review, indexKey });

/** The record's sections in reading order: content first, files last. */
export const recordSections = (piece: Piece): readonly RecordSectionEntry[] => [
  section("properties", "archive.piece_card.section.properties", "properties"),
  section("voices", "archive.piece_card.fields.voicing", "voices"),
  section("text", "archive.piece_card.group.text", "text"),
  // Offered once there is text to translate or a translation to keep.
  ...(piece.translations?.length || piece.lyrics_original?.trim()
    ? [section("translations", "archive.piece_card.translations_section", "translations")]
    : []),
  section("movements", "archive.piece_card.movements_section", "movements"),
  section("program-note", "archive.piece_card.program_note_section", null, "archive.piece_card.index.program_note"),
  section("recordings", "archive.piece_card.recordings_section", null, "archive.piece_card.index.recordings"),
  section("tracks", "archive.piece_card.tracks_section", null, "archive.piece_card.index.tracks"),
  section("editions", "archive.piece_card.editions_section", null, "archive.piece_card.index.editions"),
];

type TextField = "arranger" | "opus_catalog" | "musical_key" | "voicing" | "text_source";

interface ReviewRowProps extends PiecePropertiesProps {
  readonly label: string;
  readonly field: Parameters<PieceAutosave["confirm"]>[0];
  readonly children: (id: string) => ReactNode;
}

const ReviewRow = ({ children, ...props }: ReviewRowProps) => {
  const controlId = useId();
  const { marker, action } = usePieceFieldReview({ ...props, controlId });
  return <PropertyRow label={props.label} marker={marker} action={action} controlId={controlId}>{children}</PropertyRow>;
};

const TextProperty = ({ piece, autosave, field, label }: Omit<ReviewRowProps, "children" | "field"> & {
  readonly field: TextField;
}) => {
  const { t, i18n } = useTranslation();
  const schema = pieceFieldSchema.shape[field];
  const stored = piece[field] ?? "";
  return (
    <ReviewRow piece={piece} autosave={autosave} label={label} field={field}>
      {(id) => (
        <CommitText
          id={id}
          wraps
          value={field === "musical_key" ? displayMusicalKey(stored, i18n.language) : stored}
          draftField={autosave.track(field, label)}
          onCommit={(next) => schema.safeParse(next).success
            ? autosave.save(field, next)
            : t("archive.piece_card.field_too_long")}
        />
      )}
    </ReviewRow>
  );
};

const RecordSection = ({ entry, children }: { entry: RecordSectionEntry; children: ReactNode }) => {
  const { t } = useTranslation();
  const headingId = useId();
  return (
    // Clears the phone's top bar and the sticky index when the index scrolls here.
    <section id={entry.anchor} aria-labelledby={headingId} className="scroll-mt-28 lg:scroll-mt-16">
      {/* Focusable from the index, so a keyboard reader lands in the section.
          Set in the title's voice: the card reads as one document, not as a
          form under a handsome title. */}
      <Heading as="h2" id={headingId} tabIndex={-1} size="3xl" weight="medium" className="mb-3 focus:outline-none">
        {t(entry.titleKey)}
      </Heading>
      {children}
    </section>
  );
};

/**
 * A note under a property row, its text on the value's left edge: from 1024 px
 * the value starts after `PropertyRow`'s 10.5rem label column and its gap, and
 * both the control and the note pad their text by the same 0.5rem.
 */
const PropertyNote = ({ isReviewing, children }: { isReviewing: boolean; children: string }) => (
  <div className="-mt-1 mb-1 -ml-2 lg:ml-43">
    <RecordNote isReviewing={isReviewing}>{children}</RecordNote>
  </div>
);

const RowSelect = ({ id, value, options, onValueChange }: {
  id: string;
  value: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
}) => {
  const { t } = useTranslation();
  return (
    <Select
      id={id}
      value={value}
      options={options}
      onValueChange={onValueChange}
      placeholder="—"
      clearLabel={t("archive.piece_card.clear_field")}
      variant="property"
      className={cn(PROPERTY_CONTROL_CLASS, "w-fit max-w-full")}
    />
  );
};

type OptionalField =
  | "arranger" | "opus_catalog" | "musical_key" | "language" | "epoch"
  | "composition_year" | "estimated_duration" | "description";

const isEmpty = (piece: Piece, field: OptionalField): boolean => {
  const value = piece[field];
  if (typeof value === "string") return value.trim() === "";
  return value === null || value === undefined || value === 0;
};

/** The empty optional properties, named on one line; choosing one opens its row. */
const MissingProperties = ({ fields, onAdd }: {
  fields: readonly { readonly field: OptionalField; readonly label: string }[];
  onAdd: (field: OptionalField) => void;
}) => {
  const { t } = useTranslation();
  const labelId = useId();
  return (
    <div className="grid grid-cols-1 gap-x-3 py-1 lg:grid-cols-[10.5rem_minmax(0,1fr)] lg:py-0">
      <Label id={labelId} size="base" color="graphite" className="pt-2 lg:py-3">
        {t("archive.piece_card.missing_fields")}
      </Label>
      {/* Spaced, not dotted: the names wrap, and a separator left at a
          line's end reads as a stray mark. */}
      <div role="group" aria-labelledby={labelId} className="-ml-2 flex flex-wrap items-center gap-x-2 lg:py-1">
        {fields.map(({ field, label }) => (
          <button
            key={field}
            type="button"
            onClick={() => onAdd(field)}
            className="min-h-11 rounded-control px-2 text-ethereal-graphite transition-colors hover:bg-ethereal-ink/6 hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 fine-pointer:min-h-9"
          >
            <Text as="span" size="base" color="inherit">{label}</Text>
          </button>
        ))}
      </div>
    </div>
  );
};

export const PieceProperties = ({ piece, autosave, score, tracks, editions, isReviewing }: PiecePropertiesProps & {
  readonly score?: ComponentProps<typeof PieceMovements>["score"];
  /**
   * The tracks and the edition list, owned by the page because its drop
   * target covers the page and hands each its files.
   */
  readonly tracks: ReactNode;
  readonly editions: ReactNode;
  readonly isReviewing: boolean;
}) => {
  const { t } = useTranslation();
  const notesId = useId();
  const [revealed, setRevealed] = useState<ReadonlySet<OptionalField>>(() => new Set());
  const arrangerLabel = t("archive.piece_card.fields.arranger");
  const opusLabel = t("archive.piece_card.fields.opus");
  const keyLabel = t("archive.piece_card.fields.key");
  const languageLabel = t("archive.piece_card.fields.language");
  const epochLabel = t("archive.piece_card.fields.epoch");
  const yearLabel = t("archive.piece_card.fields.composition_year");
  const durationLabel = t("archive.piece_card.fields.duration");
  const notesLabel = t("archive.piece_card.fields.description");
  const epochOptions = getArchiveEpochOptions(t);
  const epoch = piece.epoch ?? "";
  const epochChoices = epoch && !epochOptions.some((option) => option.value === epoch)
    ? [{ value: epoch, label: getArchiveEpochLabel(epoch, t) }, ...epochOptions]
    : epochOptions;
  const contradictions = recordContradictions(piece);
  const yearNote = contradictions.year?.kind === "before_birth"
    ? t("archive.piece_card.note.year_before_birth", { birth: contradictions.year.birth })
    : contradictions.year
      ? t("archive.piece_card.note.year_after_death", { death: contradictions.year.death })
      : null;

  const optional: readonly { readonly field: OptionalField; readonly label: string }[] = [
    { field: "arranger", label: arrangerLabel },
    { field: "opus_catalog", label: opusLabel },
    { field: "musical_key", label: keyLabel },
    { field: "language", label: languageLabel },
    { field: "epoch", label: epochLabel },
    { field: "composition_year", label: yearLabel },
    { field: "estimated_duration", label: durationLabel },
    { field: "description", label: notesLabel },
  ];
  const shown = (field: OptionalField): boolean =>
    !isEmpty(piece, field) || isAiProvenance(pieceFieldProvenance(piece, field)) || revealed.has(field);
  const missing = optional.filter(({ field }) => !shown(field));
  const reveal = (field: OptionalField): void => {
    setRevealed((current) => new Set(current).add(field));
    // The row mounts on the next render; its control is the first focusable in it.
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-property="${field}"]`)
        ?.querySelector<HTMLElement>("input, textarea, button")
        ?.focus();
    });
  };
  const optionalRow = (field: OptionalField, row: ReactNode) =>
    shown(field) ? <div data-property={field}>{row}</div> : null;

  const content: Record<RecordSectionId, ReactNode> = {
    properties: (
      <>
        <ComposerProperty piece={piece} autosave={autosave} />
        {optionalRow("arranger", <TextProperty piece={piece} autosave={autosave} field="arranger" label={arrangerLabel} />)}
        {optionalRow("opus_catalog", <TextProperty piece={piece} autosave={autosave} field="opus_catalog" label={opusLabel} />)}
        {optionalRow("musical_key", <TextProperty piece={piece} autosave={autosave} field="musical_key" label={keyLabel} />)}
        {optionalRow("language", (
          <ReviewRow piece={piece} autosave={autosave} field="language" label={languageLabel}>
            {(id) => (
              <RowSelect
                id={id}
                value={piece.language ?? ""}
                options={getArchiveLanguageChoices(piece.language, t)}
                onValueChange={(next) => void autosave.saveChoice({ field: "language" }, next, id, languageLabel).catch(autosave.showSaveError)}
              />
            )}
          </ReviewRow>
        ))}
        {optionalRow("epoch", (
          <ReviewRow piece={piece} autosave={autosave} field="epoch" label={epochLabel}>
            {(id) => (
              <RowSelect
                id={id}
                value={epoch}
                options={epochChoices}
                onValueChange={(next) => {
                  const value = epochChoices.find((option) => option.value === next)?.value ?? "";
                  void autosave.saveChoice({ field: "epoch" }, value, id, epochLabel).catch(autosave.showSaveError);
                }}
              />
            )}
          </ReviewRow>
        ))}
        {contradictions.epoch && <PropertyNote isReviewing={isReviewing}>{t("archive.piece_card.note.epoch_arranged")}</PropertyNote>}
        {optionalRow("composition_year", (
          <ReviewRow piece={piece} autosave={autosave} field="composition_year" label={yearLabel}>
            {(id) => (
              <CommitText
                id={id}
                value={piece.composition_year?.toString() ?? ""}
                draftField={autosave.track("composition_year", yearLabel)}
                inputMode="numeric"
                onCommit={(next) => {
                  const year = pieceFieldSchema.shape.composition_year.safeParse(next);
                  return /^\d*$/.test(next) && year.success
                    ? autosave.save("composition_year", year.data)
                    : t("archive.piece_card.year_invalid");
                }}
              />
            )}
          </ReviewRow>
        ))}
        {yearNote && <PropertyNote isReviewing={isReviewing}>{yearNote}</PropertyNote>}
        {optionalRow("estimated_duration", (
          <PropertyRow label={durationLabel}>
            {(id) => (
              <CommitText
                id={id}
                value={pieceDuration(piece.estimated_duration)}
                draftField={autosave.track("estimated_duration", durationLabel)}
                onCommit={(next) => {
                  const duration = pieceDuration(next);
                  return duration.valid
                    ? autosave.save("estimated_duration", duration.seconds)
                    : t("archive.piece_card.duration_invalid");
                }}
              />
            )}
          </PropertyRow>
        ))}
        {optionalRow("description", (
          <div className="mt-4">
            <RecordTextLabel id={notesId} label={notesLabel} />
            <RecordText id={notesId} value={piece.description ?? ""} draftField={autosave.track("description", notesLabel)} onCommit={(next) => autosave.save("description", next)} />
          </div>
        ))}
        {missing.length > 0 && <MissingProperties fields={missing} onAdd={reveal} />}
      </>
    ),
    voices: (
      <>
        <TextProperty piece={piece} autosave={autosave} field="voicing" label={t("archive.piece_card.fields.scoring")} />
        <PieceVoices piece={piece} autosave={autosave} />
      </>
    ),
    text: (
      <>
        <TextProperty piece={piece} autosave={autosave} field="text_source" label={t("archive.piece_card.fields.text_source")} />
        <PieceLyrics piece={piece} autosave={autosave} isReviewing={isReviewing} />
      </>
    ),
    translations: <PieceTranslations piece={piece} autosave={autosave} />,
    movements: <PieceMovements piece={piece} autosave={autosave} score={score} />,
    "program-note": <PieceProgramNote piece={piece} autosave={autosave} />,
    recordings: <PieceRecordings piece={piece} autosave={autosave} />,
    tracks,
    editions,
  };

  return (
    <div className="space-y-8">
      {recordSections(piece).map((entry) => (
        <RecordSection key={entry.id} entry={entry}>{content[entry.id]}</RecordSection>
      ))}
    </div>
  );
};
