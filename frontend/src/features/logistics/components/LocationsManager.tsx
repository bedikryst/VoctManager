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
  Cpu,
  CheckCircle2,
} from "lucide-react";

import { useLocations, useCreateLocation } from "../api/logistics.queries";
import { LocationMapPicker } from "./LocationMapPicker"; // Używamy naszego nowego komponentu mapy
import { LocationCreateDto } from "../types/logistics.dto";
import type { LocationCategory } from "../../../shared/types";
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

  // Przechowujemy dane z mapy w stanie tymczasowym (Draft), dopóki user nie kliknie "Zapisz"
  const [draftLocation, setDraftLocation] =
    useState<Partial<LocationCreateDto> | null>(null);

  // Bezpieczna ekstrakcja tablicy (obsługa paginacji DRF: { count, results: [] } lub czystego [])
  const locations = Array.isArray(locationsData)
    ? locationsData
    : (locationsData as any)?.results || [];

  const handleLocationSelect = (locationData: Partial<LocationCreateDto>) => {
    // Tylko aktualizujemy stan wizualny - nie wysyłamy jeszcze do bazy!
    setDraftLocation(locationData);
  };

  const handleSaveToDatabase = async () => {
    if (!draftLocation?.name || !draftLocation?.formatted_address) return;

    const payload: LocationCreateDto = {
      name: draftLocation.name,
      formatted_address: draftLocation.formatted_address,
      category: selectedCategory,
      google_place_id: draftLocation.google_place_id || null,
      latitude:
        draftLocation.latitude != null
          ? Number(draftLocation.latitude.toFixed(6))
          : null,
      longitude:
        draftLocation.longitude != null
          ? Number(draftLocation.longitude.toFixed(6))
          : null,
    };

    try {
      await createLocationMutation.mutateAsync(payload);
      // Reset po sukcesie
      setIsAddingMode(false);
      setDraftLocation(null);
    } catch (error: any) {
      console.error(
        "DRF Validation Error Details:",
        error.response?.data || error.message,
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] bg-[#050914] rounded-3xl border border-white/5">
        <Loader2 className="animate-spin text-cyan-400 mb-4" size={48} />
        <span className="text-cyan-400/50 font-mono tracking-widest uppercase text-sm">
          {t("common.loading", "Initializing Data Core...")}
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-[calc(100vh-4rem)] bg-[#030712] overflow-hidden rounded-[2rem] border border-white/5 shadow-2xl p-6 md:p-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none mix-blend-overlay" />

      <div className="relative z-10 space-y-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Cpu className="text-cyan-400" size={20} />
              <span className="text-cyan-400 uppercase tracking-widest text-xs font-bold">
                Logistics Module
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-light text-white tracking-tight">
              {t("logistics.locations.title", "Global Locations")}
            </h1>
          </div>

          <Button
            onClick={() => {
              setIsAddingMode(!isAddingMode);
              setDraftLocation(null); // Reset draft on toggle
            }}
            variant={isAddingMode ? "secondary" : "primary"}
            className={`flex items-center gap-2 transition-all duration-300 ${
              !isAddingMode
                ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                : ""
            }`}
          >
            {isAddingMode ? <X size={18} /> : <Plus size={18} />}
            {isAddingMode
              ? t("common.cancel", "Abort Operation")
              : t("logistics.add_location", "New Location")}
          </Button>
        </div>

        {/* Add New Location (Smooth Expand) */}
        <AnimatePresence>
          {isAddingMode && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -20, filter: "blur(10px)" }}
              animate={{
                opacity: 1,
                height: "auto",
                y: 0,
                filter: "blur(0px)",
              }}
              exit={{ opacity: 0, height: 0, y: -20, filter: "blur(10px)" }}
              className="overflow-hidden"
            >
              <div className="p-8 space-y-8 bg-white/[0.02] border border-cyan-500/20 shadow-[inset_0_0_30px_rgba(6,182,212,0.05)] backdrop-blur-xl rounded-2xl mb-8 relative">
                {/* Krok 1: Kategoria */}
                <div>
                  <h3 className="text-cyan-400/80 uppercase font-mono tracking-wider mb-4 text-xs">
                    01 // Select Classification
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {(Object.keys(CATEGORY_CONFIG) as LocationCategory[]).map(
                      (category) => {
                        const { icon: Icon, labelKey } =
                          CATEGORY_CONFIG[category];
                        const isSelected = selectedCategory === category;
                        return (
                          <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 border ${
                              isSelected
                                ? "bg-cyan-500/10 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                : "bg-black/40 border-white/5 text-white/50 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <Icon
                              size={16}
                              className={isSelected ? "text-cyan-400" : ""}
                            />
                            {t(labelKey, category.replace("_", " "))}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>

                {/* Krok 2: Mapa */}
                <div className="relative">
                  <h3 className="text-cyan-400/80 uppercase font-mono tracking-wider mb-4 text-xs">
                    02 // Pinpoint Location
                  </h3>
                  <div className="bg-black/20 p-2 rounded-xl border border-white/5">
                    <LocationMapPicker
                      onLocationSelect={handleLocationSelect}
                    />
                  </div>
                </div>

                {/* Krok 3: Potwierdzenie zapisu (pojawia się tylko gdy user wskaże miejsce) */}
                <AnimatePresence>
                  {draftLocation && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="pt-6 border-t border-cyan-500/20 flex flex-col md:flex-row justify-between items-center gap-4"
                    >
                      <div className="flex flex-col">
                        <span className="text-white font-medium text-lg">
                          {draftLocation.name}
                        </span>
                        <span className="text-white/50 text-sm font-mono truncate max-w-md">
                          {draftLocation.formatted_address}
                        </span>
                      </div>

                      <Button
                        onClick={handleSaveToDatabase}
                        disabled={createLocationMutation.isPending}
                        className="bg-cyan-500 text-black hover:bg-cyan-400 w-full md:w-auto flex items-center gap-2 justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] px-8 py-3"
                      >
                        {createLocationMutation.isPending ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={18} />
                        )}
                        <span className="font-bold tracking-wide uppercase text-sm">
                          {t("common.save", "Add to Database")}
                        </span>
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Locations Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
          }}
        >
          {locations.map((location: any) => {
            const CategoryIcon =
              CATEGORY_CONFIG[location.category as LocationCategory]?.icon ||
              MapPin;

            return (
              <motion.div
                key={location.id}
                variants={{
                  hidden: { opacity: 0, scale: 0.95, y: 20 },
                  visible: {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    transition: { type: "spring", stiffness: 100 },
                  },
                }}
              >
                <div className="h-full p-6 flex flex-col justify-between group bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 rounded-2xl transition-all duration-500 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-indigo-500/0 group-hover:from-cyan-500/5 group-hover:to-indigo-500/5 transition-all duration-500" />

                  <div className="space-y-5 relative z-10">
                    <div className="flex justify-between items-start">
                      <div className="p-3 bg-black/40 rounded-xl border border-white/5 group-hover:border-cyan-500/30 transition-colors shadow-inner">
                        <CategoryIcon
                          className="text-cyan-400/80 group-hover:text-cyan-300 transition-colors"
                          size={22}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500/10 text-xs text-cyan-200 border border-cyan-500/20 backdrop-blur-sm">
                        <Clock size={12} />
                        <span className="font-mono tracking-wider">
                          {location.timezone}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xl font-medium text-slate-200 tracking-tight leading-tight group-hover:text-white transition-colors">
                        {location.name}
                      </h4>
                      <p className="text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                        {location.formatted_address}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Empty State */}
          {locations.length === 0 && !isAddingMode && (
            <div className="col-span-full py-32 flex flex-col items-center justify-center text-slate-500">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full" />
                <Globe
                  className="relative text-cyan-500/40"
                  size={80}
                  strokeWidth={1}
                />
              </div>
              <p className="text-2xl font-light text-slate-300">
                {t("logistics.empty_state", "Database is empty.")}
              </p>
              <p className="text-sm mt-3 text-slate-500 font-mono tracking-widest uppercase">
                {t(
                  "logistics.empty_state_sub",
                  "Awaiting first synchronization",
                )}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
