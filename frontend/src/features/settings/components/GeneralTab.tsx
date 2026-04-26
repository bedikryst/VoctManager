import { useTranslation } from "react-i18next";
import {
  User,
  Phone,
  Globe,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Mic2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { GlassCard } from "@ui/composites/GlassCard";
import { SectionHeader } from "@ui/composites/SectionHeader";
import { MetricBlock } from "@ui/composites/MetricBlock";
import { Input } from "@ui/primitives/Input";
import { Select } from "@ui/primitives/Select";
import { Button } from "@ui/primitives/Button";
import { Text, Caption } from "@ui/primitives/typography";
import { EtherealLoader } from "@ui/kinematics/EtherealLoader";
import { DURATION, EASE } from "@ui/kinematics/motion-presets";
import { useGeneralSettings } from "../hooks/useGeneralSettings";

export const GeneralTab = () => {
  const { t } = useTranslation();
  const {
    formData,
    user,
    isFetching,
    isPending,
    isDirty,
    status,
    handleChange,
    handleProfileChange,
    handleSubmit,
  } = useGeneralSettings();

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
        title={t("settings.general.title", "Ustawienia Ogólne")}
        icon={<User className="w-5 h-5" />}
      />
      <Text color="muted" className="mt-1 mb-6">
        {t(
          "settings.general.subtitle",
          "Zarządzaj swoimi danymi i preferencjami aplikacji.",
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
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-ethereal-crimson shrink-0 mt-0.5" />
                <Text size="sm" color="crimson">
                  {status.message}
                </Text>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input
            label={t("settings.general.firstName", "Imię")}
            value={formData.first_name}
            onChange={(e) => handleChange("first_name", e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
          />
          <Input
            label={t("settings.general.lastName", "Nazwisko")}
            value={formData.last_name}
            onChange={(e) => handleChange("last_name", e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
          />
          <Input
            label={t("settings.general.phone", "Numer telefonu")}
            value={formData.profile.phone_number}
            onChange={(e) =>
              handleProfileChange("phone_number", e.target.value)
            }
            leftIcon={<Phone className="w-4 h-4" />}
          />
          {user?.voice_type && (
            <MetricBlock
              label={t("settings.membership.voice", "Twój Głos w Chórze")}
              value={
                t(`dashboard.layout.roles.${user.voice_type}`) ||
                user.voice_type_display
              }
              icon={<Mic2 className="w-5 h-5" />}
              accentColor="gold"
              className="scale-80 md:-left-3"
            />
          )}
        </div>

        <div className="pt-2">
          <SectionHeader
            title={t("settings.general.preferencesTitle", "Preferencje")}
            icon={<Globe className="w-4 h-4" />}
            withFluidDivider
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            <Select
              label={t("settings.general.language", "Język Interfejsu")}
              leftIcon={<Globe className="w-4 h-4" />}
              value={formData.profile.language}
              onChange={(e) => handleProfileChange("language", e.target.value)}
            >
              <option value="pl">Polski</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </Select>

            <Select
              label={t("settings.general.timezone", "Strefa Czasowa")}
              leftIcon={<Clock className="w-4 h-4" />}
              value={formData.profile.timezone}
              onChange={(e) => handleProfileChange("timezone", e.target.value)}
            >
              <option value="UTC">UTC (Uniwersalna)</option>
              <option value="Europe/Warsaw">Europe / Warsaw</option>
              <option value="Europe/London">Europe / London</option>
              <option value="America/New_York">America / New York</option>
            </Select>
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
            {t("common.actions.save", "Zapisz Zmiany")}
          </Button>
        </div>
      </form>
    </GlassCard>
  );
};
