/**
 * @file TelemetryWidget.tsx
 * @description Separated component for system KPIs.
 */
import React from "react";
import { Activity } from "lucide-react";
import { GlassCard } from "../../../shared/ui/GlassCard";
import { ProgressBar } from "../../../shared/ui/ProgressBar";

export function TelemetryWidget({
  adminStats,
  t,
}: {
  adminStats: any;
  t: any;
}) {
  const voices = [
    { label: "S", val: adminStats.satb.S, colorClass: "bg-rose-500" },
    { label: "A", val: adminStats.satb.A, colorClass: "bg-purple-500" },
    { label: "T", val: adminStats.satb.T, colorClass: "bg-sky-500" },
    { label: "B", val: adminStats.satb.B, colorClass: "bg-emerald-500" },
  ];

  return (
    <GlassCard
      variant="dark"
      className="h-full p-6 flex flex-col justify-between overflow-hidden relative"
    >
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500 rounded-full blur-[60px] opacity-20 pointer-events-none" />
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Activity size={14} className="text-blue-400" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
            {t("dashboard.admin.kpi_telemetry", "Telemetria Bazy")}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1">
              Baza Utworów
            </p>
            <p className="text-2xl font-black text-white">
              {adminStats.totalPieces}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1">
              Aktywne Projekty
            </p>
            <p className="text-2xl font-black text-blue-300">
              {adminStats.activeProjects}
            </p>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 pt-4 mt-auto">
        <div className="flex justify-between items-center mb-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-stone-500">
            Gotowość Zespołu
          </p>
          <span className="text-[9px] font-bold text-stone-300 bg-white/10 px-1.5 py-0.5 rounded">
            {adminStats.satb.Total} os.
          </span>
        </div>
        <div className="space-y-2">
          {voices.map((v) => (
            <ProgressBar
              key={v.label}
              label={v.label}
              value={v.val}
              total={adminStats.satb.Total}
              colorClass={v.colorClass}
            />
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
