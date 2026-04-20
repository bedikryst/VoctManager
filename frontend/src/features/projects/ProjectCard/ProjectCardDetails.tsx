import React from "react";
import { useTranslation } from "react-i18next";
import { AlignLeft, Shirt, MapPin, UserRound } from "lucide-react";
import type { Project } from "@/shared/types";

interface ProjectCardDetailsProps {
  project: Project;
}

export default function ProjectCardDetails({
  project,
}: ProjectCardDetailsProps): React.JSX.Element {
  const { t } = useTranslation();
  const hasDressCode = project.dress_code_female || project.dress_code_male;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Sekcja Lokalizacji i Dyrygenta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {project.location && (
          <div className="bg-white border border-stone-200/80 rounded-2xl p-4 shadow-sm flex items-start gap-3">
            <MapPin
              size={18}
              className="text-brand mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <div>
              <span className="block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-1">
                {t("projects.details.location_title", "Miejsce")}
              </span>
              <span className="text-sm font-medium text-stone-800 block">
                {project.location.name}
              </span>
            </div>
          </div>
        )}

        {project.conductor_name && (
          <div className="bg-white border border-stone-200/80 rounded-2xl p-4 shadow-sm flex items-start gap-3">
            <UserRound
              size={18}
              className="text-brand mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <div>
              <span className="block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-1">
                {t("projects.details.conductor_title", "Dyrygent")}
              </span>
              <span className="text-sm font-medium text-stone-800 block">
                {project.conductor_name}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Sekcja Opisu */}
      <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm flex-1 flex flex-col">
        <h4 className="flex items-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-3">
          <AlignLeft size={16} className="text-brand" aria-hidden="true" />{" "}
          {t("projects.details.description_title", "Opis wydarzenia")}
        </h4>
        {project.description ? (
          <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
            {project.description}
          </p>
        ) : (
          <p className="text-xs text-stone-400 italic">
            {t(
              "projects.details.no_description",
              "Nie ma żadnych dodatkowych uwag do tego wydarzenia.",
            )}
          </p>
        )}
      </div>

      {/* Sekcja Dress Code */}
      <div className="bg-white border border-stone-200/80 rounded-2xl p-4 shadow-sm">
        <h4 className="flex items-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-3">
          <Shirt size={16} className="text-brand" aria-hidden="true" />{" "}
          {t("projects.details.dress_code_title", "Dress Code")}
        </h4>
        <div className="flex flex-wrap gap-2">
          {project.dress_code_female && (
            <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
              <span className="text-stone-400 font-medium">
                {t("projects.details.dress_code_female", "Panie:")}
              </span>
              <span className="text-stone-800">
                {project.dress_code_female}
              </span>
            </div>
          )}
          {project.dress_code_male && (
            <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
              <span className="text-stone-400 font-medium">
                {t("projects.details.dress_code_male", "Panowie:")}
              </span>
              <span className="text-stone-800">{project.dress_code_male}</span>
            </div>
          )}
          {!hasDressCode && (
            <div className="text-xs text-stone-400 italic py-1">
              {t(
                "projects.details.no_dress_code",
                "Nie ma wymagań co do ubioru.",
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
