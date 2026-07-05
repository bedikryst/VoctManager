/**
 * @file SeasonSetupConcierge.tsx
 * @description The conductor's "First Season" concierge — the founding ritual that
 * turns an empty command console into a populated one. Not a marketing carousel
 * and not a blocking takeover: a calm workbench panel at the top of the dashboard
 * that names the maestro, offers the kamerton (the honest A a season is tuned
 * from — tap to ring, tap to silence), and guides three founding acts — schedule
 * the first concert, invite the singers, build the repertoire — each
 * deep-linking to the real (already-premium) flow rather than forking it. Step completion is derived from live data ({@link useSeasonSetup}),
 * so the panel fills in as the season takes shape and celebrates when it is founded.
 * @architecture Enterprise SaaS 2026
 * @module features/dashboard/components/SeasonSetupConcierge
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CalendarPlus,
  Check,
  Music,
  Sparkles,
  Users,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { EASE } from "@/shared/ui/kinematics/motion-presets";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow } from "@/shared/ui/primitives/typography/Eyebrow";
import { Heading } from "@/shared/ui/primitives/typography/Heading";
import { Text } from "@/shared/ui/primitives/typography/Text";
import { useWelcomeTone } from "@/shared/ui/instruments/useWelcomeTone";
import {
  useSeasonSetup,
  type SeasonStepKey,
} from "../hooks/useSeasonSetup";

interface StepConfig {
  readonly key: SeasonStepKey;
  readonly to: string;
  readonly Icon: LucideIcon;
  readonly tint: string; // icon + number colour
  readonly ring: string; // pending card hover/border accent
}

const STEPS: readonly StepConfig[] = [
  {
    key: "concert",
    to: "/panel/projects",
    Icon: CalendarPlus,
    tint: "text-ethereal-gold",
    ring: "hover:border-ethereal-gold/45",
  },
  {
    key: "singers",
    to: "/panel/artists",
    Icon: Users,
    tint: "text-ethereal-amethyst",
    ring: "hover:border-ethereal-amethyst/45",
  },
  {
    key: "repertoire",
    to: "/panel/archive-management",
    Icon: Music,
    tint: "text-ethereal-sage",
    ring: "hover:border-ethereal-sage/45",
  },
];

interface SeasonStepCardProps {
  readonly config: StepConfig;
  readonly index: number;
  readonly done: boolean;
}

const SeasonStepCard = ({
  config,
  index,
  done,
}: SeasonStepCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { Icon, to, tint, ring, key } = config;
  const label = t(`dashboard.admin.setup.steps.${key}.label`);
  const desc = t(`dashboard.admin.setup.steps.${key}.desc`);

  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-ethereal-sage/25 bg-ethereal-sage/[0.07] p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-ethereal-sage/30 bg-ethereal-sage/15 text-ethereal-sage">
          <Check size={18} strokeWidth={2.5} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <Text size="sm" weight="bold" className="block leading-tight text-ethereal-graphite/70">
            {label}
          </Text>
          <Eyebrow color="sage" className="mt-1 block">
            {t("dashboard.admin.setup.step_done", "Gotowe")}
          </Eyebrow>
        </span>
      </div>
    );
  }

  return (
    <Link
      to={to}
      className={cn(
        "group flex items-start gap-3 rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/60 p-4 shadow-glass-ethereal transition-[border-color,transform] duration-300 hover:shadow-glass-ethereal-hover active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
        ring,
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-ethereal-incense/25 bg-white/50">
        <Icon size={18} strokeWidth={2} className={tint} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ethereal-graphite/40">
            {String(index).padStart(2, "0")}
          </span>
          <Text size="sm" weight="bold" className="block leading-tight">
            {label}
          </Text>
        </span>
        <Text size="xs" color="muted" className="mt-1 block leading-snug">
          {desc}
        </Text>
        <span className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-ethereal-gold">
          {t(`dashboard.admin.setup.steps.${key}.cta`)}
          <ArrowRight
            size={13}
            strokeWidth={2.5}
            className="transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </span>
    </Link>
  );
};

interface SeasonSetupConciergeProps {
  /** The conductor's name (vocative-aware), highlighted in the greeting. */
  readonly name?: string | null;
}

export const SeasonSetupConcierge = ({
  name,
}: SeasonSetupConciergeProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const { toggle, isPlaying } = useWelcomeTone();
  const {
    isActive,
    steps,
    completedCount,
    total,
    allDone,
    finish,
    snooze,
    isFinishing,
  } = useSeasonSetup();

  if (!isActive) return null;

  const doneByKey = new Map(steps.map((s) => [s.key, s.done]));
  const progress = Math.round((completedCount / total) * 100);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE.buttery }}
    >
      <GlassCard
        variant="ethereal"
        padding="lg"
        glow
        isHoverable={false}
        className="relative overflow-hidden"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-ethereal-gold/60 to-transparent"
          aria-hidden="true"
        />

        <button
          type="button"
          onClick={snooze}
          aria-label={t("dashboard.admin.setup.snooze", "Zrobię to później")}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-ethereal-graphite/45 transition-colors hover:bg-ethereal-graphite/6 hover:text-ethereal-ink"
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>

        <div className="lg:flex lg:items-start lg:gap-8">
          {/* ── the address: who, why, and the chord ── */}
          <div className="lg:w-[42%] lg:shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-ethereal-gold" aria-hidden="true" />
              <Eyebrow color="gold" as="p">
                {t("dashboard.admin.setup.eyebrow", "Pierwszy sezon")}
              </Eyebrow>
            </div>

            <Heading as="h2" size="2xl" color="default" className="mt-3 leading-tight">
              {allDone
                ? t("dashboard.admin.setup.title_done", "Sezon założony")
                : t("dashboard.admin.setup.title", "Załóżmy fundamenty")}
              {name && !allDone ? (
                <span className="italic text-ethereal-gold">, {name}</span>
              ) : null}
            </Heading>

            <Text size="sm" color="graphite" className="mt-3 max-w-md leading-7">
              {allDone
                ? t(
                    "dashboard.admin.setup.intro_done",
                    "Masz koncert w kalendarzu, śpiewaków w składzie i repertuar w archiwum. Twój pulpit jest gotowy do pracy.",
                  )
                : t(
                    "dashboard.admin.setup.intro",
                    "Trzy kroki dzielą Cię od żywego pulpitu: zaplanuj pierwszy koncert, zaproś śpiewaków i zbuduj repertuar. Każdy krok prowadzi prosto do właściwego narzędzia.",
                  )}
            </Text>

            <button
              type="button"
              onClick={toggle}
              aria-pressed={isPlaying}
              aria-label={
                isPlaying
                  ? t("dashboard.admin.setup.tone_stop", "Wycisz ton")
                  : t("dashboard.admin.setup.tone_cta", "Kamerton · ton A")
              }
              className={cn(
                "group mt-5 inline-flex items-center gap-2.5 rounded-full border px-4 py-2 transition-colors",
                isPlaying
                  ? "border-ethereal-gold/60 bg-ethereal-gold/10"
                  : "border-ethereal-incense/25 bg-white/40 hover:border-ethereal-gold/45 hover:bg-ethereal-gold/8",
              )}
            >
              <Volume2
                size={16}
                strokeWidth={2}
                className={cn(
                  "shrink-0 transition-transform",
                  isPlaying ? "animate-pulse text-ethereal-gold" : "text-ethereal-gold/80 group-hover:scale-110",
                )}
                aria-hidden="true"
              />
              <Eyebrow color={isPlaying ? "gold" : "muted"} as="span" className="tracking-[0.16em]">
                {isPlaying
                  ? t("dashboard.admin.setup.tone_playing", "Brzmi… wycisz")
                  : t("dashboard.admin.setup.tone_cta", "Kamerton · ton A")}
              </Eyebrow>
            </button>
          </div>

          {/* ── the founding acts ── */}
          <div className="mt-6 flex-1 lg:mt-0">
            <div className="flex items-center justify-between gap-3">
              <Eyebrow color="muted" as="p">
                {t("dashboard.admin.setup.progress", "Krok {{done}} z {{total}}", {
                  done: completedCount,
                  total,
                })}
              </Eyebrow>
              <Eyebrow color={allDone ? "sage" : "gold"} as="p">
                {progress}%
              </Eyebrow>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ethereal-incense/15">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  allDone ? "bg-ethereal-sage" : "bg-ethereal-gold",
                )}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: EASE.buttery }}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-1">
              {STEPS.map((config, i) => (
                <SeasonStepCard
                  key={config.key}
                  config={config}
                  index={i + 1}
                  done={doneByKey.get(config.key) ?? false}
                />
              ))}
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              {allDone ? (
                <Button
                  type="button"
                  variant="primary"
                  size="touch"
                  onClick={finish}
                  isLoading={isFinishing}
                >
                  {t("dashboard.admin.setup.finish", "Zakończ konfigurację")}
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={snooze}
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-ethereal-graphite/45 transition-colors hover:text-ethereal-ink"
                >
                  {t("dashboard.admin.setup.snooze", "Zrobię to później")}
                </button>
              )}
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};

SeasonSetupConcierge.displayName = "SeasonSetupConcierge";
