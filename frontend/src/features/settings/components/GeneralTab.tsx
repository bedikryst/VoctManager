/**
 * @file GeneralTab.tsx
 * @description View component for updating basic user information and UI preferences.
 * Fully relies on useGeneralSettings hook for state management (Separation of Concerns).
 * @module features/settings/components
 */

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

import { GlassCard } from "@ui/composites/GlassCard";
import { Input } from "@ui/primitives/Input";
import { Button } from "@ui/primitives/Button";
import { useGeneralSettings } from "../hooks/useGeneralSettings";

export default function GeneralTab() {
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
      <GlassCard className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4 text-stone-400">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest">
            {t("common.state.loading", "Wczytywanie...")}
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-stone-900">
          {t("settings.general.title", "Ustawienia Ogólne")}
        </h2>
        <p className="text-sm text-stone-500">
          {t(
            "settings.general.subtitle",
            "Zarządzaj swoimi danymi i preferencjami aplikacji.",
          )}
        </p>
      </div>

      {status.type === "error" && (
        <div className="mb-6 p-4 bg-red-50/50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">{status.message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-1">
              {t("settings.general.firstName", "Imię")}
            </label>
            <Input
              value={formData.first_name}
              onChange={(e) => handleChange("first_name", e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
            />
          </div>

          {/* Last Name */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-1">
              {t("settings.general.lastName", "Nazwisko")}
            </label>
            <Input
              value={formData.last_name}
              onChange={(e) => handleChange("last_name", e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
            />
          </div>

          {/* Phone Number */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-1">
              {t("settings.general.phone", "Numer telefonu")}
            </label>
            <Input
              value={formData.profile.phone_number}
              onChange={(e) =>
                handleProfileChange("phone_number", e.target.value)
              }
              leftIcon={<Phone className="w-4 h-4" />}
            />
          </div>
        </div>
        {user?.voice_type && (
          <div className="bg-stone-50/50 p-4 rounded-2xl border border-stone-200/40">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-2 pl-1">
              {t("settings.membership.title", "Profil Artysty")}
            </label>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                <Mic2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase tracking-tight">
                  {t("settings.membership.voice", "Twój Głos")}
                </p>
                <p className="text-sm font-black text-brand antialiased">
                  {user.voice_type_display}
                </p>
              </div>
            </div>
          </div>
        )}
        {/* Preferences Section */}
        <div className="border-t border-stone-200/60 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Language Select */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-1">
              {t("settings.general.language", "Język Interfejsu")}
            </label>
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <select
                className="w-full text-sm font-medium text-stone-800 rounded-xl py-2.5 pl-11 pr-4 bg-white/50 backdrop-blur-sm border border-stone-200/60 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition-all appearance-none cursor-pointer"
                value={formData.profile.language}
                onChange={(e) =>
                  handleProfileChange("language", e.target.value)
                }
              >
                <option value="pl">Polski</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
              </select>
            </div>
          </div>

          {/* Timezone Select */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-1">
              {t("settings.general.timezone", "Strefa Czasowa")}
            </label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <select
                className="w-full text-sm font-medium text-stone-800 rounded-xl py-2.5 pl-11 pr-4 bg-white/50 backdrop-blur-sm border border-stone-200/60 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition-all appearance-none cursor-pointer"
                value={formData.profile.timezone}
                onChange={(e) =>
                  handleProfileChange("timezone", e.target.value)
                }
              >
                <option value="UTC">UTC (Uniwersalna)</option>
                <option value="Europe/Warsaw">Europe / Warsaw</option>
                <option value="Europe/London">Europe / London</option>
                <option value="America/New_York">America / New York</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-4 flex items-center justify-end gap-4">
          {status.type === "success" && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 uppercase tracking-wider animate-in fade-in slide-in-from-right-4 duration-300">
              <CheckCircle2 className="w-4 h-4" />
              {t("common.state.saved", "Zapisano")}
            </span>
          )}

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
}
