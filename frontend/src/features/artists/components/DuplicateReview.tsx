/**
 * @file DuplicateReview.tsx
 * @description Roster hygiene: the rows that are probably one person, and the
 * one place where they get folded together. One line under the tabs
 * ("Możliwe duplikaty: 2", a `FoldLine`) that opens the groups; the page
 * renders it only while there is a group, so a clean roster costs nothing.
 *
 * The manager picks which row survives, because that choice decides who keeps
 * the concert history, and it is the only roster action with no way back. A
 * group's rows are `RecordRow`s whose one action is that choice, in words: no
 * glyph says "keep this one".
 * @module features/artists/components/DuplicateReview
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CopyCheck } from "lucide-react";

import { toastApiError } from "@/shared/api/errors";
import type { Artist } from "@/shared/types";
import { artistRoleLabel } from "@/shared/lib/voiceTypes";
import { Avatar } from "@/shared/ui/composites/Avatar";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { FoldLine } from "@/shared/ui/composites/FoldLine";
import { RecordList, RecordRow } from "@/shared/ui/composites/RecordList";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { useMergeArtists } from "../api/artist.queries";
import type { DuplicateGroup, DuplicateSignal } from "../types/artist.dto";

interface PendingMerge {
  readonly survivor: Artist;
  readonly absorbed: Artist[];
}

interface DuplicateReviewProps {
  /** Non-empty by contract: the page renders this only while there is a group. */
  readonly groups: readonly DuplicateGroup[];
}

const fullName = (artist: Artist): string => `${artist.first_name} ${artist.last_name}`.trim();

export const DuplicateReview = ({ groups }: DuplicateReviewProps): React.JSX.Element => {
  const { t } = useTranslation();
  const mergeMutation = useMergeArtists();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [pending, setPending] = useState<PendingMerge | null>(null);

  /** What made these rows collide, in words: the reason is shown, not asserted. */
  const signalLabel = (signal: DuplicateSignal): string =>
    ({
      email: t("artists.duplicates.signal.email", "ten sam adres e-mail"),
      phone: t("artists.duplicates.signal.phone", "ten sam numer telefonu"),
      name: t("artists.duplicates.signal.name", "to samo imię i nazwisko"),
    })[signal];

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
      <FoldLine
        label={t("artists.duplicates.title", "Możliwe duplikaty")}
        summary={t("artists.duplicates.summary", "Możliwe duplikaty: {{count}}", {
          count: groups.length,
        })}
        icon={<CopyCheck size={16} className="text-ethereal-gold" />}
        open={isOpen}
        onToggle={() => setIsOpen((open) => !open)}
      >
        <div className="flex flex-col gap-5 pb-2 pt-1">
          <Text size="sm" color="muted" className="max-w-prose">
            {t(
              "artists.duplicates.intro",
              "Te wpisy wyglądają na jedną osobę. Dwie osoby mogą jednak nosić to samo nazwisko — wybierz wpis, który ma zostać, a pozostałe zostaną do niego wchłonięte.",
            )}
          </Text>

          {groups.map((group) => (
            <div key={`${group.signal}-${group.key}`} className="flex flex-col gap-1">
              <Text as="span" size="sm" color="graphite">
                {signalLabel(group.signal)}
              </Text>
              <RecordList label={signalLabel(group.signal)}>
                {group.artists.map((artist) => (
                  <RecordRow
                    key={artist.id}
                    title={fullName(artist)}
                    voice="name"
                    leading={
                      <Avatar
                        src={artist.avatar_thumb_url}
                        name={fullName(artist)}
                        size="sm"
                        shape="rounded"
                        tone="neutral"
                      />
                    }
                    flags={
                      artist.account_activated ? (
                        <Badge variant="success" casing="natural">
                          {t("artists.duplicates.activated", "Konto aktywne")}
                        </Badge>
                      ) : null
                    }
                    facts={[
                      artist.voice_type
                        ? artistRoleLabel(t, artist.voice_type, artist.instrument)
                        : artist.voice_type_display,
                      artist.email,
                      artist.phone_number,
                    ]}
                    actions={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        casing="sentence"
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
                    }
                  />
                ))}
              </RecordList>
            </div>
          ))}
        </div>
      </FoldLine>

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
