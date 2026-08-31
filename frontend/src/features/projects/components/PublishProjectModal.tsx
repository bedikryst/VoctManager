/**
 * @file PublishProjectModal.tsx
 * @description The confirmation behind publishing a project. Publication is the
 * moment a silent draft speaks to its whole cast at once, and a message cannot be
 * recalled — so the conductor sees who will be written to and what is still
 * missing before committing. Follows the same centred, scrimmed decision surface
 * as the invitation modal on the artist's side; the gaps are stated as warnings,
 * never as blocks, because an incomplete project can still be a deliberate
 * announcement.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/PublishProjectModal
 */

import React, { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { AlertTriangle, MailWarning, Send, Users, X } from "lucide-react";

import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Button } from "@/shared/ui/primitives/Button";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { Caption, Eyebrow, Heading, Metric, Text } from "@/shared/ui/primitives/typography";

import {
  useProjectPublicationPreview,
  usePublishProject,
} from "../api/project.queries";
import type { ProjectPublicationWarning } from "../api/project.service";

interface PublishProjectModalProps {
  readonly isOpen: boolean;
  readonly projectId: string;
  readonly projectTitle: string;
  readonly onClose: () => void;
  readonly onPublished?: () => void;
}

const WARNING_COPY: Record<
  ProjectPublicationWarning,
  { key: string; fallback: string }
> = {
  no_cast: {
    key: "projects.publish.warning_no_cast",
    fallback: "Nikt nie jest jeszcze zaproszony — nie wyjdzie żadna wiadomość.",
  },
  no_rehearsals: {
    key: "projects.publish.warning_no_rehearsals",
    fallback: "Brak prób w harmonogramie — zaproszenie nie poda ich terminów.",
  },
  no_program: {
    key: "projects.publish.warning_no_program",
    fallback: "Program jest pusty — zaproszenie nie poda repertuaru.",
  },
  no_location: {
    key: "projects.publish.warning_no_location",
    fallback: "Nie ustalono miejsca wydarzenia.",
  },
  unreachable_artists: {
    key: "projects.publish.warning_unreachable",
    fallback:
      "Część obsady nie ma jeszcze konta — do nich zaproszenie nie dotrze.",
  },
};

export const PublishProjectModal = ({
  isOpen,
  projectId,
  projectTitle,
  onClose,
  onPublished,
}: PublishProjectModalProps): React.ReactPortal | null => {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState<boolean>(false);
  const titleId = useId();

  const preview = useProjectPublicationPreview(projectId, isOpen);
  const publish = usePublishProject(projectId);

  useEffect(() => setMounted(true), []);
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !publish.isPending) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, publish.isPending]);

  if (!mounted) return null;

  const data = preview.data;
  const unreachable =
    data?.recipients.filter((recipient) => !recipient.is_reachable) ?? [];

  const handleConfirm = async (): Promise<void> => {
    await publish.mutateAsync();
    onPublished?.();
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-focus-trap flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/45 backdrop-blur-md"
            onClick={publish.isPending ? undefined : onClose}
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-surface border border-ethereal-gold/30 bg-ethereal-marble shadow-glass-solid"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="h-1 w-full bg-linear-to-r from-ethereal-gold/70 via-ethereal-gold to-ethereal-gold/70" />

            <button
              type="button"
              onClick={onClose}
              disabled={publish.isPending}
              aria-label={t("common.actions.close", "Zamknij")}
              className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-full text-ethereal-graphite/50 outline-none transition-colors hover:bg-ethereal-ink/5 hover:text-ethereal-ink focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 disabled:opacity-40"
            >
              <X size={16} strokeWidth={2} aria-hidden="true" />
            </button>

            <div className="flex flex-col gap-4 p-6">
              <div className="pr-8">
                <Eyebrow color="gold">
                  {t("projects.publish.eyebrow", "Publikacja projektu")}
                </Eyebrow>
                <Heading
                  as="h2"
                  id={titleId}
                  size="xl"
                  weight="bold"
                  className="mt-1 leading-tight wrap-break-word"
                >
                  {projectTitle}
                </Heading>
              </div>

              {preview.isPending && (
                <div className="flex min-h-40 items-center justify-center">
                  <EtherealLoader fullHeight={false} />
                </div>
              )}

              {preview.isError && (
                <Text size="sm" className="text-ethereal-crimson">
                  {t(
                    "projects.publish.preview_error",
                    "Nie udało się wczytać podglądu publikacji.",
                  )}
                </Text>
              )}

              {data && (
                <>
                  <div className="flex items-center gap-4 rounded-nested border border-hairline bg-ethereal-alabaster/70 p-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-nested bg-ethereal-gold/12 text-ethereal-gold">
                      <Users size={22} strokeWidth={1.75} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <Metric size="lg">{data.recipient_count}</Metric>
                      <Caption color="muted" className="block">
                        {t("projects.publish.recipients_hint", {
                          count: data.recipient_count,
                          defaultValue:
                            "osób otrzyma pełne zaproszenie: termin, próby, program i swoją partię.",
                        })}
                      </Caption>
                    </div>
                  </div>

                  {data.skipped_count > 0 && (
                    <Caption color="muted">
                      {t(
                        "projects.publish.skipped_hint",
                        "{{count}} osób już odpowiedziało — ich nie zapraszamy ponownie.",
                        { count: data.skipped_count },
                      )}
                    </Caption>
                  )}

                  {data.warnings.length > 0 && (
                    <ul className="flex flex-col gap-2 rounded-nested border border-ethereal-gold/25 bg-ethereal-gold/8 p-4">
                      {data.warnings.map((warning) => (
                        <li key={warning} className="flex items-start gap-2.5">
                          <AlertTriangle
                            size={15}
                            className="mt-0.5 shrink-0 text-ethereal-gold"
                            aria-hidden="true"
                          />
                          <Text size="sm" color="graphite">
                            {t(
                              WARNING_COPY[warning].key,
                              WARNING_COPY[warning].fallback,
                            )}
                          </Text>
                        </li>
                      ))}
                    </ul>
                  )}

                  {unreachable.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <Caption
                        color="muted"
                        className="inline-flex items-center gap-1.5"
                      >
                        <MailWarning
                          size={13}
                          className="text-ethereal-graphite/60"
                          aria-hidden="true"
                        />
                        {t(
                          "projects.publish.unreachable_list",
                          "Bez konta — zaproszenie do nich nie dotrze:",
                        )}
                      </Caption>
                      <Text size="sm" color="graphite">
                        {unreachable
                          .map((recipient) => recipient.artist_name)
                          .join(", ")}
                      </Text>
                    </div>
                  )}

                  <Caption color="muted">
                    {t(
                      "projects.publish.irreversible_hint",
                      "Po publikacji projekt staje się widoczny dla obsady, a wiadomości nie da się cofnąć.",
                    )}
                  </Caption>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-ethereal-incense/15 bg-ethereal-alabaster px-6 py-4">
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={publish.isPending}
              >
                {t("common.actions.cancel", "Anuluj")}
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirm}
                isLoading={publish.isPending}
                disabled={!data?.is_publishable}
                leftIcon={<Send size={15} aria-hidden="true" />}
              >
                {t("projects.publish.confirm", "Opublikuj i wyślij")}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
