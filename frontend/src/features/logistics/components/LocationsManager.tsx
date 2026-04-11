import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Globe,
  Clock,
  Plus,
  Building2,
  Plane,
  Bed,
  Music,
  Briefcase,
  X,
  Loader2,
} from "lucide-react";

import { useLocations, useCreateLocation } from "../api/logistics.queries";
import { LocationAutocomplete } from "./LocationAutocomplete";
import { LocationCreateDto } from "../types/logistics.dto";
import type { LocationCategory } from "../../../shared/types";
import { GlassCard } from "../../../shared/ui/GlassCard";
import { Button } from "../../../shared/ui/Button";

const CATEGORY_CONFIG: Record<
  LocationCategory,
  { icon: React.ElementType; labelKey: string }
> = {
  CONCERT_HALL: { icon: Music, labelKey: "logistics.categories.concert_hall" },
  REHEARSAL_ROOM: {
    icon: Building2,
    labelKey: "logistics.categories.rehearsal_room",
  },
  HOTEL: { icon: Bed, labelKey: "logistics.categories.hotel" },
  AIRPORT: { icon: Plane, labelKey: "logistics.categories.airport" },
  TRANSIT_STATION: { icon: Globe, labelKey: "logistics.categories.transit" },
  WORKSPACE: { icon: Briefcase, labelKey: "logistics.categories.workspace" },
  OTHER: { icon: MapPin, labelKey: "logistics.categories.other" },
};

export const LocationsManager = () => {
  const { t } = useTranslation();
  const { data: locationsData, isLoading } = useLocations();
  const createLocationMutation = useCreateLocation();

  const [isAddingMode, setIsAddingMode] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<LocationCategory>("CONCERT_HALL");

  // Type safety: Ensure we always operate on an array
  const locations = Array.isArray(locationsData) ? locationsData : [];

  const handleLocationSelect = async (
    locationData: Partial<LocationCreateDto>,
  ) => {
    if (!locationData.name || !locationData.formatted_address) return;

    const payload: LocationCreateDto = {
      name: locationData.name,
      formatted_address: locationData.formatted_address,
      category: selectedCategory,
      google_place_id: locationData.google_place_id,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
    };

    try {
      await createLocationMutation.mutateAsync(payload);
      setIsAddingMode(false);
    } catch (error) {
      console.error("Failed to create location", error);
      // Future: Trigger a global Toast notification here
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh] text-white/50">
        <Loader2 className="animate-spin mr-2" size={24} />
        <span>{t("common.loading", "Loading data...")}</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">
          {t("logistics.locations.title", "Global Locations")}
        </h1>

        <Button
          onClick={() => setIsAddingMode(!isAddingMode)}
          variant={isAddingMode ? "secondary" : "primary"}
          className="flex items-center gap-2"
          disabled={createLocationMutation.isPending}
        >
          {isAddingMode ? <X size={18} /> : <Plus size={18} />}
          {isAddingMode
            ? t("common.cancel", "Cancel")
            : t("logistics.add_location", "Add Location")}
        </Button>
      </div>

      {/* Add New Location (Smooth Expand) */}
      <AnimatePresence>
        {isAddingMode && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="overflow-hidden"
          >
            <GlassCard className="p-8 space-y-8 bg-white/5 border-white/10 shadow-2xl mb-8">
              <div>
                <h3 className="text-white/80 font-medium mb-4 text-lg">
                  {t("logistics.select_category", "1. Select Category")}
                </h3>
                <div className="flex flex-wrap gap-4">
                  {(Object.keys(CATEGORY_CONFIG) as LocationCategory[]).map(
                    (category) => {
                      const { icon: Icon, labelKey } =
                        CATEGORY_CONFIG[category];
                      const isSelected = selectedCategory === category;
                      return (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                            isSelected
                              ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)] scale-105"
                              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <Icon size={18} />
                          {t(labelKey, category.replace("_", " "))}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              <div className="relative">
                <h3 className="text-white/80 font-medium mb-4 text-lg">
                  {t("logistics.search_google", "2. Search Google Maps")}
                </h3>
                {createLocationMutation.isPending && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-lg">
                    <Loader2 className="animate-spin text-white" size={32} />
                  </div>
                )}
                <LocationAutocomplete
                  onLocationSelect={handleLocationSelect}
                  placeholder={t(
                    "logistics.autocomplete.placeholder",
                    "Type a venue, hotel, or address...",
                  )}
                />
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Locations Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
        }}
      >
        {locations.map((location) => {
          const CategoryIcon =
            CATEGORY_CONFIG[location.category]?.icon || MapPin;

          return (
            <motion.div
              key={location.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <GlassCard className="h-full p-6 flex flex-col justify-between group hover:bg-white/10 transition-all duration-500">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors shadow-inner">
                      <CategoryIcon className="text-white/80" size={24} />
                    </div>
                    {/* Timezone Badge */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/20 text-xs text-white/70 border border-white/5 shadow-sm">
                      <Clock size={12} />
                      <span className="font-mono tracking-wide">
                        {location.timezone}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <h4 className="text-xl font-semibold text-white tracking-tight leading-tight">
                      {location.name}
                    </h4>
                    <p className="text-sm text-white/50 mt-2 line-clamp-3 leading-relaxed">
                      {location.formatted_address}
                    </p>
                  </div>
                </div>

                {location.internal_notes && (
                  <div className="mt-6 pt-4 border-t border-white/5">
                    <p className="text-xs text-white/40 italic">
                      {location.internal_notes}
                    </p>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          );
        })}

        {/* Empty State */}
        {locations.length === 0 && !isAddingMode && (
          <div className="col-span-full py-32 text-center text-white/40">
            <Globe className="mx-auto mb-6 opacity-30" size={64} />
            <p className="text-xl font-light">
              {t(
                "logistics.empty_state",
                "Your global locations database is empty.",
              )}
            </p>
            <p className="text-sm mt-3 text-white/30">
              {t(
                "logistics.empty_state_sub",
                "Add your first concert hall or hotel to begin.",
              )}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};
