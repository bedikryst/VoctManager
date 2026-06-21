/**
 * @file GeneralTab.tsx
 * @description "Profil" pane: personal data + contact, the (read-only) login
 * e-mail with a shortcut to the security pane where it can be changed, and
 * interface preferences (language, timezone). Voice type now lives in the
 * identity card at the layout level instead of an ad-hoc metric block here.
 * @architecture Enterprise SaaS 2026
 * @module features/settings/components/GeneralTab
 */

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  AtSign,
  Clock,
  Globe,
  Phone,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { GlassCard } from "@ui/composites/GlassCard";
import { SectionHeader } from "@ui/composites/SectionHeader";
import { Input } from "@ui/primitives/Input";
import { Select } from "@ui/primitives/Select";
import { Text, Caption } from "@ui/primitives/typography";
import { EtherealLoader } from "@ui/kinematics/EtherealLoader";
import { DURATION, EASE } from "@ui/kinematics/motion-presets";
import { useGeneralSettings } from "../hooks/useGeneralSettings";
import { SettingsSaveFooter } from "./SettingsSaveFooter";

const TIMEZONES = [
  { value: "UTC", label: "UTC (Uniwersalna)" },
  { value: "Europe/Warsaw", label: "Europe / Warsaw" },
  { value: "Europe/Berlin", label: "Europe / Berlin" },
  { value: "Europe/Paris", label: "Europe / Paris" },
  { value: "Europe/London", label: "Europe / London" },
  { value: "America/New_York", label: "America / New York" },
];

export const GeneralTab = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
        title={t("settings.general.title", "Profil")}
        icon={<User className="h-5 w-5" />}
      />
      <Text color="muted" className="mb-6 mt-1">
        {t(
          "settings.general.subtitle",
          "Twoje dane osobowe i preferencje aplikacji.",
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
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ethereal-crimson" />
                <Text size="sm" color="crimson">
                  {status.message}
                </Text>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Input
            label={t("settings.general.firstName", "Imię")}
            value={formData.first_name}
            onChange={(e) => handleChange("first_name", e.target.value)}
            leftIcon={<User className="h-4 w-4" />}
          />
          <Input
            label={t("settings.general.lastName", "Nazwisko")}
            value={formData.last_name}
            onChange={(e) => handleChange("last_name", e.target.value)}
            leftIcon={<User className="h-4 w-4" />}
          />
          <Input
            label={t("settings.general.phone", "Numer telefonu")}
            value={formData.profile.phone_number}
            onChange={(e) =>
              handleProfileChange("phone_number", e.target.value)
            }
            leftIcon={<Phone className="h-4 w-4" />}
          />
          <div className="flex flex-col gap-1.5">
            <Input
              label={t("settings.general.email_label", "Adres e-mail (login)")}
              value={user?.email ?? ""}
              readOnly
              leftIcon={<AtSign className="h-4 w-4" />}
              className="text-ethereal-graphite/80"
            />
            <button
              type="button"
              onClick={() => navigate("/panel/settings/security")}
              className="group ml-1 inline-flex items-center gap-1 self-start outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
            >
              <Caption
                color="muted"
                className="transition-colors group-hover:text-ethereal-gold"
              >
                {t(
                  "settings.general.email_cta",
                  "Zmień adres w sekcji Bezpieczeństwo",
                )}
              </Caption>
              <ArrowRight
                size={11}
                className="text-ethereal-graphite/50 transition-colors group-hover:text-ethereal-gold"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        <div className="pt-2">
          <SectionHeader
            title={t("settings.general.preferencesTitle", "Preferencje")}
            icon={<Globe className="h-4 w-4" />}
            withFluidDivider
          />
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Select
              label={t("settings.general.language", "Język interfejsu")}
              leftIcon={<Globe className="h-4 w-4" />}
              value={formData.profile.language}
              onChange={(e) => handleProfileChange("language", e.target.value)}
            >
              <option value="pl">Polski</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </Select>

            <Select
              label={t("settings.general.timezone", "Strefa czasowa")}
              leftIcon={<Clock className="h-4 w-4" />}
              value={formData.profile.timezone}
              onChange={(e) => handleProfileChange("timezone", e.target.value)}
            >
              {TIMEZONES.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </Select>

            <div>
              <Select
                label={t("common.salutation.label", "Forma zwrotu")}
                value={formData.profile.salutation}
                onChange={(e) => handleProfileChange("salutation", e.target.value)}
              >
                <option value="N">{t("common.salutation.neutral", "Neutralna")}</option>
                <option value="F">{t("common.salutation.feminine", "Kobieca")}</option>
                <option value="M">{t("common.salutation.masculine", "Męska")}</option>
              </Select>
              <Text as="p" size="xs" color="muted" className="ml-1 mt-1.5">
                {t(
                  "common.salutation.settings_hint",
                  "Używana tylko w powitaniach w e-mailach i powiadomieniach.",
                )}
              </Text>
            </div>
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
