import { useTranslation } from "react-i18next";
import {
  Utensils,
  Shirt,
  Ruler,
  CheckCircle2,
  Footprints,
} from "lucide-react";

import { GlassCard } from "../../../shared/ui/GlassCard";
import { Input } from "../../../shared/ui/Input";
import { Button } from "../../../shared/ui/Button";
import { useLogisticsSettings } from "../hooks/useLogisticsSettings";

export default function LogisticsTab() {
  const { t } = useTranslation();
  const {
    formData,
    isFetching,
    isPending,
    isDirty,
    status,
    handleChange,
    handleSubmit,
  } = useLogisticsSettings();

  if (isFetching) return <div className="p-8 text-center">Wczytywanie...</div>;

  return (
    <GlassCard>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-stone-900">
          {t("settings.logistics.title", "Logistyka i Trasy")}
        </h2>
        <p className="text-sm text-stone-500">
          {t(
            "settings.logistics.subtitle",
            "Dane wykorzystywane przez management do zamawiania strojów i cateringu.",
          )}
        </p>
      </div>

      {status.type === "error" && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm font-medium rounded-xl border border-red-200">
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Sekcja Cateringu */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-stone-800 uppercase tracking-wider flex items-center gap-2">
            <Utensils className="w-4 h-4 text-[#002395]" /> Catering
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-1">
                Preferencja Żywieniowa
              </label>
              <select
                className="w-full text-sm font-medium text-stone-800 rounded-xl py-2.5 px-4 bg-white/50 border border-stone-200/60 focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40"
                value={formData.dietary_preference}
                onChange={(e) =>
                  handleChange("dietary_preference", e.target.value)
                }
              >
                <option value="none">Brak wymagań</option>
                <option value="vege">Wegetariańska</option>
                <option value="vegan">Wegańska</option>
                <option value="gf">Bez glutenu</option>
                <option value="lf">Bez laktozy</option>
              </select>
            </div>
            <div className="flex flex-col space-y-1 md:col-span-2">
              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-1">
                Uwagi / Alergie (opcjonalnie)
              </label>
              <textarea
                placeholder="Np. uczulenie na orzechy, brak owoców morza..."
                className="w-full text-sm rounded-xl py-2.5 px-4 bg-white/50 border border-stone-200/60 min-h-[80px]"
                value={formData.dietary_notes}
                onChange={(e) => handleChange("dietary_notes", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-stone-100"></div>

        {/* Sekcja Wymiarów */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-stone-800 uppercase tracking-wider flex items-center gap-2">
            <Shirt className="w-4 h-4 text-[#002395]" /> Wymiary i Stroje
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-1">
                Rozmiar Ubrań
              </label>
              <select
                className="w-full text-sm font-medium text-stone-800 rounded-xl py-2.5 px-4 bg-white/50 border border-stone-200/60"
                value={formData.clothing_size}
                onChange={(e) => handleChange("clothing_size", e.target.value)}
              >
                <option value="">Wybierz...</option>
                <option value="xs">XS</option>
                <option value="s">S</option>
                <option value="m">M</option>
                <option value="l">L</option>
                <option value="xl">XL</option>
                <option value="xxl">XXL</option>
              </select>
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-1">
                Rozmiar Buta (EU)
              </label>
              <Input
                placeholder="Np. 42"
                value={formData.shoe_size}
                onChange={(e) => handleChange("shoe_size", e.target.value)}
                leftIcon={<Footprints className="w-4 h-4" />}
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-1">
                Wzrost (cm)
              </label>
              <Input
                type="number"
                placeholder="Np. 175"
                value={formData.height_cm}
                onChange={(e) => handleChange("height_cm", e.target.value)}
                leftIcon={<Ruler className="w-4 h-4" />}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 flex items-center justify-end gap-4">
          {status.type === "success" && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 uppercase tracking-wider animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" /> Zapisano
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
