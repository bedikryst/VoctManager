import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { User, Shield, Truck, ShieldAlert, Calendar, Bell } from "lucide-react";

import { NotificationsTab } from "@/features/settings/components/NotificationsTab";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { Text } from "@/shared/ui/primitives/typography";
import { DURATION, EASE } from "@/shared/ui/kinematics/motion-presets";
import { cn } from "@/shared/lib/utils";

import { GeneralTab } from "./GeneralTab";
import { SecurityTab } from "./SecurityTab";
import { LogisticsTab } from "./LogisticsTab";
import { PrivacyTab } from "./PrivacyTab";
import { IntegrationsTab } from "./IntegrationsTab";

type TabType =
  | "general"
  | "security"
  | "logistics"
  | "privacy"
  | "integrations"
  | "notifications";

interface TabDef {
  readonly id: TabType;
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: React.ReactNode;
}

const renderTab = (activeTab: TabType): React.ReactNode => {
  switch (activeTab) {
    case "general":
      return <GeneralTab />;
    case "security":
      return <SecurityTab />;
    case "logistics":
      return <LogisticsTab />;
    case "privacy":
      return <PrivacyTab />;
    case "integrations":
      return <IntegrationsTab />;
    case "notifications":
      return <NotificationsTab />;
  }
};

export default function SettingsLayout(): React.JSX.Element {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>("general");

  const tabs: TabDef[] = [
    {
      id: "general",
      label: t("settings.tabs.general", "Ogólne"),
      shortLabel: t("settings.tabs.general.short", "Ogólne"),
      icon: <User size={18} strokeWidth={1.5} />,
    },
    {
      id: "security",
      label: t("settings.tabs.security", "Bezpieczeństwo"),
      shortLabel: t("settings.tabs.security.short", "Hasło"),
      icon: <Shield size={18} strokeWidth={1.5} />,
    },
    {
      id: "logistics",
      label: t("settings.tabs.logistics", "Logistyka"),
      shortLabel: t("settings.tabs.logistics.short", "Logistyka"),
      icon: <Truck size={18} strokeWidth={1.5} />,
    },
    {
      id: "privacy",
      label: t("settings.tabs.privacy", "Prywatność"),
      shortLabel: t("settings.tabs.privacy.short", "Prywatność"),
      icon: <ShieldAlert size={18} strokeWidth={1.5} />,
    },
    {
      id: "integrations",
      label: t("settings.tabs.integrations", "Integracje"),
      shortLabel: t("settings.tabs.integrations.short", "Kalend."),
      icon: <Calendar size={18} strokeWidth={1.5} />,
    },
    {
      id: "notifications",
      label: t("settings.tabs.notifications", "Powiadomienia"),
      shortLabel: t("settings.tabs.notifications.short", "Alerty"),
      icon: <Bell size={18} strokeWidth={1.5} />,
    },
  ];

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10 space-y-8">
        <PageHeader
          roleText={t("settings.page.role", "PANEL UŻYTKOWNIKA")}
          title={t("settings.page.title", "Ustawienia")}
          titleHighlight={t("settings.page.highlight", "konta")}
          size="standard"
        />

        <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-8">
          {/* ── NAVIGATION ──────────────────────────────── */}
          <nav
            aria-label={t("settings.nav.aria", "Menu ustawień")}
            className="shrink-0 md:w-56"
          >
            {/* Mobile: horizontal scrollable pill rail */}
            <div className="md:hidden">
              <GlassCard variant="light" padding="sm" isHoverable={false}>
                <div className="flex overflow-x-auto no-scrollbar gap-0.5 pb-px">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "relative flex flex-col items-center gap-1 px-3.5 py-2.5 rounded-xl shrink-0",
                          "transition-colors duration-300 outline-none",
                          "focus-visible:ring-2 focus-visible:ring-ethereal-gold/50",
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="mobile-tab-bg"
                            className="absolute inset-0 rounded-xl bg-ethereal-gold/10"
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
                          {tab.icon}
                        </span>
                        <Text
                          size="xs"
                          weight={isActive ? "medium" : "normal"}
                          color={isActive ? "gold" : "muted"}
                          className="relative z-10 whitespace-nowrap"
                        >
                          {tab.shortLabel}
                        </Text>
                      </button>
                    );
                  })}
                </div>
              </GlassCard>
            </div>

            {/* Desktop: vertical sidebar list */}
            <div className="hidden md:block">
              <GlassCard variant="light" padding="sm" isHoverable={false}>
                <div className="flex flex-col gap-0.5">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "relative group flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left",
                          "transition-colors duration-300 outline-none",
                          "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/50",
                          !isActive && "hover:bg-white/20",
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="desktop-tab-bg"
                            className="absolute inset-0 rounded-xl bg-white/40 border border-ethereal-ink/5 shadow-glass-ethereal"
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
                          {tab.icon}
                        </span>
                        <Text
                          size="sm"
                          color={isActive ? "default" : "muted"}
                          className={cn(
                            "relative z-10 transition-colors duration-300",
                            !isActive && "group-hover:text-ethereal-ink",
                          )}
                        >
                          {tab.label}
                        </Text>
                      </button>
                    );
                  })}
                </div>
              </GlassCard>
            </div>
          </nav>

          {/* ── CONTENT ─────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: DURATION.fast, ease: EASE.buttery }}
              >
                {renderTab(activeTab)}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </PageTransition>
  );
}
