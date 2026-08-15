/**
 * @file FeedbackSheet.tsx
 * @description The report form. Four kinds, one textarea, and an honest account
 * of what travels with it.
 *
 * The disclosure listing the attached context is not decoration: the snapshot is
 * the reason this feature works, and a member who cannot see what they are
 * sending is right to distrust the button. Showing it costs one collapsed row.
 * @architecture Enterprise SaaS 2026
 * @module features/feedback/components/FeedbackSheet
 */

import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, HelpCircle, Lightbulb, Send, Sparkles } from "lucide-react";

import { useFeedbackStore } from "@/app/store/useFeedbackStore";
import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { SegmentedTabs, type SegmentedTabItem } from "@/shared/ui/composites/SegmentedTabs";
import { Button } from "@/shared/ui/primitives/Button";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { useSubmitFeedback } from "../api/feedback.mutations";
import { collectClientContext } from "../lib/collectClientContext";
import type { FeedbackKind } from "../types/feedback.dto";

const MAX_BODY_LENGTH = 4000;

export const FeedbackSheet = (): React.JSX.Element => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isOpen, prefill, closeFeedback } = useFeedbackStore();
  const submit = useSubmitFeedback();

  const [kind, setKind] = useState<FeedbackKind>("BUG");
  const [body, setBody] = useState("");

  // Seeded on every open, not once: a prefilled open (from a crashed view)
  // carries its own body, and clearing the previous draft is correct — a report
  // is about one moment, and yesterday's half-sentence is not this one.
  useEffect(() => {
    if (!isOpen) return;
    setBody(prefill?.body ?? "");
    setKind("BUG");
  }, [isOpen, prefill]);

  const kinds: readonly SegmentedTabItem<FeedbackKind>[] = useMemo(
    () => [
      { id: "BUG", label: t("feedback.kind.bug", "Nie działa"), Icon: AlertTriangle },
      { id: "CONFUSING", label: t("feedback.kind.confusing", "Nie rozumiem"), Icon: HelpCircle },
      { id: "IDEA", label: t("feedback.kind.idea", "Pomysł"), Icon: Lightbulb },
      { id: "PRAISE", label: t("feedback.kind.praise", "Pochwała"), Icon: Sparkles },
    ],
    [t],
  );

  // Mirrors the `fine-pointer:` variant. A mouse user gains a tap; on touch the
  // same autofocus summons the OS keyboard while the sheet is still rising,
  // which on iOS scrolls the viewport out from under it and pushes the kind
  // selector off screen before the member has chosen one.
  const autoFocus = useMemo(
    () => window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    [],
  );

  const trimmed = body.trim();
  const canSubmit = trimmed.length > 0 && !submit.isPending;

  const handleSubmit = (): void => {
    if (!canSubmit) return;

    submit.mutate(
      {
        kind,
        body: trimmed,
        route: location.pathname,
        context: collectClientContext(prefill?.technicalDetail),
      },
      {
        onSuccess: (outcome) => {
          toast.success(
            outcome === "queued"
              ? t(
                  "feedback.toast.queued",
                  "Zapisane. Wyślemy je, gdy wróci połączenie.",
                )
              : t("feedback.toast.sent", "Dziękuję — zgłoszenie do mnie dotarło."),
          );
          closeFeedback();
        },
        onError: () => {
          toast.error(
            t("feedback.toast.failed", "Nie udało się wysłać zgłoszenia. Spróbuj jeszcze raz."),
          );
        },
      },
    );
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={closeFeedback}
      title={t("feedback.sheet.title", "Powiedz mi, co się stało")}
      subtitle={t("feedback.sheet.subtitle", "Piszesz wprost do autora aplikacji")}
      footer={
        <Button
          variant="primary"
          size="touch"
          fullWidth
          onClick={handleSubmit}
          disabled={!canSubmit}
          isLoading={submit.isPending}
          leftIcon={<Send size={14} strokeWidth={2} />}
        >
          {t("feedback.action.send", "Wyślij")}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pt-1">
        <SegmentedTabs
          items={kinds}
          value={kind}
          onChange={setKind}
          wrap
          ariaLabel={t("feedback.kind.aria", "Rodzaj zgłoszenia")}
        />

        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value.slice(0, MAX_BODY_LENGTH))}
          rows={6}
          autoFocus={autoFocus}
          label={t("feedback.field.label", "Co się wydarzyło?")}
          placeholder={t(
            "feedback.field.placeholder",
            "Np. „Kliknęłam w nuty do Ave Maria i strona została pusta.” Im konkretniej, tym szybciej to naprawię.",
          )}
        />

        <details>
          <Eyebrow
            as="summary"
            size="overline-sm"
            color="graphite"
            className="cursor-pointer select-none transition-colors hover:text-ethereal-ink"
          >
            {t("feedback.context.label", "Co wysyłam razem ze zgłoszeniem")}
          </Eyebrow>
          <Text size="xs" color="muted" className="mt-2 leading-relaxed">
            {t(
              "feedback.context.body",
              "Twoje imię i adres e-mail, ekran, na którym jesteś, rodzaj urządzenia i przeglądarki, język i strefa czasowa, wersja aplikacji oraz ostatni błąd techniczny, jeśli wystąpił. Zgłoszenie trafia na moją skrzynkę. Nic poza tym — nie mam wglądu w Twoje hasło ani w zawartość innych stron.",
            )}
          </Text>
        </details>
      </div>
    </BottomSheet>
  );
};

FeedbackSheet.displayName = "FeedbackSheet";
