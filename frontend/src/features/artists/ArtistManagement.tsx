import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { UserPlus, Search, Filter, LayoutGrid } from "lucide-react";

import { useArtistData } from "./hooks/useArtistData";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { VoiceFilterButton } from "./components/VoiceFilterButton";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import ArtistEditorPanel from "./components/ArtistEditorPanel";
import { ArtistCard } from "./components/ArtistCard";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { Text, Eyebrow } from "@/shared/ui/primitives/typography";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";

export default function ArtistManagement(): React.JSX.Element {
  const { t } = useTranslation();
  const {
    isLoading,
    isError,
    voiceTypes,
    searchTerm,
    setSearchTerm,
    voiceFilter,
    setVoiceFilter,
    ensembleBalance,
    displayArtists,
    isPanelOpen,
    editingArtist,
    initialSearchContext,
    artistToToggle,
    setArtistToToggle,
    isTogglingStatus,
    openPanel,
    closePanel,
    handleToggleRequest,
    executeStatusToggle,
  } = useArtistData();

  useEffect(() => {
    if (isError) {
      toast.error(t("artists.dashboard.sync_warning_title", "Ostrzeżenie"), {
        description: t(
          "artists.dashboard.sync_warning_desc",
          "Nie udało się pobrać danych o artystach.",
        ),
      });
    }
  }, [isError, t]);

  useBodyScrollLock(isPanelOpen || artistToToggle !== null);

  if (isLoading && displayArtists.length === 0) {
    return <EtherealLoader />;
  }

  return (
    <PageTransition>
      <div className="relative cursor-default pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <StaggeredBentoContainer className="space-y-6">
          <StaggeredBentoItem>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 mb-2">
              <PageHeader
                roleText={t("artists.dashboard.subtitle", "Zasoby Ludzkie")}
                title={t("artists.dashboard.title_prefix", "Zarządzanie")}
                titleHighlight={t(
                  "artists.dashboard.title_highlight",
                  "Zespołem",
                )}
                size="standard"
              />
              <Button
                variant="primary"
                onClick={() => openPanel(null)}
                leftIcon={<UserPlus size={16} aria-hidden="true" />}
              >
                {t("artists.dashboard.add_artist", "Dodaj Artystę")}
              </Button>
            </div>
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <div className="inline-flex flex-wrap items-center gap-2.5 p-2 bg-ethereal-alabaster/60 backdrop-blur-xl border border-ethereal-incense/15 shadow-glass-ethereal rounded-3xl w-full sm:w-auto mb-2">
              <VoiceFilterButton
                voiceType="S"
                label={t("artists.filters.sopranos", "Soprany")}
                count={ensembleBalance.S}
                isActive={voiceFilter === "S"}
                onClick={() => setVoiceFilter(voiceFilter === "S" ? "" : "S")}
              />
              <VoiceFilterButton
                voiceType="A"
                label={t("artists.filters.altos", "Alty")}
                count={ensembleBalance.A}
                isActive={voiceFilter === "A"}
                onClick={() => setVoiceFilter(voiceFilter === "A" ? "" : "A")}
              />
              <VoiceFilterButton
                voiceType="T"
                label={t("artists.filters.tenors", "Tenory")}
                count={ensembleBalance.T}
                isActive={voiceFilter === "T"}
                onClick={() => setVoiceFilter(voiceFilter === "T" ? "" : "T")}
              />
              <VoiceFilterButton
                voiceType="B"
                label={t("artists.filters.basses", "Basy")}
                count={ensembleBalance.B}
                isActive={voiceFilter === "B"}
                onClick={() => setVoiceFilter(voiceFilter === "B" ? "" : "B")}
              />
              <VoiceFilterButton
                voiceType="ALL"
                label={t("artists.filters.all", "Tutti")}
                count={ensembleBalance.Total}
                isActive={voiceFilter === ""}
                onClick={() => setVoiceFilter("")}
              />
            </div>
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  leftIcon={<Search size={16} />}
                  type="search"
                  placeholder={t(
                    "artists.dashboard.search_placeholder",
                    "Szukaj po nazwisku...",
                  )}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <div className="relative w-full sm:w-72 flex-shrink-0">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Filter
                    size={16}
                    className="text-ethereal-graphite/50"
                    aria-hidden="true"
                  />
                </div>
                <select
                  value={voiceFilter}
                  onChange={(event) => setVoiceFilter(event.target.value)}
                  className="w-full pl-11 pr-4 py-3 text-sm text-ethereal-ink bg-ethereal-alabaster/80 backdrop-blur-sm border border-ethereal-incense/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-ethereal-gold/20 focus:border-ethereal-gold/40 transition-all shadow-glass-ethereal font-bold appearance-none cursor-pointer"
                >
                  <option value="">
                    {t("artists.dashboard.all_voices", "Wszystkie głosy")}
                  </option>
                  {voiceTypes.map((voiceType) => (
                    <option key={voiceType.value} value={voiceType.value}>
                      {voiceType.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayArtists.length > 0 ? (
                <AnimatePresence>
                  {displayArtists.map((artist: any) => (
                    <ArtistCard
                      key={artist.id}
                      artist={artist}
                      onEdit={openPanel}
                      onToggleStatus={handleToggleRequest}
                    />
                  ))}
                </AnimatePresence>
              ) : (
                <div className="col-span-full">
                  <GlassCard
                    variant="ethereal"
                    className="p-16 flex flex-col items-center justify-center text-center"
                  >
                    <LayoutGrid
                      size={48}
                      className="text-ethereal-graphite opacity-30 mb-4"
                      aria-hidden="true"
                    />
                    <Eyebrow className="mb-2">
                      {t("artists.dashboard.empty_title", "Brak wyników")}
                    </Eyebrow>

                    {searchTerm ? (
                      <div className="flex flex-col items-center gap-3 mt-2">
                        <Text size="sm" color="graphite" className="max-w-sm">
                          {t("artists.dashboard.empty_desc_search", {
                            defaultValue:
                              'Nie znaleźliśmy chórzysty "{{term}}". Możesz dodać go teraz do bazy.',
                            term: searchTerm,
                          })}
                        </Text>
                        <Button
                          variant="outline"
                          onClick={() => openPanel(null, searchTerm)}
                          leftIcon={<UserPlus size={14} aria-hidden="true" />}
                          className="mt-2"
                        >
                          {t("artists.dashboard.add_search_term", {
                            defaultValue: "Dodaj: {{term}}",
                            term: searchTerm,
                          })}
                        </Button>
                      </div>
                    ) : (
                      <Text size="sm" color="graphite" className="max-w-sm">
                        {t(
                          "artists.dashboard.empty_desc_default",
                          "Zmień kryteria wyszukiwania lub dodaj nową osobę do bazy.",
                        )}
                      </Text>
                    )}
                  </GlassCard>
                </div>
              )}
            </div>
          </StaggeredBentoItem>
        </StaggeredBentoContainer>

        <ArtistEditorPanel
          isOpen={isPanelOpen}
          onClose={closePanel}
          artist={editingArtist}
          voiceTypes={voiceTypes}
          initialSearchContext={initialSearchContext}
        />

        <ConfirmModal
          isOpen={!!artistToToggle}
          title={
            artistToToggle?.willBeActive
              ? t("artists.dashboard.activate_title", "Aktywować profil?")
              : t("artists.dashboard.archive_title", "Zarchiwizować artystę?")
          }
          description={
            artistToToggle?.willBeActive
              ? t(
                  "artists.dashboard.activate_desc",
                  "Artysta odzyska możliwość logowania się do platformy i będzie widoczny w obsadzie nowych projektów.",
                )
              : t(
                  "artists.dashboard.archive_desc",
                  "Artysta utraci dostęp do panelu. Jego dane historyczne w przeszłych projektach zostaną zachowane.",
                )
          }
          onConfirm={executeStatusToggle}
          onCancel={() => setArtistToToggle(null)}
          isLoading={isTogglingStatus}
        />
      </div>
    </PageTransition>
  );
}
