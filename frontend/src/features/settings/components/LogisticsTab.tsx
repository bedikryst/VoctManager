import { useTranslation } from "react-i18next";
import { Shirt, Utensils, Ruler, CheckCircle2, Footprints } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { GlassCard } from "@ui/composites/GlassCard";
import { SectionHeader } from "@ui/composites/SectionHeader";
import { Input } from "@ui/primitives/Input";
import { Select } from "@ui/primitives/Select";
import { Textarea } from "@ui/primitives/Textarea";
import { Button } from "@ui/primitives/Button";
import { Text, Caption } from "@ui/primitives/typography";
import { EtherealLoader } from "@ui/kinematics/EtherealLoader";
import { DURATION, EASE } from "@ui/kinematics/motion-presets";
import { useLogisticsSettings } from "../hooks/useLogisticsSettings";

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
        title={t("settings.logistics.title", "Logistyka")}
        icon={<Shirt className="w-5 h-5" />}
      />
      <Text color="muted" className="mt-1 mb-6">
        {t(
          "settings.logistics.subtitle",
          "Dane wykorzystywane przez management do zamawiania strojów.",
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
        {/* ── Catering ─────────────────────────────────── deleted temporary, will be reintroduced in future iterations ── 
        <div className="space-y-5">
          <SectionHeader
            title={t("settings.logistics.sections.catering", "Catering")}
            icon={<Utensils className="w-4 h-4" />}
            withFluidDivider
          />
          <Select
            label={t(
              "settings.logistics.dietary_preference",
              "Preferencja żywieniowa",
            )}
            value={formData.dietary_preference}
            onChange={(e) => handleChange("dietary_preference", e.target.value)}
          >
            <option value="none">
              {t("settings.logistics.dietary_options.none", "Brak wymagań")}
            </option>
            <option value="vege">
              {t("settings.logistics.dietary_options.vege", "Wegetariańska")}
            </option>
            <option value="vegan">
              {t("settings.logistics.dietary_options.vegan", "Wegańska")}
            </option>
            <option value="gf">
              {t("settings.logistics.dietary_options.gf", "Bez glutenu")}
            </option>
            <option value="lf">
              {t("settings.logistics.dietary_options.lf", "Bez laktozy")}
            </option>
          </Select>

          <Textarea
            label={t(
              "settings.logistics.dietary_notes",
              "Uwagi / alergie (opcjonalnie)",
            )}
            placeholder={t(
              "settings.logistics.dietary_notes_placeholder",
              "Np. uczulenie na orzechy, brak owoców morza...",
            )}
            value={formData.dietary_notes}
            onChange={(e) => handleChange("dietary_notes", e.target.value)}
          />
        </div>
*/}
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

        <div className="pt-2 flex items-center justify-end gap-4">
          <AnimatePresence>
            {status.type === "success" && (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: DURATION.fast, ease: EASE.buttery }}
                className="flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-ethereal-sage shrink-0" />
                <Caption color="sage">
                  {t("common.state.saved", "Zapisano pomyślnie")}
                </Caption>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            type="submit"
            isLoading={isPending}
            disabled={!isDirty}
            className={!isDirty ? "opacity-50 grayscale" : ""}
          >
            {t("common.actions.save", "Zapisz zmiany")}
          </Button>
        </div>
      </form>
    </GlassCard>
  );
};
