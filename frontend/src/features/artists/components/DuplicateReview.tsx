/**
 * @file DuplicateReview.tsx
 * @description Roster hygiene: the rows that are probably one person, and the
 * one place where they get folded together. Renders nothing when the roster is
 * clean — a card announcing "0 duplicates" is a permanent fixture reporting a
 * fact that is almost always true.
 * The manager picks which row survives, because that choice decides who keeps
 * the concert history, and it is the only roster action with no way back.
 * @architecture Enterprise SaaS 2026
 * @module features/artists/components/DuplicateReview
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CopyCheck } from "lucide-react";

import { toastApiError } from "@/shared/api/errors";
import type { Artist } from "@/shared/types";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { useMergeArtists } from "../api/artist.queries";
import type { DuplicateGroup, DuplicateSignal } from "../types/artist.dto";

interface PendingMerge {
  readonly survivor: Artist;
  readonly absorbed: Artist[];
}

interface DuplicateReviewProps {
  /**
   * Non-empty by contract: the page decides whether this surface exists at all,
   * so a clean roster costs no card, no heading and no gap in the stack.
   */
  readonly groups: readonly DuplicateGroup[];
}

export const DuplicateReview = ({
  groups,
}: DuplicateReviewProps): React.JSX.Element => {
  const { t } = useTranslation();
  const mergeMutation = useMergeArtists();
  const [pending, setPending] = useState<PendingMerge | null>(null);

  /** What made these rows collide, in words — the reason is shown, not asserted. */
  const signalLabel = (signal: DuplicateSignal): string =>
    ({
      email: t("artists.duplicates.signal.email", "ten sam adres e-mail"),
      phone: t("artists.duplicates.signal.phone", "ten sam numer telefonu"),
      name: t("artists.duplicates.signal.name", "to samo imię i nazwisko"),
    })[signal];

  const fullName = (artist: Artist): string =>
    `${artist.first_name} ${artist.last_name}`.trim();

  const confirmMerge = async (): Promise<void> => {
    if (!pending) return;

    try {
      // Sequentially: each merge is one transaction, and a later one has to see
      // what the earlier one already moved onto the survivor.
      for (const absorbed of pending.absorbed) {
        await mergeMutation.mutateAsync({
          primaryId: String(pending.survivor.id),
          duplicateId: String(absorbed.id),
        });
      }

      toast.success(
        t("artists.duplicates.toast.merged", {
          defaultValue: "Scalono z pozycją: {{name}}",
          name: fullName(pending.survivor),
        }),
      );
      setPending(null);
    } catch (error: unknown) {
      toastApiError(error, t);
    }
  };

  return (
    <>
      <SectionCard
        as="h2"
        icon={<CopyCheck size={15} aria-hidden="true" />}
        title={t("artists.duplicates.title", "Możliwe duplikaty")}
      >
        <div className="flex flex-col gap-5">
          <Text color="muted">
            {t(
              "artists.duplicates.intro",
              "Te wpisy wyglądają na jedną osobę. Dwie osoby mogą jednak nosić to samo nazwisko — wybierz wpis, który ma zostać, a pozostałe zostaną do niego wchłonięte.",
            )}
          </Text>

          {groups.map((group) => (
            <div
              key={`${group.signal}-${group.key}`}
              className="flex flex-col gap-2 border-t border-hairline pt-4 first:border-t-0 first:pt-0"
            >
              <Eyebrow color="muted">{signalLabel(group.signal)}</Eyebrow>

              <div className="flex flex-col gap-2">
                {group.artists.map((artist) => (
                  <div
                    key={artist.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-ethereal-alabaster/40 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Text weight="semibold">{fullName(artist)}</Text>
                        <Badge variant="neutral">
                          {artist.voice_type_display ?? artist.voice_type}
                        </Badge>
                        {artist.account_activated && (
                          <Badge variant="success">
                            {t("artists.duplicates.activated", "Konto aktywne")}
                          </Badge>
                        )}
                      </div>
                      <Caption color="muted">
                        {[artist.email, artist.phone_number]
                          .filter(Boolean)
                          .join(" · ")}
                      </Caption>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPending({
                          survivor: artist,
                          absorbed: group.artists.filter(
                            (candidate) => candidate.id !== artist.id,
                          ),
                        })
                      }
                    >
                      {t("artists.duplicates.keep", "Zachowaj ten wpis")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <ConfirmModal
        isOpen={pending !== null}
        title={t("artists.duplicates.confirm_title", "Scalić wpisy?")}
        description={t("artists.duplicates.confirm_desc", {
          defaultValue:
            "Udział w projektach, obsady, obecności i rozmowy przejdą do wpisu „{{name}}”. Pozostałe wpisy ({{n}}) trafią do archiwum i stracą dostęp do panelu. Tej operacji nie da się cofnąć.",
          name: pending ? fullName(pending.survivor) : "",
          n: pending?.absorbed.length ?? 0,
        })}
        confirmText={t("artists.duplicates.confirm_action", "Scal wpisy")}
        onConfirm={confirmMerge}
        onCancel={() => setPending(null)}
        isLoading={mergeMutation.isPending}
      />
    </>
  );
};
