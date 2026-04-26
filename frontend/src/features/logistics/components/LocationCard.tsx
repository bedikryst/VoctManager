import React from "react";
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
  Church,
} from "lucide-react";
import type { LocationDto } from "../types/logistics.dto";
import type { LocationCategory } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { useLocalTime } from "@/shared/lib/time/hooks/useLocalTime";
import {
  Heading,
  Text,
  Caption,
} from "@/shared/ui/primitives/typography";
import { Badge } from "@/shared/ui/primitives/Badge";

interface LocationCardProps {
  location: LocationDto;
  onEdit: (location: LocationDto) => void;
  onArchive: (location: LocationDto) => void;
}

const CATEGORY_CONFIG: Record<
  LocationCategory,
  { icon: React.ElementType; badgeVariant: "success" | "warning" | "danger" | "amethyst" | "neutral" | "brand" | "outline" | "glass" }
> = {
  CONCERT_HALL: {
    icon: Music,
    badgeVariant: "warning",
  },
  CHURCH: {
    icon: Church,
    badgeVariant: "success",
  },
  REHEARSAL_ROOM: {
    icon: Building2,
    badgeVariant: "success",
  },
  HOTEL: {
    icon: Bed,
    badgeVariant: "amethyst",
  },
  AIRPORT: {
    icon: Plane,
    badgeVariant: "neutral",
  },
  TRANSIT_STATION: {
    icon: Globe,
    badgeVariant: "neutral",
  },
  WORKSPACE: {
    icon: Briefcase,
    badgeVariant: "danger",
  },
  OTHER: {
    icon: MapPin,
    badgeVariant: "outline",
  },
};

export const LocationCard = React.memo(
  ({ location, onEdit, onArchive }: LocationCardProps) => {
    const { t } = useTranslation();
    const config = CATEGORY_CONFIG[location.category] || CATEGORY_CONFIG.OTHER;
    const Icon = config.icon;
    const liveLocalTime = useLocalTime(location.timezone);

    return (
      <GlassCard className="flex flex-col justify-between h-full relative overflow-hidden border border-ethereal-incense/20">
        <div className="relative z-10 flex-1">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border bg-ethereal-alabaster/80 border-ethereal-incense/20 text-ethereal-graphite transition-colors">
              <Icon size={24} strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <Heading
                as="h3"
                size="lg"
                weight="bold"
                className="line-clamp-2 text-ethereal-ink leading-tight"
              >
                {location.name}
              </Heading>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant={config.badgeVariant}>
                  {t(
                    `logistics.categories.${(location.category || "OTHER").toLowerCase()}`,
                    (location.category || "OTHER").replace("_", " ")
                  )}
                </Badge>
                <Badge variant="glass" icon={<Clock size={11} className={liveLocalTime ? "text-ethereal-gold" : "text-ethereal-incense/50"} />}>
                  {liveLocalTime ? (
                    <>{liveLocalTime} <Caption className="ml-1 tracking-widest text-[8px] uppercase !text-ethereal-incense/60">{location.timezone.split("/").pop()?.replace("_", " ")}</Caption></>
                  ) : (
                    <>{location.timezone}</>
                  )}
                </Badge>
              </div>
            </div>
          </div>

          <div className="bg-ethereal-alabaster/40 border border-ethereal-incense/10 rounded-xl p-3.5 mb-5 shadow-glass-solid space-y-2">
            <Text
              as="p"
              size="sm"
              weight="medium"
              color="graphite"
              className="line-clamp-2 leading-relaxed flex items-start gap-1.5"
            >
              <MapPin size={14} className="mt-0.5 shrink-0 text-ethereal-incense/60" />
              {location.formatted_address}
            </Text>
          </div>

          {location.internal_notes && (
            <Caption
              color="incense-muted"
              className="italic mb-6 line-clamp-2 pl-2 border-l-2 border-ethereal-incense/20 block"
            >
              {location.internal_notes}
            </Caption>
          )}
        </div>

        <div className="flex gap-3 border-t border-ethereal-incense/10 pt-5 relative z-10 mt-auto">
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(location);
            }}
            leftIcon={<Edit2 size={14} />}
            className="flex-1 border-ethereal-incense/20 hover:border-ethereal-gold/40 hover:bg-ethereal-gold/5 hover:text-ethereal-gold"
          >
            {t("common.edit", "Edytuj")}
          </Button>
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onArchive(location);
            }}
            leftIcon={<Archive size={14} />}
            className="flex-1 border-ethereal-crimson/20 text-ethereal-crimson hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson hover:border-ethereal-crimson/40"
          >
            {t("common.archive", "Archiwizuj")}
          </Button>
        </div>
      </GlassCard>
    );
  },
  (prev, next) => prev.location.id === next.location.id,
);
