/**
 * @file GeneralTab.tsx
 * @description "Profil" pane: personal data + contact, the (read-only) login
 * e-mail with a shortcut to the security pane where it can be changed, the
 * singer's own vocal range (a row that exists only under its rollout flag),
 * and interface preferences (language, the pitch notation a manager reads
 * vocal ranges in, timezone, salutation). Voice type lives in the identity card
 * at the layout level.
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
  Music,
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
import type { PitchNotationPreference } from "@/shared/lib/music/pitchNotation";
import { VocalRangeSettingsRow } from "@/features/vocal-range/components/VocalRangeSettingsRow";
import { useGeneralSettings } from "../hooks/useGeneralSettings";
import { SettingsSaveFooter } from "./SettingsSaveFooter";

/** Each language names itself — the one label set i18n must never touch. */
const LANGUAGE_OPTIONS = [
  { value: "pl", label: "Polski" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
];

/**
 * "Follow the language" is stored as "", which a select item may not carry
 * (Radix reserves it for "nothing selected"). It rides this value in the field
 * and turns back into "" on its way into the form.
 */
const FOLLOW_LANGUAGE = "language";

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

  const salutationOptions = [
    { value: "N", label: t("common.salutation.neutral", "Neutralna") },
    { value: "F", label: t("common.salutation.feminine", "Kobieca") },
    { value: "M", label: t("common.salutation.masculine", "Męska") },
  ];
  // The Polish notation is the German one too (h, b, cis, a¹), so its label
  // names both: a German reader has no other way to find it.
  const notationOptions: readonly {
    value: string;
    label: string;
    stored: PitchNotationPreference;
  }[] = [
    {
      value: FOLLOW_LANGUAGE,
      stored: "",
      label: t("settings.general.pitch_notation.follow_language", "Według języka"),
    },
    {
      value: "polish",
      stored: "polish",
      label: t("settings.general.pitch_notation.polish", "Polski i niemiecki (a¹)"),
    },
    {
      value: "international",
      stored: "international",
      label: t("settings.general.pitch_notation.international", "Międzynarodowy (A4)"),
    },
    {
      value: "french",
      stored: "french",
      label: t("settings.general.pitch_notation.french", "Francuski (la3)"),
    },
  ];
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

        <VocalRangeSettingsRow />

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
              onValueChange={(value) => handleProfileChange("language", value)}
              options={LANGUAGE_OPTIONS}
            />

            {/* Managers only: they read every singer's range across the
                panel. A chorister sees their own range only on the singer's
                screen, which also names each note in all three notations. */}
            {user?.profile?.is_manager && (
              <div>
                <Select
                  label={t("settings.general.pitch_notation.label", "Zapis wysokości dźwięków")}
                  leftIcon={<Music className="h-4 w-4" />}
                  value={formData.profile.pitch_notation || FOLLOW_LANGUAGE}
                  onValueChange={(value) => {
                    const option = notationOptions.find((each) => each.value === value);
                    if (option) handleProfileChange("pitch_notation", option.stored);
                  }}
                  options={notationOptions}
                />
                <Text as="p" size="xs" color="muted" className="ml-1 mt-1.5">
                  {t(
                    "settings.general.pitch_notation.hint",
                    "W tym zapisie zobaczysz skale głosu w całym panelu.",
                  )}
                </Text>
              </div>
            )}

            <Select
              label={t("settings.general.timezone", "Strefa czasowa")}
              leftIcon={<Clock className="h-4 w-4" />}
              value={formData.profile.timezone}
              onValueChange={(value) => handleProfileChange("timezone", value)}
              options={TIMEZONES}
            />

            <div>
              <Select
                label={t("common.salutation.label", "Forma zwrotu")}
                value={formData.profile.salutation}
                onValueChange={(value) => handleProfileChange("salutation", value)}
                options={salutationOptions}
              />
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
