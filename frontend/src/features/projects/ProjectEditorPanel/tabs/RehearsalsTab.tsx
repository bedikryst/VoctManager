/**
 * @file RehearsalsTab.tsx
 * @description Orchestrates rehearsal scheduling and targeted participation selection.
 * Uses typed location relations and shared primitives for the project editor workspace.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/tabs/RehearsalsTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar1,
  CheckSquare,
  Clock,
  Edit2,
  MapPin,
  MicVocal,
  Target,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

import { useRehearsalsTab, type TargetType } from "../hooks/useRehearsalsTab";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { getAvailableTimezones } from "@/shared/lib/time/timezone";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { getLocationLabel, isPastProjectDate } from "../../lib/projectPresentation";

interface RehearsalsTabProps {
  projectId: string;
}

const STYLE_LABEL =
  "mb-2 ml-1 block text-[9px] font-bold uppercase tracking-widest text-ethereal-graphite/75";
const STYLE_GLASS_TEXTAREA =
  "w-full resize-none rounded-xl border border-ethereal-incense/20 bg-white/60 px-4 py-3 text-sm text-ethereal-ink shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-all focus:border-ethereal-gold/40 focus:outline-none focus:ring-2 focus:ring-ethereal-gold/20";

export const RehearsalsTab = ({
  projectId,
}: RehearsalsTabProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const timezones = getAvailableTimezones();

  const {
    isLoading,
    isSubmitting,
    isEditing,
    rehearsalToDelete,
    setRehearsalToDelete,
    isDeleting,
    formData,
    setFormData,
    targetType,
    setTargetType,
    selectedSections,
    customParticipants,
    projectRehearsals,
    projectParticipations,
    artistMap,
    locations,
    handleSubmit,
    handleEditClick,
    handleCancelEdit,
    handleDeleteClick,
    executeDelete,
    toggleSection,
    toggleCustomParticipant,
  } = useRehearsalsTab(projectId);

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <form onSubmit={handleSubmit}>
        <GlassCard className="flex flex-col gap-6 p-6 md:p-8" isHoverable={false}>
          <div className="flex items-center gap-2.5 border-b border-ethereal-incense/10 pb-3">
            <Clock
              size={16}
              className={isEditing ? "text-ethereal-crimson" : "text-ethereal-gold"}
              aria-hidden="true"
            />
            <div className="text-[10px] font-bold uppercase tracking-widest text-ethereal-ink">
              {isEditing
                ? t("projects.rehearsals.form.title_edit", "Edytuj próbę")
                : t("projects.rehearsals.form.title", "Zaplanuj nową próbę")}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="w-full md:col-span-1">
              <label className={STYLE_LABEL}>
                {t("projects.rehearsals.form.date_time", "Data i godzina *")}
              </label>
              <Input
                type="datetime-local"
                required
                value={formData.date_time}
                onChange={(event) =>
                  setFormData({ ...formData, date_time: event.target.value })
                }
                disabled={isSubmitting}
              />
            </div>

            <div className="w-full md:col-span-1">
              <label className={STYLE_LABEL}>
                {t("projects.rehearsals.form.timezone", "Strefa czasowa *")}
              </label>
              <select
                required
                value={formData.timezone}
                onChange={(event) =>
                  setFormData({ ...formData, timezone: event.target.value })
                }
                disabled={isSubmitting}
                className="w-full rounded-xl border border-ethereal-incense/20 bg-white px-3 py-[9px] text-sm text-ethereal-ink shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-all focus:border-ethereal-gold/40 focus:outline-none focus:ring-2 focus:ring-ethereal-gold/20"
              >
                {timezones.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full md:col-span-1">
              <label className={STYLE_LABEL}>
                {t("projects.rehearsals.form.location", "Lokalizacja *")}
              </label>
              <select
                required
                value={formData.location_id}
                onChange={(event) => {
                  const nextLocationId = event.target.value;
                  const selectedLocation =
                    locations.find(
                      (location) => String(location.id) === nextLocationId,
                    ) ?? null;

                  setFormData({
                    ...formData,
                    location_id: nextLocationId,
                    timezone: selectedLocation?.timezone ?? formData.timezone,
                  });
                }}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-ethereal-incense/20 bg-white px-3 py-[9px] text-sm text-ethereal-ink shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-all focus:border-ethereal-gold/40 focus:outline-none focus:ring-2 focus:ring-ethereal-gold/20"
              >
                <option value="">
                  {t(
                    "projects.rehearsals.form.location_placeholder",
                    "Wybierz lokalizację",
                  )}
                </option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="w-full">
            <label className={STYLE_LABEL}>
              {t(
                "projects.rehearsals.form.focus",
                "Plan próby / repertuar (Focus)",
              )}
            </label>
            <textarea
              rows={2}
              value={formData.focus}
              placeholder={t(
                "projects.rehearsals.form.focus_placeholder",
                "np. Requiem cz. 1-3",
              )}
              onChange={(event) =>
                setFormData({ ...formData, focus: event.target.value })
              }
              className={STYLE_GLASS_TEXTAREA}
              disabled={isSubmitting}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-ethereal-incense/20 bg-white/60 p-5 shadow-sm">
            <label className="mb-4 ml-1 block text-[10px] font-bold uppercase tracking-widest text-ethereal-ink">
              {t("projects.rehearsals.form.who", "Kto jest wezwany na próbę?")}
            </label>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              {[
                {
                  id: "TUTTI",
                  label: t("projects.rehearsals.form.type_tutti", "Tutti"),
                  icon: <Users size={14} aria-hidden="true" />,
                },
                {
                  id: "SECTIONAL",
                  label: t(
                    "projects.rehearsals.form.type_sectional",
                    "Próba sekcyjna",
                  ),
                  icon: <MicVocal size={14} aria-hidden="true" />,
                },
                {
                  id: "CUSTOM",
                  label: t(
                    "projects.rehearsals.form.type_custom",
                    "Wybrane osoby",
                  ),
                  icon: <UserCheck size={14} aria-hidden="true" />,
                },
              ].map((type) => (
                <Button
                  key={type.id}
                  type="button"
                  variant={targetType === type.id ? "primary" : "secondary"}
                  onClick={() => setTargetType(type.id as TargetType)}
                  className="flex-1"
                  leftIcon={type.icon}
                >
                  {type.label}
                </Button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {targetType === "SECTIONAL" && (
                <motion.div
                  key="sectional"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex flex-wrap gap-2 overflow-hidden border-t border-ethereal-incense/10 pt-4"
                >
                  {[
                    {
                      id: "S",
                      label: t("projects.rehearsals.voices.sopranos", "Soprany"),
                    },
                    {
                      id: "A",
                      label: t("projects.rehearsals.voices.altos", "Alty"),
                    },
                    {
                      id: "T",
                      label: t("projects.rehearsals.voices.tenors", "Tenory"),
                    },
                    {
                      id: "B",
                      label: t("projects.rehearsals.voices.basses", "Basy"),
                    },
                  ].map((section) => (
                    <Button
                      key={section.id}
                      type="button"
                      variant={
                        selectedSections.includes(section.id)
                          ? "primary"
                          : "secondary"
                      }
                      onClick={() => toggleSection(section.id)}
                    >
                      {section.label}
                    </Button>
                  ))}
                </motion.div>
              )}

              {targetType === "CUSTOM" && (
                <motion.div
                  key="custom"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="grid max-h-[200px] grid-cols-1 gap-2.5 overflow-y-auto border-t border-ethereal-incense/10 pt-4 sm:grid-cols-2 md:grid-cols-3 no-scrollbar"
                >
                  {projectParticipations.map((participation) => {
                    const artist = artistMap.get(String(participation.artist));
                    if (!artist) {
                      return null;
                    }

                    const isSelected = customParticipants.includes(
                      String(participation.id),
                    );

                    return (
                      <button
                        key={participation.id}
                        type="button"
                        onClick={() =>
                          toggleCustomParticipant(String(participation.id))
                        }
                        className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-left text-xs transition-all active:scale-95 ${
                          isSelected
                            ? "border-ethereal-gold/35 bg-ethereal-gold/10 text-ethereal-ink shadow-sm"
                            : "border-ethereal-incense/20 bg-white/60 text-ethereal-graphite hover:bg-white"
                        }`}
                      >
                        <span className="truncate font-bold tracking-tight">
                          {artist.first_name} {artist.last_name}
                        </span>
                        <span className="ml-2 text-[8px] font-bold uppercase tracking-widest opacity-60">
                          {artist.voice_type_display || artist.voice_type || ""}
                        </span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col items-start justify-between gap-5 pt-3 md:flex-row md:items-center">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/50">
              <input
                type="checkbox"
                checked={formData.is_mandatory}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    is_mandatory: event.target.checked,
                  })
                }
                className="h-4 w-4 cursor-pointer rounded-md border-ethereal-incense/40 text-ethereal-gold focus:ring-ethereal-gold"
                disabled={isSubmitting}
              />
              <span className="text-[10px] font-bold uppercase tracking-widest text-ethereal-ink">
                {t(
                  "projects.rehearsals.form.mandatory",
                  "Obecność obowiązkowa dla wezwanych",
                )}
              </span>
            </label>

            <div className="flex w-full gap-2 md:w-auto">
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                  className="w-full md:w-auto"
                >
                  {t("common.actions.cancel", "Anuluj")}
                </Button>
              )}
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                className="w-full md:w-auto"
              >
                {isEditing
                  ? t("projects.rehearsals.form.update", "Aktualizuj próbę")
                  : t("projects.rehearsals.form.submit", "Zapisz w kalendarzu")}
              </Button>
            </div>
          </div>
        </GlassCard>
      </form>

      <div className="space-y-4">
        <div className="mb-5 ml-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-ethereal-ink">
          <CheckSquare size={16} className="text-ethereal-gold" aria-hidden="true" />
          {t("projects.rehearsals.list.title", "Harmonogram prób")}
        </div>

        {isLoading ? (
          <EtherealLoader className="h-48" />
        ) : projectRehearsals.length > 0 ? (
          projectRehearsals.map((rehearsal) => {
            const isPast = isPastProjectDate(rehearsal.date_time);
            const invitedCount = rehearsal.invited_participations?.length || 0;
            const isTutti =
              invitedCount === 0 ||
              invitedCount === projectParticipations.length;
            const locationLabel = getLocationLabel(rehearsal.location);

            return (
              <GlassCard
                key={rehearsal.id}
                variant="light"
                padding="md"
                isHoverable={false}
                className={isPast ? "opacity-75" : ""}
              >
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                  <div className="flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
                        <div
                          className={`flex w-fit items-center gap-1.5 rounded-lg border px-3 py-1.5 font-bold tracking-tight shadow-sm ${
                            isPast
                              ? "border-ethereal-incense/20 bg-white/50 text-ethereal-graphite"
                              : "border-ethereal-gold/20 bg-ethereal-gold/10 text-ethereal-ink"
                          }`}
                        >
                          <Calendar1 size={14} aria-hidden="true" />
                          {formatLocalizedDate(
                            rehearsal.date_time,
                            { day: "numeric", month: "short" },
                            undefined,
                            rehearsal.timezone,
                          )}
                        </div>

                        <DualTimeDisplay
                          value={rehearsal.date_time}
                          timeZone={rehearsal.timezone}
                          icon={<Clock size={14} aria-hidden="true" />}
                          containerClassName={`rounded-lg border px-3 py-1.5 shadow-sm ${
                            isPast
                              ? "border-ethereal-incense/20 bg-white/50 text-ethereal-graphite"
                              : "border-ethereal-gold/20 bg-ethereal-gold/10 text-ethereal-ink"
                          }`}
                          primaryTimeClassName="flex items-center gap-1.5 text-sm font-semibold"
                          localTimeClassName="ml-1 border-l border-current pl-1.5 text-[10px] font-medium normal-case tracking-normal opacity-70"
                        />
                      </div>

                      {isPast && (
                        <div className="rounded-md bg-ethereal-parchment px-2.5 py-1 text-stone-600">
                          <span className="text-[8px] font-bold uppercase tracking-widest">
                            {t("projects.rehearsals.status.finished", "Zakończona")}
                          </span>
                        </div>
                      )}

                      <div
                        className={`rounded-md px-2.5 py-1 shadow-sm ${
                          isTutti
                            ? "bg-ethereal-sage/15 text-ethereal-sage"
                            : "bg-ethereal-amethyst/10 text-ethereal-amethyst"
                        }`}
                      >
                        <span className="text-[8px] font-bold uppercase tracking-widest">
                          {isTutti
                            ? t("projects.rehearsals.status.tutti", "TUTTI")
                            : t(
                                "projects.rehearsals.status.invited",
                                "Wezwanych: {{count}}",
                                { count: invitedCount },
                              )}
                        </span>
                      </div>

                      {!rehearsal.is_mandatory && (
                        <div className="rounded-md border border-ethereal-crimson/20 bg-ethereal-crimson-light/20 px-2.5 py-1 text-ethereal-crimson shadow-sm">
                          <span className="text-[8px] font-bold uppercase tracking-widest">
                            {t("projects.rehearsals.status.optional", "Opcjonalna")}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-ethereal-ink">
                        <MapPin
                          size={14}
                          className="text-ethereal-incense/60"
                          aria-hidden="true"
                        />
                        {rehearsal.location ? (
                          <LocationPreview
                            locationRef={rehearsal.location}
                            variant="minimal"
                            fallback={locationLabel || undefined}
                          />
                        ) : (
                          <span>{t("common.labels.not_available", "Brak danych")}</span>
                        )}
                      </div>
                      {rehearsal.focus && (
                        <div className="flex items-start gap-2 text-xs text-ethereal-graphite">
                          <Target
                            size={14}
                            className="mt-0.5 flex-shrink-0 text-ethereal-gold"
                            aria-hidden="true"
                          />
                          <span className="italic opacity-90">{rehearsal.focus}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-1 border-t border-ethereal-incense/10 pt-4 md:mt-0 md:ml-4 md:border-t-0 md:pt-0">
                    <Button
                      type="button"
                      variant="icon"
                      size="icon"
                      onClick={() => handleEditClick(rehearsal)}
                      title={t("projects.rehearsals.actions.edit", "Edytuj próbę")}
                    >
                      <Edit2 size={16} aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="icon"
                      size="icon"
                      onClick={() => handleDeleteClick(rehearsal.id)}
                      title={t("projects.rehearsals.actions.delete", "Usuń próbę")}
                      className="text-ethereal-crimson hover:bg-ethereal-crimson-light/20 hover:text-ethereal-crimson"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </GlassCard>
            );
          })
        ) : (
          <GlassCard
            className="flex flex-col items-center p-10 text-center"
            isHoverable={false}
          >
            <Calendar1 size={32} className="mb-3 opacity-30" aria-hidden="true" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-ethereal-graphite">
              {t("projects.rehearsals.empty.no_rehearsals", "Brak zaplanowanych prób")}
            </div>
          </GlassCard>
        )}
      </div>

      <ConfirmModal
        isOpen={rehearsalToDelete !== null}
        title={t("projects.rehearsals.modal.delete_title", "Usunąć tę próbę?")}
        description={t(
          "projects.rehearsals.modal.delete_desc",
          "Powiązane z tą próbą listy obecności zostaną bezpowrotnie wykasowane. Tej operacji nie można cofnąć.",
        )}
        confirmText={t("common.actions.delete", "Usuń")}
        isDestructive={true}
        onConfirm={executeDelete}
        onCancel={() => setRehearsalToDelete(null)}
        isLoading={isDeleting}
      />
    </div>
  );
};
