/**
 * @file SettingsLayout.tsx
 * @description Main container for user settings, utilizing vertical tabs for navigation.
 * Upgraded to Ethereal UI 2026: Strict Primitives, Composites, and Kinematic Presets.
 * @architecture Enterprise SaaS 2026
 * @module features/settings/components
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { User, Shield, Truck, ShieldAlert, Calendar, Bell } from "lucide-react";
import { NotificationsTab } from "@/features/notifications/components/NotificationsTab";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Text } from "@/shared/ui/primitives/typography";
import { DURATION, EASE } from "@/shared/ui/kinematics/motion-presets";
import { cn } from "@/shared/lib/utils";

import GeneralTab from "./GeneralTab";
import SecurityTab from "./SecurityTab";
import LogisticsTab from "./LogisticsTab";
import PrivacyTab from "./PrivacyTab";
import IntegrationsTab from "./IntegrationsTab";

type TabType =
  | "general"
  | "security"
  | "logistics"
  | "privacy"
  | "integrations"
  | "notifications";

export default function SettingsLayout(): React.JSX.Element {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>("general");

  const tabs = [
    {
      id: "general",
      label: t("settings.tabs.general", "Ogólne"),
      icon: <User size={18} strokeWidth={1.5} />,
    },
    {
      id: "security",
      label: t("settings.tabs.security", "Bezpieczeństwo"),
      icon: <Shield size={18} strokeWidth={1.5} />,
    },
    {
      id: "logistics",
      label: t("settings.tabs.logistics", "Logistyka"),
      icon: <Truck size={18} strokeWidth={1.5} />,
    },
    {
      id: "privacy",
      label: t("settings.tabs.privacy", "Prywatność"),
      icon: <ShieldAlert size={18} strokeWidth={1.5} />,
    },
    {
      id: "integrations",
      label: t("settings.tabs.integrations", "Integracje"),
      icon: <Calendar size={18} strokeWidth={1.5} />,
    },
    {
      id: "notifications",
      label: t("settings.tabs.notifications", "Powiadomienia"),
      icon: <Bell size={18} strokeWidth={1.5} />,
    },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-col gap-8 md:flex-row">
        {/* SIDEBAR NAVIGATION STRATUM */}
        <aside className="w-full shrink-0 md:w-64">
          {/* Poprawiony prop padding="sm" */}
          <GlassCard variant="light" padding="sm">
            <nav
              className="flex flex-col space-y-1"
              aria-label={t("settings.nav.aria", "Menu ustawień")}
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-500 ease-out outline-none",
                      "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/50",
                      isActive
                        ? "bg-white/40 shadow-[0_4px_20px_-4px_rgba(22,20,18,0.05)] border border-ethereal-ink/5"
                        : "bg-transparent hover:bg-white/20 border border-transparent",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {/* Ikona dostosowująca kolor do stanu */}
                    <span
                      className={cn(
                        "transition-colors duration-500",
                        isActive
                          ? "text-ethereal-gold"
                          : "text-ethereal-graphite/50 group-hover:text-ethereal-ink/70",
                      )}
                      aria-hidden="true"
                    >
                      {tab.icon}
                    </span>

                    {/* Semantyczna, scentralizowana typografia */}
                    <Text
                      color={isActive ? "default" : "muted"}
                      className={cn(
                        "transition-colors duration-500",
                        !isActive && "group-hover:text-ethereal-ink",
                      )}
                    >
                      {tab.label}
                    </Text>
                  </button>
                );
              })}
            </nav>
          </GlassCard>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1">
          {/* Używamy naszych scentralizowanych krzywych przejść (EASE.buttery) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{
                duration: DURATION.fast,
                ease: EASE.buttery,
              }}
              className="h-full w-full"
            >
              {activeTab === "general" && <GeneralTab />}
              {activeTab === "security" && <SecurityTab />}
              {activeTab === "logistics" && <LogisticsTab />}
              {activeTab === "privacy" && <PrivacyTab />}
              {activeTab === "integrations" && <IntegrationsTab />}
              {activeTab === "notifications" && <NotificationsTab />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
