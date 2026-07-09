/**
 * @file LogisticsTab.tsx
 * @description "Logistyka sceniczna" pane: wardrobe measurements used by the
 * management when ordering concert attire. Catering/dietary fields were removed
 * (client + server) because allergy data is a GDPR art. 9 special category we
 * chose not to hold; catering is coordinated off-system.
 * @architecture Enterprise SaaS 2026
 * @module features/settings/components/LogisticsTab
 */

import { useTranslation } from "react-i18next";
import { Shirt, Ruler, Footprints } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { GlassCard } from "@ui/composites/GlassCard";
import { SectionHeader } from "@ui/composites/SectionHeader";
import { Input } from "@ui/primitives/Input";
import { Select } from "@ui/primitives/Select";
import { Text } from "@ui/primitives/typography";
import { EtherealLoader } from "@ui/kinematics/EtherealLoader";
import { DURATION, EASE } from "@ui/kinematics/motion-presets";
import { useLogisticsSettings } from "../hooks/useLogisticsSettings";
import { SettingsSaveFooter } from "./SettingsSaveFooter";

export const LogisticsTab = () => {
  const { t } = useTranslation();
  const {
    formData,
    isFetching,
    isPending,
    isDirty,
    status,
    handleChange,
    handleSubmit,
  } = useLogisticsSettings();

  if (isFetching) {
    return (
      <GlassCard
        variant="light"
        isHoverable={false}
        className="flex items-center justify-center py-20"
      >
        <EtherealLoader />
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="light" isHoverable={false}>
      <SectionHeader
        title={t("settings.logistics.title", "Logistyka sceniczna")}
        icon={<Shirt className="w-5 h-5" />}
      />
      <Text color="muted" className="mt-1 mb-6">
        {t(
          "settings.logistics.subtitle",
          "Dane wykorzystywane przez management do zamawiania strojów koncertowych.",
        )}
      </Text>

      <AnimatePresence>
        {status.type === "error" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.fast, ease: EASE.buttery }}
            className="mb-5 overflow-hidden"
          >
            <GlassCard variant="outline" padding="sm" isHoverable={false}>
              <Text size="sm" color="crimson">
                {status.message}
              </Text>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── Wymiary ───────────────────────────────────── */}
        <div className="space-y-5">
          <SectionHeader
            title={t(
              "settings.logistics.sections.measurements",
              "Wymiary i stroje",
            )}
            icon={<Ruler className="w-4 h-4" />}
            withFluidDivider
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Select
              label={t("settings.logistics.clothing_size", "Rozmiar ubrań")}
              value={formData.clothing_size}
              onChange={(e) => handleChange("clothing_size", e.target.value)}
            >
              <option value="">{t("common.actions.select", "Wybierz")}</option>
              <option value="xs">XS</option>
              <option value="s">S</option>
              <option value="m">M</option>
              <option value="l">L</option>
              <option value="xl">XL</option>
              <option value="xxl">XXL</option>
            </Select>

            <Input
              label={t("settings.logistics.shoe_size", "Rozmiar buta (EU)")}
              placeholder={t(
                "settings.logistics.shoe_size_placeholder",
                "Np. 42",
              )}
              value={formData.shoe_size}
              onChange={(e) => handleChange("shoe_size", e.target.value)}
              leftIcon={<Footprints className="w-4 h-4" />}
            />

            <Input
              type="number"
              label={t("settings.logistics.height", "Wzrost (cm)")}
              placeholder={t(
                "settings.logistics.height_placeholder",
                "Np. 175",
              )}
              value={formData.height_cm}
              onChange={(e) => handleChange("height_cm", e.target.value)}
              leftIcon={<Ruler className="w-4 h-4" />}
            />
          </div>
        </div>

        <SettingsSaveFooter
          isDirty={isDirty}
          isPending={isPending}
          showSuccess={status.type === "success"}
        />
      </form>
    </GlassCard>
  );
};
