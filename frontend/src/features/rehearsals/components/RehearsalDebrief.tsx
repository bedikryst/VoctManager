/**
 * @file RehearsalDebrief.tsx
 * @description "Po próbie": the evening handed back in a few sentences by
 * whoever stood in front of the choir, and read by the conductor where the
 * rehearsal lives. One block, two faces — an editor when the caller passes
 * `onSave` and the rehearsal has started, the written text otherwise. The
 * author and the time sit under the text on both faces, because "whose words"
 * is the first thing a manager decides on opening it.
 *
 * The editor is a plain textarea with a save button rather than an inline
 * field: a debrief is a paragraph typed on a tablet after the choir has left,
 * not a line corrected in passing, and it wants a visible commit.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/RehearsalDebrief
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { NotebookPen } from "lucide-react";
import { toast } from "sonner";

import { toastApiError } from "@/shared/api/errors";
import { Button } from "@/shared/ui/primitives/Button";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { formatLocalizedDateTime } from "@/shared/lib/time/intl";
import type { Rehearsal } from "@/shared/types";

interface RehearsalDebriefProps {
  rehearsal: Rehearsal;
  /**
   * Saves the text. Present → the block is an editor, once the rehearsal has
   * started; absent → the block shows what was written, and nothing at all
   * when nothing was.
   */
  onSave?: (debrief: string) => Promise<unknown>;
}

const DEBRIEF_MAX = 4000;

/** "Kasia Nowak · 19 września, 21:14" — or nothing, when never written. */
const Stamp = ({ rehearsal }: { rehearsal: Rehearsal }): React.JSX.Element | null => {
  const { i18n } = useTranslation();
  if (!rehearsal.debrief_at) return null;
  const when = formatLocalizedDateTime(
    rehearsal.debrief_at,
    { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" },
    i18n.language,
    rehearsal.timezone,
  );
  return (
    <Caption color="muted">
      {[rehearsal.debrief_by_name, when].filter(Boolean).join(" · ")}
    </Caption>
  );
};

/**
 * Keyed by the caller on the rehearsal and its stamp, so a save remounts the
 * draft from the server's answer and a switch of evening never carries a
 * half-typed paragraph across.
 */
const DebriefEditor = ({
  rehearsal,
  onSave,
}: {
  rehearsal: Rehearsal;
  onSave: (debrief: string) => Promise<unknown>;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const saved = rehearsal.debrief ?? "";
  const [draft, setDraft] = useState(saved);
  const [isSaving, setIsSaving] = useState(false);
  const isDirty = draft.trim() !== saved;

  const handleSave = async (): Promise<void> => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(draft.trim());
      toast.success(t("rehearsals.lead.debrief.saved", "Zapisano. Dyrygent dostał znać."));
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t(
          "rehearsals.lead.debrief.save_error",
          "Nie udało się zapisać podsumowania.",
        ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={4}
        maxLength={DEBRIEF_MAX}
        aria-label={t("rehearsals.lead.debrief.title", "Po próbie")}
        placeholder={t(
          "rehearsals.lead.debrief.placeholder",
          "Kilka zdań dla dyrygenta: co stoi, co do powtórki, kogo brakowało.",
        )}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Stamp rehearsal={rehearsal} />
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          isLoading={isSaving}
          className="ml-auto"
        >
          {saved
            ? t("rehearsals.lead.debrief.update", "Zapisz zmiany")
            : t("rehearsals.lead.debrief.submit", "Wyślij dyrygentowi")}
        </Button>
      </div>
    </div>
  );
};

export const RehearsalDebrief = ({
  rehearsal,
  onSave,
}: RehearsalDebriefProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const hasStarted = new Date(rehearsal.date_time).getTime() <= Date.now();
  const canEdit = Boolean(onSave) && hasStarted;
  const written = (rehearsal.debrief ?? "").trim();

  if (!canEdit && !written) return null;

  return (
    <section className="border-t border-hairline p-5 md:p-6">
      <div className="mb-3 flex items-center gap-2">
        <NotebookPen size={12} className="text-ethereal-gold/70" aria-hidden="true" />
        <Eyebrow as="h3" color="graphite">
          {t("rehearsals.lead.debrief.title", "Po próbie")}
        </Eyebrow>
      </div>
      {canEdit && onSave ? (
        <DebriefEditor
          key={`${rehearsal.id}:${rehearsal.debrief_at ?? ""}`}
          rehearsal={rehearsal}
          onSave={onSave}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <Text size="md" className="whitespace-pre-wrap">
            {written}
          </Text>
          <Stamp rehearsal={rehearsal} />
        </div>
      )}
    </section>
  );
};
