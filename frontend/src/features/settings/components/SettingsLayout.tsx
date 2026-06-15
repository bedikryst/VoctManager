/**
 * @file SettingsLayout.tsx
 * @description Settings hub: identity card + grouped, deep-linkable section
 * nav (desktop sidebar / mobile rail) with animated panes. URL-driven via
 * /panel/settings/:section so every pane is shareable and survives refresh.
 * A pending-dot on "Logistyka" nudges users with missing wardrobe data.
 * @architecture Enterprise SaaS 2026
 * @module features/settings/components/SettingsLayout
 */

import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { NotificationsTab } from "@/features/settings/components/NotificationsTab";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { DURATION, EASE } from "@/shared/ui/kinematics/motion-presets";
import { cn } from "@/shared/lib/utils";

import { useSettingsData } from "../api/settings.queries";
import {
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  isSettingsSection,
  type SettingsSectionId,
} from "../constants/sections";
import { SettingsIdentityCard } from "./SettingsIdentityCard";
import { GeneralTab } from "./GeneralTab";
import { SecurityTab } from "./SecurityTab";
import { LogisticsTab } from "./LogisticsTab";
import { PrivacyTab } from "./PrivacyTab";
import { IntegrationsTab } from "./IntegrationsTab";

const renderSection = (section: SettingsSectionId): React.ReactNode => {
  switch (section) {
    case "profile":
      return <GeneralTab />;
    case "security":
      return <SecurityTab />;
    case "notifications":
      return <NotificationsTab />;
    case "logistics":
      return <LogisticsTab />;
    case "calendar":
      return <IntegrationsTab />;
    case "privacy":
      return <PrivacyTab />;
  }
};

export default function SettingsLayout(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const { data: user } = useSettingsData();

  const activeSection: SettingsSectionId = isSettingsSection(section)
    ? section
    : "profile";

  const selectSection = (id: SettingsSectionId): void => {
    if (id !== activeSection) navigate(`/panel/settings/${id}`);
  };

  const profile = user?.profile;
  const logisticsIncomplete =
    Boolean(profile) &&
    (!profile?.clothing_size || !profile?.shoe_size || !profile?.height_cm);

  const showPendingDot = (id: SettingsSectionId): boolean =>
    id === "logistics" && logisticsIncomplete;

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-24 pt-0 md:pb-12">
        <PageHeader
          roleText={t("settings.page.role", "PANEL UŻYTKOWNIKA")}
          title={t("settings.page.title", "Ustawienia")}
          titleHighlight={t("settings.page.highlight", "konta")}
          size="standard"
        />

        <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-8">
          {/* ── NAVIGATION + IDENTITY ───────────────────── */}
          <aside className="shrink-0 space-y-4 md:sticky md:top-6 md:w-64">
            <SettingsIdentityCard user={user} />

            {/* Mobile: horizontal scrollable rail */}
            <nav
              aria-label={t("settings.nav.aria", "Menu ustawień")}
              className="md:hidden"
            >
              <GlassCard variant="light" padding="sm" isHoverable={false}>
                <div className="no-scrollbar flex gap-0.5 overflow-x-auto pb-px">
                  {SETTINGS_SECTIONS.map((item) => {
                    const isActive = activeSection === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectSection(item.id)}
                        className="relative flex shrink-0 flex-col items-center gap-1 rounded-xl px-3.5 py-2.5 outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
                        aria-current={isActive ? "page" : undefined}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="settings-rail-active"
                            className="absolute inset-0 rounded-xl border border-ethereal-gold/30 bg-ethereal-gold/10"
                            transition={{
                              duration: DURATION.fast,
                              ease: EASE.buttery,
                            }}
                          />
                        )}
                        <span
                          className={cn(
                            "relative z-10 transition-colors duration-300",
                            isActive
                              ? "text-ethereal-gold"
                              : "text-ethereal-graphite/50",
                          )}
                          aria-hidden="true"
                        >
                          <Icon size={18} strokeWidth={1.5} />
                          {showPendingDot(item.id) && (
                            <span className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-ethereal-gold" />
                          )}
                        </span>
                        <Text
                          size="xs"
                          weight={isActive ? "medium" : "normal"}
                          color={isActive ? "gold" : "muted"}
                          className="relative z-10 whitespace-nowrap"
                        >
                          {t(item.shortKey, item.shortFallback)}
                        </Text>
                      </button>
                    );
                  })}
                </div>
              </GlassCard>
            </nav>

            {/* Desktop: grouped vertical nav */}
            <nav
              aria-label={t("settings.nav.aria", "Menu ustawień")}
              className="hidden md:block"
            >
              <GlassCard variant="light" padding="sm" isHoverable={false}>
                <div className="flex flex-col gap-1">
                  {SETTINGS_GROUPS.map((group, groupIndex) => (
                    <div
                      key={group.id}
                      className={cn(
                        "flex flex-col gap-0.5",
                        groupIndex > 0 &&
                          "mt-2 border-t border-ethereal-ink/6 pt-3",
                      )}
                    >
                      <Eyebrow
                        as="h3"
                        color="muted"
                        className="mb-1.5 px-4 text-[9px]"
                      >
                        {t(group.labelKey, group.labelFallback)}
                      </Eyebrow>
                      {group.sections.map((item) => {
                        const isActive = activeSection === item.id;
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => selectSection(item.id)}
                            className={cn(
                              "group relative flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left outline-none",
                              "transition-colors duration-300",
                              "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/50",
                              !isActive && "hover:bg-ethereal-ink/[0.03]",
                            )}
                            aria-current={isActive ? "page" : undefined}
                          >
                            {isActive && (
                              <motion.span
                                layoutId="settings-nav-active"
                                className="absolute inset-0 rounded-xl border border-ethereal-gold/30 bg-ethereal-gold/[0.07]"
                                transition={{
                                  duration: DURATION.fast,
                                  ease: EASE.buttery,
                                }}
                              />
                            )}
                            <span
                              className={cn(
                                "relative z-10 transition-colors duration-300",
                                isActive
                                  ? "text-ethereal-gold"
                                  : "text-ethereal-graphite/50 group-hover:text-ethereal-ink/70",
                              )}
                              aria-hidden="true"
                            >
                              <Icon size={18} strokeWidth={1.5} />
                            </span>
                            <Text
                              size="sm"
                              color={isActive ? "default" : "muted"}
                              className={cn(
                                "relative z-10 flex-1 transition-colors duration-300",
                                !isActive && "group-hover:text-ethereal-ink",
                              )}
                            >
                              {t(item.labelKey, item.labelFallback)}
                            </Text>
                            {showPendingDot(item.id) && (
                              <span
                                className="relative z-10 h-1.5 w-1.5 shrink-0 rounded-full bg-ethereal-gold"
                                title={t(
                                  "settings.nav.logistics_pending",
                                  "Uzupełnij wymiary strojów",
                                )}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </GlassCard>
            </nav>
          </aside>

          {/* ── CONTENT ─────────────────────────────────── */}
          {/* Only the content column transitions on section change — the nav +
              identity card live outside it and stay put. popLayout (not "wait")
              lets the incoming pane take the flow immediately while the outgoing
              one fades out on top, so there is no blank gap or height jump. */}
          <main className="min-w-0 flex-1">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: DURATION.fast, ease: EASE.buttery }}
              >
                {renderSection(activeSection)}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </PageTransition>
  );
}
