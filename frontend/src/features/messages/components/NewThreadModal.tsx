/**
 * @file NewThreadModal.tsx
 * @description Composer for opening a new conversation. Artists may optionally
 * direct the thread to a chosen manager (else it reaches the whole pool);
 * managers pick the target artist.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Send, X } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Select } from "@/shared/ui/primitives/Select";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { useArtists } from "@/features/artists/api/artist.queries";
import { useCreateThread, useRecipients } from "../api/messages.queries";
import type { CreateThreadPayload } from "../types/messages.dto";

interface NewThreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  isManager: boolean;
  onCreated?: (threadId: string) => void;
  /** When opening from a specific artist's profile (manager flow), skip the picker. */
  presetArtistId?: string;
  presetArtistName?: string;
}

const ManagerArtistField: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const { data: artists = [] } = useArtists();
  return (
    <Select
      label={t("messages.compose.artist", "Adresat (artysta)")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">
        {t("messages.compose.artist_placeholder", "— wybierz artystę —")}
      </option>
      {artists.map((artist) => (
        <option key={artist.id} value={artist.id}>
          {artist.first_name} {artist.last_name}
        </option>
      ))}
    </Select>
  );
};

const RecipientField: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const { data: recipients = [] } = useRecipients();
  return (
    <Select
      label={t("messages.compose.recipient", "Do kogo (opcjonalnie)")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">
        {t("messages.compose.recipient_any", "Dowolny dyrygent")}
      </option>
      {recipients.map((recipient) => (
        <option key={recipient.id} value={String(recipient.id)}>
          {recipient.name}
        </option>
      ))}
    </Select>
  );
};

export const NewThreadModal: React.FC<NewThreadModalProps> = ({
  isOpen,
  onClose,
  isManager,
  onCreated,
  presetArtistId,
  presetArtistName,
}) => {
  const { t } = useTranslation();
  const { mutate: createThread, isPending } = useCreateThread();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [artistId, setArtistId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  const reset = () => {
    setSubject("");
    setBody("");
    setArtistId("");
    setAssigneeId("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const effectiveArtistId = presetArtistId || artistId;
  const canSubmit =
    subject.trim() && body.trim() && (!isManager || effectiveArtistId);

  const handleSubmit = () => {
    if (!canSubmit) return;
    const payload: CreateThreadPayload = {
      subject: subject.trim(),
      body: body.trim(),
    };
    if (isManager) {
      payload.artist_id = effectiveArtistId;
    } else if (assigneeId) {
      payload.assignee_id = Number(assigneeId);
    }

    createThread(payload, {
      onSuccess: (thread) => {
        toast.success(t("messages.compose.success", "Wiadomość wysłana."));
        reset();
        onCreated?.(thread.id);
        onClose();
      },
      onError: () => {
        toast.error(t("messages.compose.error", "Nie udało się wysłać."));
      },
    });
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-toast bg-ethereal-ink/40 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none fixed inset-0 z-9999 flex items-center justify-center p-4"
          >
            <GlassCard
              variant="solid"
              isHoverable={false}
              className="pointer-events-auto w-full max-w-lg"
            >
              <div className="flex items-start justify-between p-6 pb-0">
                <Heading as="h4" size="xl" color="graphite">
                  {t("messages.compose.heading", "Nowa wiadomość")}
                </Heading>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label={t("common.close", "Zamknij")}
                  className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-black/5"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-4 p-6">
                {isManager ? (
                  presetArtistId ? (
                    <div className="rounded-xl border border-ethereal-ink/8 bg-ethereal-alabaster/40 px-4 py-3">
                      <Eyebrow color="muted" size="caption">
                        {t("messages.compose.recipient_to", "Do")}
                      </Eyebrow>
                      <Text size="sm" color="graphite" weight="medium">
                        {presetArtistName}
                      </Text>
                    </div>
                  ) : (
                    <ManagerArtistField value={artistId} onChange={setArtistId} />
                  )
                ) : (
                  <RecipientField value={assigneeId} onChange={setAssigneeId} />
                )}

                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  label={t("messages.compose.subject", "Temat")}
                  placeholder={t(
                    "messages.compose.subject_placeholder",
                    "Czego dotyczy rozmowa?",
                  )}
                  maxLength={160}
                />
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  label={t("messages.compose.message", "Wiadomość")}
                  placeholder={t(
                    "messages.compose.message_placeholder",
                    "Napisz treść…",
                  )}
                />
              </div>

              <div className="flex items-center justify-end gap-3 px-6 pb-6">
                <Button variant="ghost" type="button" onClick={handleClose}>
                  {t("common.cancel", "Anuluj")}
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || isPending}
                  className="flex items-center gap-2"
                >
                  <Send size={14} />
                  {isPending
                    ? t("messages.compose.sending", "Wysyłanie…")
                    : t("messages.compose.send", "Wyślij")}
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};
