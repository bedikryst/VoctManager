/**
 * @file AbsenceReportForm.tsx
 * @description Inline absence reporting form powered by React Hook Form & Zod.
 * @architecture Enterprise SaaS 2026
 */
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { AttendanceStatus } from "@/shared/types";

const absenceSchema = z.object({
  status: z.enum(["ABSENT", "LATE"] as const),
  notes: z.string().min(3, "Proszę podać powód/uwagi."),
});

export type AbsenceFormValues = z.infer<typeof absenceSchema>;

interface AbsenceReportFormProps {
  onSubmit: (data: AbsenceFormValues) => Promise<void>;
  onCancel: () => void;
}

export function AbsenceReportForm({
  onSubmit,
  onCancel,
}: AbsenceReportFormProps): React.JSX.Element {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AbsenceFormValues>({
    resolver: zodResolver(absenceSchema),
    defaultValues: { status: "ABSENT", notes: "" },
  });

  const handleFormSubmit = async (data: AbsenceFormValues) => {
    await onSubmit(data);
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="flex flex-col gap-3 relative z-10"
    >
      <div className="flex flex-col gap-2">
        <div className="flex gap-3">
          <select
            {...register("status")}
            className="w-1/3 px-3 py-2 text-xs font-bold text-stone-800 bg-white border border-stone-200/80 rounded-lg outline-none focus:ring-2 focus:ring-brand/20 appearance-none shadow-sm cursor-pointer"
          >
            <option value="ABSENT">Nie będę</option>
            <option value="LATE">Spóźnię się</option>
          </select>
          <input
            type="text"
            placeholder="Powód / Uwagi..."
            {...register("notes")}
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium bg-white border rounded-lg outline-none focus:ring-2 focus:ring-brand/20 shadow-sm",
              errors.notes
                ? "border-red-500/50 focus:border-red-500/50 text-red-900 placeholder:text-red-300"
                : "border-stone-200/80 text-stone-800",
            )}
          />
        </div>
        {errors.notes && (
          <span className="text-[10px] font-bold text-red-500 pl-1">
            {errors.notes.message}
          </span>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => {
            reset();
            onCancel();
          }}
          className="px-4 py-2 text-[9px] font-bold uppercase text-stone-500 hover:text-stone-800 transition-colors"
        >
          Anuluj
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-brand text-white rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-blue-800 disabled:opacity-50 shadow-sm transition-all active:scale-95"
        >
          {isSubmitting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Send size={12} />
          )}
          Wyślij
        </button>
      </div>
    </form>
  );
}
