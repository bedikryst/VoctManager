/**
 * @file EnsembleBalance.tsx
 * @description Choral section-balance strip — the conductor's at-a-glance read on
 * ensemble shape. Each SATB tile shows the active head-count plus a proportional
 * bar (scaled to the largest section) so under-staffed sections are obvious, and
 * the tile doubles as the roster's section filter: click to scope, click again
 * (or "Tutti") to clear.
 *
 * The tiles count SINGING singers, which is the read a conductor wants, but the
 * roster below them also lists the archived — so the header states the archived
 * remainder whenever there is one, and the two figures add up to the rows on
 * screen instead of quietly disagreeing with them.
 * @architecture Enterprise SaaS 2026
 * @module features/artists/components/EnsembleBalance
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Archive, MailWarning, Users } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import {
  ACCENT_BAR,
  ACCENT_TEXT,
  ACCENT_TILE_ACTIVE,
  ACCENT_TILE_IDLE,
} from "@/shared/ui/primitives/accents";
import {
  Caption,
  Eyebrow,
  Metric,
  Text,
} from "@/shared/ui/primitives/typography";
import { VOICE_SECTIONS, type SectionKey } from "../constants/voiceSections";

export interface SectionBalance {
  readonly S: number;
  readonly A: number;
  readonly T: number;
  readonly B: number;
  readonly Total: number;
}

interface EnsembleBalanceProps {
  readonly balance: SectionBalance;
  readonly accountPending: number;
  readonly archivedCount: number;
  readonly activeSection: SectionKey | "";
  readonly onSelectSection: (section: SectionKey | "") => void;
}

/** A dot-separated fact in the strip's header. Figures are inline sans. */
const HeaderFact = ({
  icon,
  value,
  label,
  tone = "ink",
  title,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone?: "ink" | "gold";
  title?: string;
}) => (
  <Caption
    color="muted"
    className="inline-flex items-center gap-1 tabular-nums"
    title={title}
  >
    <span
      className={tone === "gold" ? "text-ethereal-gold" : "text-ethereal-incense/60"}
      aria-hidden="true"
    >
      {icon}
    </span>
    <Text
      as="span"
      size="sm"
      weight="semibold"
      className={tone === "gold" ? "text-ethereal-gold" : "text-ethereal-ink"}
    >
      {value}
    </Text>
    {label}
  </Caption>
);

export const EnsembleBalance = React.memo(
  ({
    balance,
    accountPending,
    archivedCount,
    activeSection,
    onSelectSection,
  }: EnsembleBalanceProps): React.JSX.Element => {
    const { t } = useTranslation();
    const peak = Math.max(balance.S, balance.A, balance.T, balance.B, 1);
    const hasFilter = activeSection !== "";

    return (
      <GlassCard variant="solid" padding="none" isHoverable={false}>
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hairline px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Users
              size={14}
              className="text-ethereal-gold/70"
              aria-hidden="true"
            />
            <Eyebrow as="h2" color="graphite">
              {t("artists.dashboard.balance_title", "Balans zespołu")}
            </Eyebrow>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <HeaderFact
              icon={<Users size={11} />}
              value={balance.Total}
              label={t("artists.dashboard.active_members", "w zespole")}
            />
            {archivedCount > 0 && (
              <HeaderFact
                icon={<Archive size={11} />}
                value={archivedCount}
                label={t("artists.dashboard.archived_members", "w archiwum")}
                title={t(
                  "artists.dashboard.archived_members_hint",
                  "Zarchiwizowani śpiewacy nadal są na liście poniżej, na jej końcu — sekcje ich nie liczą.",
                )}
              />
            )}
            {accountPending > 0 && (
              <HeaderFact
                icon={<MailWarning size={11} />}
                value={accountPending}
                label={t("artists.dashboard.pending_activation", "bez aktywacji")}
                tone="gold"
                title={t(
                  "artists.dashboard.pending_activation_hint",
                  "Aktywni artyści, którzy nie aktywowali jeszcze konta na platformie.",
                )}
              />
            )}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-5">
          {VOICE_SECTIONS.map((section) => {
            const count = balance[section.key];
            const isActive = activeSection === section.key;
            return (
              <button
                key={section.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelectSection(isActive ? "" : section.key)}
                className={cn(
                  "group flex flex-col gap-2 rounded-nested border bg-ethereal-alabaster px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 active:scale-[0.98]",
                  isActive
                    ? ACCENT_TILE_ACTIVE[section.accent]
                    : ACCENT_TILE_IDLE[section.accent],
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Eyebrow color={ACCENT_TEXT[section.accent]}>
                    {t(section.labelKey, section.defaultLabel)}
                  </Eyebrow>
                  <Metric
                    size="2xl"
                    color={isActive ? "default" : "graphite"}
                    className="leading-none"
                  >
                    {count}
                  </Metric>
                </div>
                <div
                  className="h-1 w-full overflow-hidden rounded-full bg-ethereal-ink/6"
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out",
                      ACCENT_BAR[section.accent],
                    )}
                    style={{ width: `${Math.round((count / peak) * 100)}%` }}
                  />
                </div>
              </button>
            );
          })}

          <button
            type="button"
            aria-pressed={!hasFilter}
            onClick={() => onSelectSection("")}
            className={cn(
              "group flex flex-col justify-between gap-2 rounded-nested border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 active:scale-[0.98]",
              !hasFilter
                ? "border-ethereal-gold/40 bg-ethereal-gold/[0.06] ring-1 ring-ethereal-gold/25"
                : "border-dashed border-hairline-strong bg-ethereal-alabaster/50 hover:border-ethereal-gold/30",
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <Eyebrow color={!hasFilter ? "gold" : "muted"}>
                {t("artists.filters.all", "Tutti")}
              </Eyebrow>
              <Metric
                size="2xl"
                color={!hasFilter ? "default" : "graphite"}
                className="leading-none"
              >
                {balance.Total}
              </Metric>
            </div>
            <Caption color="muted" className="leading-tight">
              {hasFilter
                ? t("artists.dashboard.show_all", "Pokaż wszystkich")
                : t("artists.dashboard.all_sections", "Wszystkie sekcje")}
            </Caption>
          </button>
        </div>
      </GlassCard>
    );
  },
);

EnsembleBalance.displayName = "EnsembleBalance";
