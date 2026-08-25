/**
 * @file OfflineReadyCard.tsx
 * @description One strip on the chorister's home: take every upcoming concert
 * offline in a single tap, and — the half that matters more — say plainly what
 * that means before they tap.
 *
 * The per-concert control in the Songbook is precise but buried: it sits in a
 * project header a singer has to go looking for, which is not where the thought
 * "I'll have no signal in that church" occurs. This is that thought's address.
 *
 * The scope is the concerts still ahead, never "everything" — see `offlinePrep`.
 * The sheet answers the two questions the score stand cannot: what exactly gets
 * stored, and what happens to the marks a singer makes on the way there.
 * @module features/materials/components
 */

import React, { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Check,
  CircleHelp,
  CloudDownload,
  Loader2,
  Lock,
  Music2,
  PencilLine,
  RotateCw,
  TriangleAlert,
  WifiOff,
} from "lucide-react";

import { useOfflineStore } from "@/app/store/useOfflineStore";
import { useArtistPreview } from "@/app/providers/ArtistPreviewProvider";
import { isServiceWorkerSupported } from "@/shared/offline/offlineClient";
import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

import {
  downloadGroupWithMarks,
  summarizeOfflineScope,
  upcomingOfflineGroups,
} from "../lib/offlinePrep";
import { useMaterialsData } from "../hooks/useMaterialsData";

export const OfflineReadyCard = (): React.JSX.Element | null => {
  const { t } = useTranslation();
  const { isPreview } = useArtistPreview();
  const queryClient = useQueryClient();
  const manifests = useOfflineStore((state) => state.manifests);

  // The singer's own programme, which is also the only honest source for the
  // counts below. One persisted read-model GET, shared with the Songbook's cache.
  const { filteredGroups } = useMaterialsData();
  const groups = useMemo(
    () => upcomingOfflineGroups(filteredGroups),
    [filteredGroups],
  );
  const scope = useMemo(() => summarizeOfflineScope(groups), [groups]);

  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const stored = groups.filter((group) => manifests[group.project.id]).length;
  const allStored = groups.length > 0 && stored === groups.length;

  const handleDownload = useCallback(async () => {
    setBusy({ done: 0, total: groups.length });
    let failed = 0;
    try {
      // Sequential on purpose: the service worker fetches each asset as a full
      // body, and firing four concerts at a phone at once is how a download
      // becomes a stall.
      for (const [index, group] of groups.entries()) {
        const outcome = await downloadGroupWithMarks(group, queryClient);
        failed += outcome.failed;
        setBusy({ done: index + 1, total: groups.length });
      }
      if (failed > 0) {
        toast.warning(
          t(
            "offline.prep.partial",
            "Pobrano część materiałów — sprawdź połączenie i spróbuj ponownie.",
          ),
        );
      } else {
        toast.success(
          t("offline.prep.ready", "Wszystko gotowe. Możesz wyjść poza zasięg."),
        );
      }
    } catch {
      toast.error(
        t(
          "offline.download.unavailable",
          "Tryb offline jest niedostępny na tym urządzeniu.",
        ),
      );
    } finally {
      setBusy(null);
    }
  }, [groups, queryClient, t]);

  // Nothing to prepare, no worker to prepare it with, or a manager reading
  // somebody else's home — in a preview every state below would report the
  // MANAGER's own device, which is not what the screen claims to be.
  if (isPreview || groups.length === 0 || !isServiceWorkerSupported()) {
    return null;
  }

  return (
    <>
      <GlassCard contentClassName="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={
              allStored
                ? "mt-0.5 shrink-0 rounded-full bg-ethereal-sage/15 p-2.5 text-ethereal-sage"
                : "mt-0.5 shrink-0 rounded-full bg-ethereal-gold/15 p-2.5 text-ethereal-gold"
            }
          >
            {allStored ? (
              <Check size={18} aria-hidden="true" />
            ) : (
              <WifiOff size={18} aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <Eyebrow as="p" color="muted">
              {t("offline.prep.eyebrow", "Bez internetu")}
            </Eyebrow>
            <Text as="p" weight="semibold" className="mt-0.5">
              {allStored
                ? t("offline.prep.title_ready", "Masz wszystko na swoim telefonie")
                : t("offline.prep.title", "Przygotuj się na próbę")}
            </Text>
            <Caption color="muted" className="mt-1 block">
              {t("offline.prep.scope", {
                defaultValue:
                  "{{concerts}} nadchodzące · {{pieces}} utworów · {{tracks}} nagrań · nuty z oznaczeniami",
                concerts: scope.concerts,
                pieces: scope.pieces,
                tracks: scope.tracks,
              })}
            </Caption>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="mt-1.5 inline-flex items-center gap-1.5 text-ethereal-graphite/70 transition-colors hover:text-ethereal-gold"
            >
              <CircleHelp size={13} aria-hidden="true" />
              <Caption>
                {t("offline.prep.explain", "Co dokładnie się pobierze?")}
              </Caption>
            </button>
          </div>
        </div>

        <Button
          variant={allStored ? "ghost" : "primary"}
          size="touch"
          onClick={handleDownload}
          disabled={busy !== null}
          className="shrink-0"
          leftIcon={
            busy !== null ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : allStored ? (
              <RotateCw size={16} aria-hidden="true" />
            ) : (
              <CloudDownload size={16} aria-hidden="true" />
            )
          }
        >
          {busy !== null
            ? t("offline.prep.busy", "Pobieram… {{done}}/{{total}}", {
                done: busy.done,
                total: busy.total,
              })
            : allStored
              ? t("offline.prep.refresh", "Odśwież")
              : t("offline.prep.action", "Pobierz na offline")}
        </Button>
      </GlassCard>

      <BottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t("offline.prep.sheet_title", "Śpiewnik bez internetu")}
        subtitle={t(
          "offline.prep.sheet_subtitle",
          "Co ląduje na telefonie i co się dzieje z Twoimi notatkami",
        )}
      >
        <ul className="flex flex-col gap-4 pb-2">
          <SheetFact
            icon={Music2}
            title={t("offline.prep.fact_assets_title", "Nuty i wszystkie głosy")}
            body={t(
              "offline.prep.fact_assets_body",
              "Z każdego nadchodzącego koncertu: partytury oraz nagrania wszystkich głosów — nie tylko Twojego, bo mikser i tryb „bez mojego głosu” potrzebują całego chóru.",
            )}
          />
          <SheetFact
            icon={PencilLine}
            title={t("offline.prep.fact_marks_title", "Oznaczenia dyrygenta")}
            body={t(
              "offline.prep.fact_marks_body",
              "Pobierają się razem z nutami, więc w kościele bez zasięgu widzisz je tak samo jak w domu. Nowe dopiski dyrygenta pojawią się przy najbliższym połączeniu.",
            )}
          />
          <SheetFact
            icon={Lock}
            title={t("offline.prep.fact_private_title", "Twoje własne notatki")}
            body={t(
              "offline.prep.fact_private_body",
              "Możesz pisać na nutach bez internetu — zapisują się na urządzeniu i wyślą się same, gdy sieć wróci, nawet po zamknięciu aplikacji. Widzisz je wyłącznie Ty; nie widzi ich dyrygent ani nikt inny.",
            )}
          />
          <SheetFact
            icon={TriangleAlert}
            title={t("offline.prep.fact_space_title", "Zajmuje miejsce")}
            body={t(
              "offline.prep.fact_space_body",
              "Nagrania to setki megabajtów. Pobierane są tylko koncerty, które masz jeszcze przed sobą; zakończone możesz usunąć w Śpiewniku, przy nagłówku koncertu.",
            )}
          />
        </ul>
      </BottomSheet>
    </>
  );
};

const SheetFact = ({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Music2;
  title: string;
  body: string;
}): React.JSX.Element => (
  <li className="flex items-start gap-3">
    <span className="mt-0.5 shrink-0 rounded-full bg-ethereal-gold/12 p-2 text-ethereal-gold">
      <Icon size={15} aria-hidden="true" />
    </span>
    <div className="min-w-0">
      <Text as="p" weight="semibold">
        {title}
      </Text>
      <Text as="p" size="sm" color="muted" className="mt-0.5">
        {body}
      </Text>
    </div>
  </li>
);
