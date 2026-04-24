/**
 * @file Materials.tsx
 * @description Master view for the Artist Rehearsal Materials Module.
 * Facilitates access to sheet music, isolated audio tracks, and casting assignments.
 * @module features/materials/Materials
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Search, Music } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { useMaterialsData } from "./hooks/useMaterialsData";
import { ProjectMaterialGroup } from "./components/ProjectMaterialGroup";

// Design System & Kinematics
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { Text, Eyebrow } from "@/shared/ui/primitives/typography";
import { Input } from "@/shared/ui/primitives/Input";

export const Materials = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { isLoading, isError, filteredGroups } = useMaterialsData(
    user?.artist_profile_id ?? undefined,
    searchQuery,
  );

  useEffect(() => {
    if (isError && user?.artist_profile_id) {
      toast.error(
        t("materials.dashboard.sync_error_title", "Błąd synchronizacji"),
        {
          description: t(
            "materials.dashboard.sync_error_desc",
            "Nie udało się załadować materiałów. Odśwież stronę.",
          ),
        },
      );
    }
  }, [isError, t, user?.artist_profile_id]);

  if (isLoading && !!user?.artist_profile_id) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <EtherealLoader />
        <Eyebrow color="muted">
          {t("materials.dashboard.syncing", "Synchronizacja biblioteki...")}
        </Eyebrow>
      </div>
    );
  }

  return (
    <PageTransition>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="pt-6 mb-8 space-y-8 relative cursor-default pb-24 max-w-5xl mx-auto px-4 sm:px-0"
      >
        <PageHeader
          roleText={t("materials.dashboard.subtitle", "Strefa Artysty")}
          title={t("materials.dashboard.title", "Materiały do")}
          titleHighlight={t("materials.dashboard.title_highlight", "ćwiczeń")}
        />
        <Text className="mt-2 text-ethereal-graphite max-w-xl">
          {t(
            "materials.dashboard.description",
            "Pobieraj nuty, ćwicz z wykorzystaniem odtwarzacza MIDI z kontrolą tempa i sprawdzaj swoją rolę w zespole.",
          )}
        </Text>
      </motion.div>

      <div className="max-w-xl mb-10">
        <Input
          leftIcon={<Search size={16} />}
          type="text"
          placeholder={t(
            "materials.dashboard.search_placeholder",
            "Szukaj utworu lub kompozytora...",
          )}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="space-y-12">
        <AnimatePresence mode="popLayout">
          {filteredGroups.length > 0 ? (
            filteredGroups.map((group) => (
              <ProjectMaterialGroup key={group.project.id} group={group} />
            ))
          ) : (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <GlassCard
                variant="ethereal"
                className="text-center flex flex-col items-center justify-center p-16"
              >
                <Music
                  size={48}
                  className="text-ethereal-graphite mb-4 opacity-50"
                  aria-hidden="true"
                />
                <Eyebrow color="default" className="mb-2">
                  {t(
                    "materials.dashboard.empty_title",
                    "Brak przypisanych materiałów",
                  )}
                </Eyebrow>
                <Text className="text-ethereal-graphite max-w-md text-center">
                  {t(
                    "materials.dashboard.empty_desc",
                    "W tej chwili nie masz nadchodzących projektów lub dyrygent nie zatwierdził jeszcze żadnego programu koncertu.",
                  )}
                </Text>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
};
