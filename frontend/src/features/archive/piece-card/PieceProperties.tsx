/**
 * @file PieceProperties.tsx
 * @description Editable metadata laid out in the piece's record sections.
 */

import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import type { Piece } from "@/shared/types";
import { PropertyRow, PROPERTY_CONTROL_CLASS } from "@/shared/ui/composites/PropertyRow";
import { Select, type SelectOption } from "@/shared/ui/primitives/Select";
import { Label, Text } from "@/shared/ui/primitives/typography";
import { pieceCardSchema } from "../components/PieceMetadataForm";
import { getArchiveEpochLabel, getArchiveEpochOptions } from "../constants/archiveEpochs";
import { getArchiveLanguageChoices } from "../constants/archiveLanguages";
import { CommitText } from "./CommitText";
import { ComposerProperty } from "./ComposerProperty";
import { usePieceFieldReview } from "./PieceFieldReview";
import { pieceDuration } from "./pieceDuration";
import type { PieceAutosave } from "./usePieceAutosave";

interface PiecePropertiesProps {
  readonly piece: Piece;
  readonly autosave: PieceAutosave;
}

type TextField = "arranger" | "opus_catalog" | "musical_key" | "voicing" | "text_source";

interface ReviewRowProps extends PiecePropertiesProps {
  readonly label: string;
  readonly field: Parameters<PieceAutosave["confirm"]>[0];
  readonly children: (id: string) => ReactNode;
}

const ReviewRow = ({ children, ...props }: ReviewRowProps) => {
  const { marker, action } = usePieceFieldReview(props);
  return <PropertyRow label={props.label} marker={marker} action={action}>{children}</PropertyRow>;
};

const TextProperty = ({ piece, autosave, field, label }: Omit<ReviewRowProps, "children" | "field"> & {
  readonly field: TextField;
}) => {
  const { t } = useTranslation();
  const schema = pieceCardSchema.shape[field];
  return (
    <ReviewRow piece={piece} autosave={autosave} label={label} field={field}>
      {(id) => (
        <CommitText
          id={id}
          value={piece[field] ?? ""}
          onCommit={(next) => schema.safeParse(next).success
            ? autosave.save(field, next)
            : t("archive.piece_card.field_too_long")}
        />
      )}
    </ReviewRow>
  );
};

const RecordSection = ({ title, children }: { title: string; children: ReactNode }) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <Text as="h2" id={headingId} size="lg" weight="semibold" className="mb-3">{title}</Text>
      {children}
    </section>
  );
};

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

export const PieceProperties = ({ piece, autosave }: PiecePropertiesProps) => {
  const { t } = useTranslation();
  const notesId = useId();
  const epochOptions = getArchiveEpochOptions(t);
  const epoch = piece.epoch ?? "";
  const epochChoices = epoch && !epochOptions.some((option) => option.value === epoch)
    ? [{ value: epoch, label: getArchiveEpochLabel(epoch, t) }, ...epochOptions]
    : epochOptions;

  return (
    <div className="space-y-8">
      <RecordSection title={t("archive.piece_card.section.properties")}>
        <ComposerProperty piece={piece} autosave={autosave} />
        <TextProperty piece={piece} autosave={autosave} field="arranger" label={t("archive.piece_card.fields.arranger")} />
        <TextProperty piece={piece} autosave={autosave} field="opus_catalog" label={t("archive.piece_card.fields.opus")} />
        <TextProperty piece={piece} autosave={autosave} field="musical_key" label={t("archive.piece_card.fields.key")} />
        <ReviewRow piece={piece} autosave={autosave} field="language" label={t("archive.piece_card.fields.language")}>
          {(id) => (
            <RowSelect
              id={id}
              value={piece.language ?? ""}
              options={getArchiveLanguageChoices(piece.language, t)}
              onValueChange={(next) => void autosave.save("language", next).catch(autosave.showSaveError)}
            />
          )}
        </ReviewRow>
        <ReviewRow piece={piece} autosave={autosave} field="epoch" label={t("archive.piece_card.fields.epoch")}>
          {(id) => (
            <RowSelect
              id={id}
              value={epoch}
              options={epochChoices}
              onValueChange={(next) => {
                const value = epochChoices.find((option) => option.value === next)?.value ?? "";
                void autosave.save("epoch", value).catch(autosave.showSaveError);
              }}
            />
          )}
        </ReviewRow>
        <ReviewRow piece={piece} autosave={autosave} field="composition_year" label={t("archive.piece_card.fields.composition_year")}>
          {(id) => (
            <CommitText
              id={id}
              value={piece.composition_year?.toString() ?? ""}
              inputMode="numeric"
              onCommit={(next) => {
                const year = pieceCardSchema.shape.composition_year.safeParse(next);
                return /^\d*$/.test(next) && year.success
                  ? autosave.save("composition_year", year.data)
                  : t("archive.piece_card.year_invalid");
              }}
            />
          )}
        </ReviewRow>
        <PropertyRow label={t("archive.piece_card.fields.duration")}>
          {(id) => (
            <CommitText
              id={id}
              value={pieceDuration(piece.estimated_duration)}
              onCommit={(next) => {
                const duration = pieceDuration(next);
                return duration.valid
                  ? autosave.save("estimated_duration", duration.seconds)
                  : t("archive.piece_card.duration_invalid");
              }}
            />
          )}
        </PropertyRow>
        <div className="mt-4">
          <Label as="label" htmlFor={notesId} size="base" color="graphite" className="mb-1 block">
            {t("archive.piece_card.fields.description")}
          </Label>
          <div className="-ml-2">
            <CommitText
              id={notesId}
              value={piece.description ?? ""}
              multiline
              onCommit={(next) => autosave.save("description", next)}
            />
          </div>
        </div>
      </RecordSection>
      <RecordSection title={t("archive.piece_card.fields.voicing")}>
        <TextProperty piece={piece} autosave={autosave} field="voicing" label={t("archive.piece_card.fields.scoring")} />
      </RecordSection>
      <RecordSection title={t("archive.piece_card.group.text")}>
        <TextProperty piece={piece} autosave={autosave} field="text_source" label={t("archive.piece_card.fields.text_source")} />
      </RecordSection>
    </div>
  );
};
