import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Music, Search } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { useMaterialsData } from "./hooks/useMaterialsData";
import { ProjectMaterialGroup } from "./components/ProjectMaterialGroup";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { Input } from "@/shared/ui/primitives/Input";

export const Materials = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { isLoading, isError, filteredGroups } = useMaterialsData(
    searchQuery,
    !!user,
  );

  useEffect(() => {
    if (isError) {
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
  }, [isError, t]);

  if (isLoading) {
    return (
      <PageTransition>
        <EtherealLoader
          message={t(
            "materials.dashboard.syncing",
            "Synchronizacja biblioteki...",
          )}
        />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-4 md:px-6 pb-24 cursor-default space-y-6">
        <div className="pt-6">
          <PageHeader
            roleText={t("materials.dashboard.subtitle", "Strefa Artysty")}
            title={t("materials.dashboard.title", "Materiały do")}
            titleHighlight={t("materials.dashboard.title_highlight", "ćwiczeń")}
          />
          <Text color="graphite" className="mt-3 max-w-lg">
            {t(
              "materials.dashboard.description",
              "Pobieraj nuty, ćwicz z odtwarzaczem MIDI z kontrolą tempa i sprawdzaj swoją rolę w zespole.",
            )}
          </Text>
        </div>

        <Input
          leftIcon={<Search size={16} />}
          type="search"
          placeholder={t(
            "materials.dashboard.search_placeholder",
            "Szukaj utworu lub kompozytora...",
          )}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="flex flex-col gap-8">
          <AnimatePresence mode="popLayout">
            {filteredGroups.length > 0 ? (
              filteredGroups.map((group, i) => (
                <motion.div
                  key={group.project.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{
                    duration: 0.38,
                    ease: [0.16, 1, 0.3, 1] as const,
                    delay: i * 0.04,
                  }}
                >
                  <ProjectMaterialGroup group={group} />
                </motion.div>
              ))
            ) : (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as const }}
              >
                <GlassCard
                  variant="ethereal"
                  className="flex flex-col items-center justify-center py-16 px-8 text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-ethereal-alabaster border border-ethereal-marble flex items-center justify-center mb-6 shadow-glass-solid">
                    <Music
                      size={32}
                      className="text-ethereal-graphite opacity-50"
                      aria-hidden="true"
                    />
                  </div>
                  <Eyebrow color="default" className="mb-3">
                    {t(
                      "materials.dashboard.empty_title",
                      "Brak przypisanych materiałów",
                    )}
                  </Eyebrow>
                  <Text color="graphite" className="max-w-sm">
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
      </div>
    </PageTransition>
  );
};
