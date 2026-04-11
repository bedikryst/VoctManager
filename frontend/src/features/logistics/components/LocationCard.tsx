import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  MapPin,
  Globe,
  Clock,
  Edit2,
  Archive,
  Music,
  Building2,
  Bed,
  Plane,
  Briefcase,
} from "lucide-react";
import type { LocationDto } from "../types/logistics.dto";
import type { LocationCategory } from "../../../shared/types";
import { GlassCard } from "../../../shared/ui/GlassCard";
import { Button } from "../../../shared/ui/Button";

interface LocationCardProps {
  location: LocationDto;
  onEdit: (location: LocationDto) => void;
  onArchive: (location: LocationDto) => void;
}

const CATEGORY_CONFIG: Record<
  LocationCategory,
  { icon: React.ElementType; color: string; bg: string }
> = {
  CONCERT_HALL: { icon: Music, color: "text-amber-600", bg: "bg-amber-100" },
  REHEARSAL_ROOM: {
    icon: Building2,
    color: "text-emerald-600",
    bg: "bg-emerald-100",
  },
  HOTEL: { icon: Bed, color: "text-purple-600", bg: "bg-purple-100" },
  AIRPORT: { icon: Plane, color: "text-sky-600", bg: "bg-sky-100" },
  TRANSIT_STATION: {
    icon: Globe,
    color: "text-indigo-600",
    bg: "bg-indigo-100",
  },
  WORKSPACE: { icon: Briefcase, color: "text-rose-600", bg: "bg-rose-100" },
  OTHER: { icon: MapPin, color: "text-stone-600", bg: "bg-stone-200" },
};

export const LocationCard = React.memo(
  ({ location, onEdit, onArchive }: LocationCardProps) => {
    const { t } = useTranslation();
    const config = CATEGORY_CONFIG[location.category] || CATEGORY_CONFIG.OTHER;
    const Icon = config.icon;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="transition-all duration-300 group hover:-translate-y-0.5 hover:shadow-lg h-full"
      >
        <GlassCard className="flex flex-col justify-between h-full relative overflow-hidden">
          <div className="relative z-10 flex-1">
            <div className="flex items-start gap-4 mb-5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border border-white/60 ${config.bg} ${config.color}`}
              >
                <Icon size={24} strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-stone-900 tracking-tight leading-tight line-clamp-2">
                  {location.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span
                    className={`px-2 py-0.5 text-[8px] font-bold antialiased uppercase tracking-widest rounded-md border shadow-sm ${config.bg} ${config.color} border-white/50`}
                  >
                    {t(
                      `logistics.categories.${location.category.toLowerCase()}`,
                      location.category.replace("_", " "),
                    )}
                  </span>
                  <span className="px-2 py-0.5 text-[8px] font-bold antialiased uppercase tracking-widest rounded-md border shadow-sm bg-stone-100 text-stone-500 border-stone-200 flex items-center gap-1">
                    <Clock size={10} /> {location.timezone}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-stone-50/80 border border-stone-200/60 rounded-xl p-3.5 mb-5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] space-y-2">
              <p className="text-xs text-stone-600 leading-relaxed font-medium line-clamp-2">
                <MapPin size={12} className="inline mr-1 text-stone-400" />
                {location.formatted_address}
              </p>
            </div>

            {location.internal_notes && (
              <div className="text-xs text-stone-500 italic mb-6 line-clamp-2 pl-2 border-l-2 border-stone-200">
                {location.internal_notes}
              </div>
            )}
          </div>

          <div className="flex gap-3 border-t border-stone-100/50 pt-5 relative z-10">
            <Button
              variant="outline"
              onClick={() => onEdit(location)}
              leftIcon={<Edit2 size={14} />}
              className="flex-1"
            >
              {t("common.edit", "Edytuj")}
            </Button>
            <Button
              variant="outline"
              onClick={() => onArchive(location)}
              leftIcon={<Archive size={14} />}
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              {t("common.archive", "Archiwizuj")}
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    );
  },
  (prev, next) => prev.location.id === next.location.id,
);
