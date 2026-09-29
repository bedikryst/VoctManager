/**
 * @file TelemetryWidget.tsx
 * @description The ensemble card: archive size, live productions, and the SATB
 * balance of every active singer in the roster.
 *
 * The balance is the whole ensemble, not the next concert's cast, and the card
 * says so in its own words: it shares a row with the next-concert card, and
 * unlabelled it reads as that concert's balance. A concert's balance is read on
 * that project's cast tab.
 * @architecture Enterprise SaaS 2026
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { MetricBlock } from "@/shared/ui/composites/MetricBlock";
import { Caption, Eyebrow, Text, Unit } from "@/shared/ui/primitives/typography";
import { Divider } from "@/shared/ui/primitives/Divider";
import { ResonancePillar } from "@/shared/ui/kinematics/ResonancePillar";
import {
  VOICE_SECTIONS,
  type SectionKey,
} from "@/features/artists/constants/voiceSections";

/**
 * Singers per SATB section, each counted once, by the shared voice → section
 * map (`getVoiceSection`: mezzo and countertenor with the altos, baritone with
 * the basses). `Total` is the sum of the four, so the figure beside the pillars
 * is the pillars' own total; the conductor and the players have no section and
 * are in neither.
 */
export type VoiceStatsDto = Record<SectionKey, number> & { Total: number };

export interface AdminTelemetryStatsDto {
  /**
   * `null` while the archive is still in flight. The dashboard no longer waits
   * on that list to paint, so this is the one figure on the card that can
   * arrive after its own label — it holds a rule rather than a wrong zero.
   */
  totalPieces: number | null;
  activeProjects: number;
  satb: VoiceStatsDto;
}

export interface TelemetryWidgetProps {
  adminStats?: AdminTelemetryStatsDto;
}

export function TelemetryWidget({
  adminStats,
}: TelemetryWidgetProps): React.JSX.Element {
  const { t } = useTranslation();

  const stats = adminStats ?? {
    totalPieces: null,
    activeProjects: 0,
    satb: { S: 0, A: 0, T: 0, B: 0, Total: 0 },
  };

  // The accent beside each count comes from the section taxonomy, so a voice
  // is one colour here and on the roster.
  const voices = useMemo(
    () =>
      VOICE_SECTIONS.map((section) => ({
        label: section.key,
        val: stats.satb[section.key],
        accent: section.accent,
      })),
    [stats.satb],
  );

  const maxVoiceVal = Math.max(...voices.map((v) => v.val), 1);

  return (
    <GlassCard
      variant="light"
      padding="none"
      isHoverable={false}
      withNoise
      className="flex h-full w-full flex-col p-6 pb-4 md:p-8 md:pb-5 xl:p-10 xl:pb-6"
      contentClassName="justify-between"
    >
      {/* UPPER STRATUM: Resonance Metrics */}
      <section className="relative z-10 flex flex-col">
        <SectionHeader
          title={t("dashboard.admin.kpi_telemetry", "Telemetria Bazy")}
          icon={<AudioLines size={16} strokeWidth={1.5} />}
        />

        <div className="grid grid-cols-2 gap-2 xl:gap-8 relative">
          <MetricBlock
            label={t("dashboard.admin.kpi_pieces", "Repertuar Sakralny")}
            value={stats.totalPieces ?? "—"}
          />

          <div className="relative pl-8">
            <Divider
              variant="gradient-bottom"
              orientation="vertical"
              position="absolute-left"
            />
            <MetricBlock
              label={t(
                "dashboard.admin.kpi_active_projects",
                "Aktywne Dyrektywy",
              )}
              value={stats.activeProjects}
              accentColor="gold"
            />
          </div>
        </div>
      </section>

      {/* LOWER STRATUM: SATB Harmonic Cohesion */}
      <section className="relative z-10 mt-8 flex flex-col">
        <header className="mb-10 flex items-baseline justify-between pt-4 relative">
          <Divider
            variant="gradient-right"
            position="absolute-top"
            className="opacity-50"
          />

          <div className="flex flex-col gap-1">
            <Eyebrow color="muted">
              {t("dashboard.admin.kpi_readiness", "Spójność Harmoniczna")}
            </Eyebrow>
            <Caption color="muted">
              {t(
                "dashboard.admin.satb_scope",
                "Wszyscy aktywni śpiewacy w bazie",
              )}
            </Caption>
          </div>

          <div
            className="flex items-baseline gap-1"
            aria-label={t(
              "dashboard.admin.satb_total_aria",
              "Łączna liczba głosów w zespole",
            )}
          >
            <Text className="tabular-nums">{stats.satb.Total}</Text>
            <Unit size="sm" color="muted">
              voc.
            </Unit>
          </div>
        </header>

        <div
          className="flex h-28 items-end justify-between px-2"
          role="list"
          aria-label={t(
            "dashboard.admin.satb_distribution",
            "Dystrybucja Głosów SATB",
          )}
        >
          {voices.map((v, index) => (
            <ResonancePillar
              key={v.label}
              value={v.val}
              heightPercentage={`${(v.val / maxVoiceVal) * 100}%`}
              delayIndex={index}
              label={v.label}
              accent={v.accent}
            />
          ))}
        </div>
      </section>
    </GlassCard>
  );
}
