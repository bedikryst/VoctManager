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
import type { LocationCategory } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { useLocalTime } from "@/shared/lib/time/hooks/useLocalTime";
import { Heading, Text, Caption, Eyebrow } from "@/shared/ui/primitives/typography";
import { Badge } from "@/shared/ui/primitives/Badge";

interface LocationCardProps {
  location: LocationDto;
  onEdit: (location: LocationDto) => void;
  onArchive: (location: LocationDto) => void;
}

const CATEGORY_CONFIG: Record<
  LocationCategory,
  { icon: React.ElementType; color: string; bg: string }
> = {
  CONCERT_HALL: { icon: Music, color: "text-ethereal-gold", bg: "bg-ethereal-gold/10 border-ethereal-gold/30" },
  REHEARSAL_ROOM: {
    icon: Building2,
    color: "text-ethereal-sage",
    bg: "bg-ethereal-sage/10 border-ethereal-sage/30",
  },
  HOTEL: { icon: Bed, color: "text-ethereal-amethyst", bg: "bg-ethereal-amethyst/10 border-ethereal-amethyst/30" },
  AIRPORT: { icon: Plane, color: "text-ethereal-incense", bg: "bg-ethereal-incense/10 border-ethereal-incense/30" },
  TRANSIT_STATION: {
    icon: Globe,
    color: "text-ethereal-incense",
    bg: "bg-ethereal-incense/10 border-ethereal-incense/30",
  },
  WORKSPACE: { icon: Briefcase, color: "text-ethereal-crimson", bg: "bg-ethereal-crimson/10 border-ethereal-crimson/30" },
  OTHER: { icon: MapPin, color: "text-ethereal-graphite", bg: "bg-ethereal-incense/5 border-ethereal-incense/20" },
};

export const LocationCard = React.memo(
  ({ location, onEdit, onArchive }: LocationCardProps) => {
    const { t } = useTranslation();
    const config = CATEGORY_CONFIG[location.category] || CATEGORY_CONFIG.OTHER;
    const Icon = config.icon;
    const liveLocalTime = useLocalTime(location.timezone);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="transition-all duration-300 group hover:-translate-y-0.5 hover:shadow-glass-ethereal-hover h-full"
      >
        <GlassCard className="flex flex-col justify-between h-full relative overflow-hidden border border-ethereal-incense/20">
          <div className="relative z-10 flex-1">
            <div className="flex items-start gap-4 mb-5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border ${config.bg} ${config.color}`}
              >
                <Icon size={24} strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <Heading as="h3" size="lg" weight="bold" className="line-clamp-2 text-ethereal-ink leading-tight">
                  {location.name}
                </Heading>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span
                    className={`px-2 py-0.5 text-[8px] font-bold antialiased uppercase tracking-widest rounded-md border shadow-sm ${config.bg} ${config.color}`}
                  >
                    {t(
                      `logistics.categories.${location.category.toLowerCase()}`,
                      location.category.replace("_", " "),
                    )}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider rounded-md border shadow-sm bg-ethereal-alabaster/80 text-ethereal-graphite border-ethereal-incense/20 flex items-center gap-1.5 backdrop-blur-sm">
                    <Clock
                      size={11}
                      className={
                        liveLocalTime ? "text-ethereal-gold" : "text-ethereal-incense/50"
                      }
                    />
                    {liveLocalTime ? (
                      <span>
                        {liveLocalTime}{" "}
                        <span className="text-[8px] text-ethereal-incense/60 ml-1 tracking-widest uppercase">
                          {location.timezone
                            .split("/")
                            .pop()
                            ?.replace("_", " ")}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[8px] uppercase tracking-widest opacity-70">
                        {location.timezone}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-ethereal-alabaster/40 border border-ethereal-incense/10 rounded-xl p-3.5 mb-5 shadow-glass-solid space-y-2">
              <Text as="p" size="sm" weight="medium" color="graphite" className="line-clamp-2 leading-relaxed">
                <MapPin size={12} className="inline mr-1 text-ethereal-incense/60" />
                {location.formatted_address}
              </Text>
            </div>

            {location.internal_notes && (
              <Caption color="incense-muted" className="italic mb-6 line-clamp-2 pl-2 border-l-2 border-ethereal-incense/20">
                {location.internal_notes}
              </Caption>
            )}
          </div>

          <div className="flex gap-3 border-t border-ethereal-incense/10 pt-5 relative z-10">
            <Button
              variant="outline"
              onClick={() => onEdit(location)}
              leftIcon={<Edit2 size={14} />}
              className="flex-1 border-ethereal-incense/20 hover:border-ethereal-gold/40 hover:bg-ethereal-gold/5 hover:text-ethereal-gold"
            >
              {t("common.edit", "Edytuj")}
            </Button>
            <Button
              variant="outline"
              onClick={() => onArchive(location)}
              leftIcon={<Archive size={14} />}
              className="flex-1 border-ethereal-crimson/20 text-ethereal-crimson hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson hover:border-ethereal-crimson/40"
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
