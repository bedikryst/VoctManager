/**
 * @file ArtistDashboard.tsx
 * @description The Artist's Sanctuary.
 * Synchronized with the Ethereal UI 2026 Admin standards. Zero Lucide vectors.
 * Kinetic typography, fluid masking, and Roman numeral directives.
 * @module panel/dashboard/ArtistDashboard
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/app/providers/AuthProvider";
import { useArtistDashboardData } from "./hooks/useArtistDashboardData";

import { SystemModuleCard } from "@/shared/widgets/domain/SystemModuleCard";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { KineticText } from "@/shared/ui/kinematics/KineticText";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";

import { ArtistNextRehearsalWidget } from "./components/ArtistNextRehearsalWidget";
import { ArtistNextProjectWidget } from "./components/ArtistNextProjectWidget";
import { ArtistEmptyState } from "./components/ArtistEmptyState";

const EtherealEasing = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 15, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1.2, ease: EtherealEasing, delay: 0.1 },
  },
};

export default function ArtistDashboard(): React.JSX.Element {
  const { user } = useAuth();
  const { t } = useTranslation();

  const { isLoading, upNextRehearsal, upNextProject, greeting } =
    useArtistDashboardData(user?.artist_profile_id ?? undefined);

  const ARTIST_DIRECTIVES = useMemo(
    () => [
      {
        id: "schedule",
        romanNumeral: "I",
        accentClass: "bg-ethereal-gold",
        title: t("dashboard.artist.module_schedule_title", "Harmonogram"),
        description: t(
          "dashboard.artist.module_schedule_desc",
          "Próby, koncerty i zarządzanie absencją.",
        ),
        path: "/panel/schedule",
      },
      {
        id: "materials",
        romanNumeral: "II",
        accentClass: "bg-ethereal-sage",
        title: t("dashboard.artist.module_materials_title", "Repertuar"),
        description: t(
          "dashboard.artist.module_materials_desc",
          "Partytury PDF i referencyjne ścieżki audio.",
        ),
        path: "/panel/materials",
      },
      {
        id: "resources",
        romanNumeral: "III",
        accentClass: "bg-ethereal-incense",
        title: t("dashboard.artist.module_resources_title", "Doktryna"),
        description: t(
          "dashboard.artist.module_resources_desc",
          "Wytyczne katedralne, dress-code i logistyka.",
        ),
        path: "/panel/resources",
      },
    ],
    [t],
  );

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center">
        <EtherealLoader
          message={t("dashboard.shared.syncing", "Strojenie Rezonansu...")}
        />
      </div>
    );
  }

  return (
    <div className="relative isolate w-full max-w-[1600px] mx-auto px-0 pb-24 md:px-6 lg:px-10">
      {/* HEADER STRATUM */}
      <motion.header
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } },
        }}
        className="mb-12 flex flex-col px-5 md:px-0"
      >
        <motion.div variants={fadeUp} className="mb-4 flex items-center gap-4">
          <div className="h-[1px] w-12 bg-ethereal-sage/40" />
          <Eyebrow color="muted">
            {greeting}
          </Eyebrow>
        </motion.div>

        <Heading as="h1" size="huge" weight="medium" className="flex items-baseline gap-2">
          {t("dashboard.artist.title_main", "Przestrzeń ")}
          <KineticText
            as="span"
            text={user?.first_name || t("common.artist_generic", "Artysty")}
            delay={0.2}
            className="italic text-ethereal-sage/90"
          />
        </Heading>
      </motion.header>

      {/* CORE HORIZON STRATUM */}
      <section className="mb-12 px-5 md:px-0" aria-labelledby="horizon-heading">
        <div className="mb-6 flex items-center gap-4 relative">
          <Eyebrow
            as="h2"
            id="horizon-heading"
            color="graphite"
          >
            {t("dashboard.artist.next_challenges", "Bezpośrednie Wytyczne")}
          </Eyebrow>
          <div className="h-[1px] flex-1 bg-gradient-to-r from-ethereal-incense/20 to-transparent" />
        </div>

        {!upNextRehearsal && !upNextProject ? (
          <ArtistEmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Asymmetric weighting: 
              If both exist, Project gets 7 cols, Rehearsal gets 5 cols 
            */}
            {upNextProject && (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className={upNextRehearsal ? "lg:col-span-7" : "lg:col-span-12"}
              >
                <ArtistNextProjectWidget project={upNextProject} />
              </motion.div>
            )}

            {upNextRehearsal && (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className={upNextProject ? "lg:col-span-5" : "lg:col-span-12"}
              >
                <ArtistNextRehearsalWidget rehearsal={upNextRehearsal} />
              </motion.div>
            )}
          </div>
        )}
      </section>

      {/* DIRECTIVES DIRECTORY */}
      <section className="px-5 md:px-0" aria-labelledby="modules-heading">
        <div className="mb-6 flex items-center gap-4 relative">
          <div className="h-[1px] flex-1 bg-gradient-to-l from-ethereal-incense/20 to-transparent" />
          <Eyebrow
            as="h3"
            id="modules-heading"
            color="graphite"
            className="text-right"
          >
            {t("dashboard.artist.personal_modules", "Katalog Modułów")}
          </Eyebrow>
        </div>

        <nav aria-label={t("dashboard.artist.nav_aria", "Nawigacja artysty")}>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-3 md:auto-rows-[180px]">
            {ARTIST_DIRECTIVES.map((mod, index) => (
              <motion.li
                key={mod.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 1,
                  ease: EtherealEasing,
                  delay: 0.3 + index * 0.1,
                }}
                className="h-full"
              >
                <SystemModuleCard {...mod} />
              </motion.li>
            ))}
          </ul>
        </nav>
      </section>
    </div>
  );
}
