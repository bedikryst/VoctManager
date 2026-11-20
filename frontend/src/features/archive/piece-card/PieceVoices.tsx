/**
 * @file PieceVoices.tsx
 * @description The piece card's voice bar: each line as a token with its count,
 * a stepper per token, a searchable "Dodaj głos", and the singers' total. From
 * two editions on, the piece-wide layer and every edition that declares its own
 * divisi get a bar of their own, labelled with the edition.
 *
 * The piece PATCH replaces every layer at once, so each edit sends the whole
 * list. Edits coalesce: a write takes the newest list when its turn in the
 * piece's queue comes, so a run of stepper taps costs one or two requests and
 * never lands an older count over a newer one.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as Popover from "@radix-ui/react-popover";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useVoiceLines } from "@/shared/api/options.queries";
import { cn } from "@/shared/lib/utils";
import { collapseVoiceLabels } from "@/shared/lib/voiceLabels";
import type { Piece, VoiceLineOption } from "@/shared/types";
import { PROPERTY_CONTROL_CLASS } from "@/shared/ui/composites/PropertyRow";
import { SearchSelect } from "@/shared/ui/composites/SearchSelect";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { DIVISI_LINES } from "../components/DivisiEditor";
import { formatEditionLabel, getPiecePdfLinks } from "../constants/piecePdfs";
import type { PieceAutosave } from "./usePieceAutosave";
import {
  addLine,
  removeLine,
  sameRequirements,
  setQuantity,
  startEditionLayer,
  voiceLayout,
  voiceToken,
  writableRequirements,
  type Requirements,
  type VoiceLayer,
} from "./voiceBar";

const STEP_BUTTON_CLASS = "size-9 min-h-9 rounded-control pointer-coarse:size-11";

interface VoiceTokenProps {
  readonly short: string;
  readonly name: string;
  readonly quantity: number;
  readonly onQuantity: (quantity: number) => void;
  readonly onRemove: () => void;
}

const VoiceToken = ({ short, name, quantity, onQuantity, onRemove }: VoiceTokenProps) => {
  const { t } = useTranslation();
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={t("archive.piece_card.voice_token", {
            voice: name,
            singers: t("archive.piece_card.singers_count", { count: quantity }),
          })}
          className="inline-flex h-9 items-center gap-1.5 rounded-control border border-hairline-strong px-2.5 transition-colors hover:bg-ethereal-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 data-[state=open]:bg-ethereal-ink/5 pointer-coarse:h-11"
        >
          <Text as="span" size="md" weight="semibold">{short}</Text>
          <Text as="span" size="md" color="graphite" className="tabular-nums">{quantity}</Text>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={name}
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-popover w-64 max-w-(--radix-popover-content-available-width) origin-(--radix-popover-content-transform-origin) rounded-nested border border-hairline-strong bg-ethereal-alabaster p-1.5 shadow-glass-ethereal popover-motion"
        >
          <div className="flex items-center gap-2 p-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={STEP_BUTTON_CLASS}
              aria-label={t("archive.piece_card.voice_fewer")}
              disabled={quantity <= 1}
              onClick={() => onQuantity(quantity - 1)}
            >
              <Minus size={16} aria-hidden="true" />
            </Button>
            <Text as="output" size="xl" weight="semibold" align="center" className="min-w-8 tabular-nums" aria-live="polite">
              {quantity}
            </Text>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={STEP_BUTTON_CLASS}
              aria-label={t("archive.piece_card.voice_more")}
              onClick={() => onQuantity(quantity + 1)}
            >
              <Plus size={16} aria-hidden="true" />
            </Button>
            <Text as="span" color="graphite" className="ml-1 min-w-0">{name}</Text>
          </div>
          <div className="my-1 border-t border-hairline" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            casing="sentence"
            fullWidth
            className="justify-start text-ethereal-crimson hover:text-ethereal-crimson"
            leftIcon={<Trash2 size={14} aria-hidden="true" />}
            onClick={onRemove}
          >
            {t("archive.piece_card.voice_remove")}
          </Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

const lineOptions = (voiceLines: readonly VoiceLineOption[], taken: ReadonlySet<string>) =>
  voiceLines
    .filter((option) => DIVISI_LINES.has(String(option.value)) && !taken.has(String(option.value)))
    // The code rides along as the second line, so "t2" finds "Tenor 2".
    .map((option) => ({ value: String(option.value), label: option.label, description: String(option.value) }));

export const PieceVoices = ({ piece, autosave }: { piece: Piece; autosave: PieceAutosave }) => {
  const { t } = useTranslation();
  const { data: voiceLines = [] } = useVoiceLines();
  const label = t("archive.piece_card.voices_label");
  const draft = autosave.track("voice_requirements", label);
  const barId = useId();
  const server = useMemo(() => writableRequirements(piece), [piece]);
  const [pending, setPending] = useState<Requirements | null>(null);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const latest = useRef<Requirements | null>(null);
  const waiting = useRef(false);
  const serverRef = useRef(server);
  useEffect(() => {
    serverRef.current = server;
  }, [server]);

  const requirements = pending ?? server;
  const editions = getPiecePdfLinks(piece);
  const layout = voiceLayout(
    requirements,
    editions.map((edition) => edition.id),
    voiceLines.map((option) => String(option.value)),
    opened,
  );
  const editionName = (id: string) => {
    const link = editions.find((edition) => edition.id === id);
    return link ? formatEditionLabel(link) : id;
  };

  const discard = () => {
    latest.current = null;
    setPending(null);
    draft.setDraft(draft.key, null);
  };

  const flush = () => {
    if (waiting.current) return;
    waiting.current = true;
    void autosave.enqueue(async () => {
      waiting.current = false;
      const next = latest.current;
      if (!next) return;
      await autosave.patchPiece({ voice_requirements: [...next] });
      if (latest.current !== next) return;
      discard();
    }).catch((error: unknown) => {
      autosave.showSaveError(error);
      draft.setDraft(draft.key, { id: barId, label, discard, retry: flush });
    });
  };

  const current = () => latest.current ?? serverRef.current;

  const change = (next: Requirements) => {
    latest.current = next;
    setPending(next);
    flush();
  };

  const remove = (editionId: string | null, line: string, name: string) => {
    const before = current();
    const after = removeLine(before, editionId, line);
    change(after);
    // The token and its open popover leave with the line; keep focus in the bar.
    requestAnimationFrame(() => document.getElementById(barId)?.focus());
    toast.success(t("archive.piece_card.voice_removed", { voice: name }), {
      id: `piece-voices:${piece.id}`,
      action: {
        label: t("common.actions.undo"),
        onClick: () => {
          if (sameRequirements(current(), after)) change(before);
          else toast.info(t("archive.piece_card.undo_superseded"));
        },
      },
    });
  };

  const startLayer = (editionId: string) => {
    setOpened((previous) => new Set(previous).add(editionId));
    const base = current();
    const next = startEditionLayer(base, editionId);
    if (next.length !== base.length) change(next);
  };

  const layerTitle = (layer: VoiceLayer): string | null => {
    if (!layout.labelled) return null;
    if (layer.editionId) return editionName(layer.editionId);
    return t(layout.layers.length > 1 ? "archive.piece_card.voices_layer_others" : "archive.piece_card.voices_layer_all");
  };

  const renderLayer = (layer: VoiceLayer) => {
    const title = layerTitle(layer);
    const codes = layer.lines.map((requirement) => String(requirement.voice_line));
    const names = collapseVoiceLabels(codes, voiceLines, t);
    return (
      <div key={layer.editionId ?? "piece"} role={title ? "group" : undefined} aria-label={title ?? undefined}>
        {title && <Text as="p" color="graphite" className="mb-1.5">{title}</Text>}
        <div className="flex flex-wrap items-center gap-1.5">
          {layer.lines.map((requirement) => {
            const code = String(requirement.voice_line);
            const name = names[code] ?? code;
            return (
              <VoiceToken
                key={code}
                short={voiceToken(code, codes) ?? name}
                name={name}
                quantity={requirement.quantity}
                onQuantity={(quantity) => change(setQuantity(current(), layer.editionId, code, quantity))}
                onRemove={() => remove(layer.editionId, code, name)}
              />
            );
          })}
          <div className="min-w-0 max-w-full">
            <SearchSelect
              ariaLabel={title ? t("archive.piece_card.add_voice_to", { layer: title }) : t("archive.piece_card.add_voice")}
              variant="property"
              className={cn(PROPERTY_CONTROL_CLASS, "w-fit max-w-full")}
              options={lineOptions(voiceLines, new Set(codes))}
              value=""
              placeholder={t("archive.piece_card.add_voice")}
              searchPlaceholder={t("archive.piece_card.voice_search")}
              onValueChange={(value) => {
                const option = voiceLines.find((entry) => String(entry.value) === value);
                if (option) change(addLine(current(), layer.editionId, option.value));
              }}
            />
          </div>
          {layer.total > 0 && (
            <Text as="span" color="graphite" className="ml-2 tabular-nums">
              {t("archive.piece_card.singers_count", { count: layer.total })}
            </Text>
          )}
        </div>
        {layer.editionId && layer.lines.length === 0 && (
          <Text as="p" size="sm" color="graphite" className="mt-1">{t("archive.piece_card.voices_layer_empty")}</Text>
        )}
      </div>
    );
  };

  return (
    <div id={barId} tabIndex={-1} role="group" aria-label={label} className="mt-3 space-y-5 focus:outline-none">
      {layout.layers.map(renderLayer)}
      {layout.inheriting.length > 0 && (
        <div className="-ml-2 w-fit max-w-full">
          <SearchSelect
            ariaLabel={t("archive.piece_card.voices_layer_add")}
            variant="property"
            className={cn(PROPERTY_CONTROL_CLASS, "w-fit max-w-full")}
            options={layout.inheriting.map((id) => ({ value: id, label: editionName(id) }))}
            value=""
            placeholder={t("archive.piece_card.voices_layer_add")}
            searchPlaceholder={t("archive.piece_card.edition_search")}
            onValueChange={startLayer}
          />
        </div>
      )}
    </div>
  );
};
