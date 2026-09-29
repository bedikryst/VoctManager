/**
 * @file NewThreadModal.tsx
 * @description Unified composer. Managers switch between a 1:1 **thread** (artist
 * picker + optional project context) and a project-channel **announcement** (channel
 * picker + optional pin). Artists may direct a thread to a chosen manager (else it
 * reaches the whole pool).
 *
 * Presented as a `BottomSheet`: a sheet under the thumb on a phone, a centred
 * dialog from `sm:` up, with its focus, ESC and height handling. The gestures that
 * happen by accident (ESC, a tap on the scrim, a swipe down, the close button)
 * only put the composer away, and the draft is there on the next opening. Cancel
 * discards it, and so does a successful send.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Megaphone, MessageSquare, Send } from "lucide-react";

import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { SegmentedTabs, type SegmentedTabItem } from "@/shared/ui/composites/SegmentedTabs";
import { Button } from "@/shared/ui/primitives/Button";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { Input } from "@/shared/ui/primitives/Input";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Select } from "@/shared/ui/primitives/Select";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { useArtists } from "@/features/artists/api/artist.queries";
import { canReceiveMessages } from "@/features/artists/lib/accountState";
import { toastApiError } from "@/shared/api/errors";
import {
  useChannels,
  useCreateThread,
  usePostChannelAnnouncement,
  useRecipients,
} from "../api/messages.queries";
import { useProjectsLite } from "../api/projects.lite";
import type { CreateThreadPayload } from "../types/messages.dto";

type ComposerMode = "message" | "announce";

interface NewThreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  isManager: boolean;
  onCreated?: (threadId: string) => void;
  onAnnounced?: (channelId: string) => void;
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
  const reachable = useMemo(() => artists.filter(canReceiveMessages), [artists]);
  return (
    <Select
      label={t("messages.compose.artist", "Adresat (artysta)")}
      value={value}
      onValueChange={onChange}
      placeholder={t("messages.compose.artist_placeholder", "Wybierz artystę")}
      options={reachable.map((artist) => ({
        value: String(artist.id),
        label: `${artist.first_name} ${artist.last_name}`,
      }))}
    />
  );
};

const RecipientField: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const { data: recipients = [] } = useRecipients();
  return (
    <div className="flex flex-col gap-1.5">
      {/* No recipient is a real, meaningful choice here — it routes the thread
          to the shared queue — so it is both the resting state and a way back. */}
      <Select
        label={t("messages.compose.recipient", "Do kogo (opcjonalnie)")}
        value={value}
        onValueChange={onChange}
        placeholder={t("messages.compose.recipient_any", "Dowolny dyrygent")}
        clearLabel={t("messages.compose.recipient_any", "Dowolny dyrygent")}
        options={recipients.map((recipient) => ({
          value: String(recipient.id),
          label: recipient.name,
        }))}
      />
      <Text size="xs" color="muted">
        {t(
          "messages.compose.recipient_hint",
          "Bez wyboru wiadomość trafia do wspólnej kolejki zarządu. Wybór osoby = rozmowa prywatna.",
        )}
      </Text>
    </div>
  );
};

const ProjectContextField: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const { data: projects = [] } = useProjectsLite();
  const sorted = useMemo(
    () => [...projects].sort((a, b) => (b.date_time ?? "").localeCompare(a.date_time ?? "")),
    [projects],
  );
  return (
    <Select
      label={t(
        "messages.compose.project_context",
        "Dotyczy projektu (opcjonalnie)",
      )}
      value={value}
      onValueChange={onChange}
      placeholder={t("messages.compose.project_none", "Bez powiązania")}
      clearLabel={t("messages.compose.project_none", "Bez powiązania")}
      options={sorted.map((project) => ({
        value: String(project.id),
        label: project.title,
      }))}
    />
  );
};

export const NewThreadModal: React.FC<NewThreadModalProps> = ({
  isOpen,
  onClose,
  isManager,
  onCreated,
  onAnnounced,
  presetArtistId,
  presetArtistName,
}) => {
  const { t } = useTranslation();
  const { mutate: createThread, isPending: threadPending } = useCreateThread();
  const { mutate: postAnnouncement, isPending: announcePending } = usePostChannelAnnouncement();
  const { data: channels = [] } = useChannels(isManager && isOpen);

  const canAnnounce = isManager && !presetArtistId;
  const [mode, setMode] = useState<ComposerMode>("message");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [artistId, setArtistId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [pin, setPin] = useState(true);

  const reset = () => {
    setMode("message");
    setSubject("");
    setBody("");
    setArtistId("");
    setAssigneeId("");
    setProjectId("");
    setChannelId("");
    setPin(true);
  };

  // A kept draft never follows a different preset recipient: the artist views
  // keep one composer mounted while the reader moves from artist to artist.
  const [draftFor, setDraftFor] = useState(presetArtistId);
  if (draftFor !== presetArtistId) {
    setDraftFor(presetArtistId);
    reset();
  }

  const handleDiscard = () => {
    reset();
    onClose();
  };

  const isPending = threadPending || announcePending;
  const isAnnounce = canAnnounce && mode === "announce";

  const effectiveArtistId = presetArtistId || artistId;
  const canSubmit = isAnnounce
    ? Boolean(channelId && body.trim())
    : Boolean(subject.trim() && body.trim() && (!isManager || effectiveArtistId));

  const modeItems = useMemo<SegmentedTabItem<ComposerMode>[]>(
    () => [
      { id: "message", label: t("messages.compose.mode_message", "Wiadomość"), Icon: MessageSquare },
      { id: "announce", label: t("messages.compose.mode_announce", "Ogłoszenie"), Icon: Megaphone },
    ],
    [t],
  );

  // The form keeps everything on failure, so the reader can retry as it stands.
  // The server's reason is worth showing: a refused recipient or a closed
  // channel is not something "try again" fixes.
  const reportFailure = (error: unknown) =>
    toastApiError(error, t, {
      fallbackDescription: t("messages.compose.error", "Nie udało się wysłać."),
    });

  const submitAnnouncement = () => {
    postAnnouncement(
      { channelId, body: body.trim(), pin },
      {
        onSuccess: () => {
          toast.success(t("messages.compose.announce_success", "Ogłoszenie opublikowane."));
          const target = channelId;
          reset();
          onAnnounced?.(target);
          onClose();
        },
        onError: reportFailure,
      },
    );
  };

  const submitThread = () => {
    const payload: CreateThreadPayload = { subject: subject.trim(), body: body.trim() };
    if (isManager) {
      payload.artist_id = effectiveArtistId;
      if (projectId) {
        payload.context_type = "PROJECT";
        payload.context_id = projectId;
      }
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
      onError: reportFailure,
    });
  };

  const handleSubmit = () => {
    if (!canSubmit || isPending) return;
    if (isAnnounce) submitAnnouncement();
    else submitThread();
  };

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <Button variant="ghost" type="button" onClick={handleDiscard}>
        {t("common.cancel", "Anuluj")}
      </Button>
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || isPending}
        leftIcon={isAnnounce ? <Megaphone size={14} /> : <Send size={14} />}
      >
        {isPending
          ? t("messages.compose.sending", "Wysyłanie…")
          : isAnnounce
            ? t("messages.compose.mode_announce", "Ogłoszenie")
            : t("messages.compose.send", "Wyślij")}
      </Button>
    </div>
  );

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        isAnnounce
          ? t("messages.compose.heading_announce", "Nowe ogłoszenie")
          : t("messages.compose.heading", "Nowa wiadomość")
      }
      footer={footer}
      className="sm:max-w-lg"
    >
      <div className="flex flex-col gap-4 pt-1">
        {canAnnounce && (
          <SegmentedTabs
            items={modeItems}
            value={mode}
            onChange={setMode}
            ariaLabel={t("messages.compose.mode_message", "Wiadomość")}
          />
        )}

        {isAnnounce ? (
          channels.length === 0 ? (
            <Text size="sm" color="muted" className="py-2">
              {t("messages.compose.no_channels", "Nie masz jeszcze żadnych kanałów projektów.")}
            </Text>
          ) : (
            <>
              <Select
                label={t("messages.compose.channel", "Kanał projektu")}
                value={channelId}
                onValueChange={setChannelId}
                placeholder={t(
                  "messages.compose.channel_placeholder",
                  "Wybierz projekt",
                )}
                options={channels.map((channel) => ({
                  value: String(channel.id),
                  label: channel.project_name,
                }))}
              />
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                label={t("messages.compose.message", "Wiadomość")}
                placeholder={t("messages.compose.announce_body_placeholder", "Treść ogłoszenia…")}
              />
              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox checked={pin} onChange={(e) => setPin(e.target.checked)} className="mt-0.5" />
                <span>
                  <Text size="sm" color="graphite" weight="medium">
                    {t("messages.compose.pin", "Przypnij jako ogłoszenie")}
                  </Text>
                  <Text size="xs" color="muted">
                    {t(
                      "messages.compose.pin_hint",
                      "Przypięte ogłoszenia są widoczne na górze kanału.",
                    )}
                  </Text>
                </span>
              </label>
            </>
          )
        ) : (
          <>
            {isManager ? (
              presetArtistId ? (
                <div className="rounded-control border border-hairline bg-ethereal-alabaster/40 px-4 py-3">
                  <Eyebrow color="muted">
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

            {isManager && (
              <ProjectContextField value={projectId} onChange={setProjectId} />
            )}

            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              label={t("messages.compose.subject", "Temat")}
              placeholder={t("messages.compose.subject_placeholder", "Czego dotyczy rozmowa?")}
              maxLength={160}
            />
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              label={t("messages.compose.message", "Wiadomość")}
              placeholder={t("messages.compose.message_placeholder", "Napisz treść…")}
            />
          </>
        )}
      </div>
    </BottomSheet>
  );
};
