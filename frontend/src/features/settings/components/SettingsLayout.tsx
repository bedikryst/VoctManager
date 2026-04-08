/**
 * @file SettingsLayout.tsx
 * @description Main container for user settings, utilizing vertical tabs for navigation.
 * @module features/settings/components
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { User, Shield, Truck, ShieldAlert, Calendar } from "lucide-react";

import { GlassCard } from "../../../shared/ui/GlassCard";
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
  | "integrations";

export default function SettingsLayout() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>("general");

  const tabs = [
    {
      id: "general",
      label: t("settings.tabs.general", "Ogólne"),
      icon: <User className="w-4 h-4" />,
    },
    {
      id: "security",
      label: t("settings.tabs.security", "Bezpieczeństwo"),
      icon: <Shield className="w-4 h-4" />,
    },
    {
      id: "logistics",
      label: t("settings.tabs.logistics", "Logistyka"),
      icon: <Truck className="w-4 h-4" />,
    },
    {
      id: "privacy",
      label: t("settings.tabs.privacy", "Prywatność"),
      icon: <ShieldAlert className="w-4 h-4" />,
    },
    {
      id: "integrations",
      label: t("settings.tabs.integrations", "Integracje"),
      icon: <Calendar className="w-4 h-4" />,
    },
  ] as const;

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 shrink-0">
          <GlassCard noPadding className="p-4">
            <nav className="flex flex-col space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-bold antialiased ${
                    activeTab === tab.id
                      ? "bg-[#002395] text-white shadow-md"
                      : "text-stone-600 hover:bg-white/50 hover:text-[#002395]"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </GlassCard>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "general" && <GeneralTab />}
              {activeTab === "security" && <SecurityTab />}
              {activeTab === "logistics" && <LogisticsTab />}
              {activeTab === "privacy" && <PrivacyTab />}
              {activeTab === "integrations" && <IntegrationsTab />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
