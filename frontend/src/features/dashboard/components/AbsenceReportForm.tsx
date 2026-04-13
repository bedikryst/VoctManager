/**
 * @file AbsenceReportForm.tsx
 * @description Inline absence reporting form powered by React Hook Form & Zod.
 * Refactored to Enterprise SaaS 2026 i18n and Component Variant Authority (CVA) standards.
 * @architecture Enterprise SaaS 2026
 */
import React, { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Send, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

// Ethereal UI Primitives - delegacja zarządzania wariantami poprzez CVA
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import type { AttendanceStatus } from "@/shared/types";

// Dynamiczny schemat Zod pozwalający na wstrzyknięcie funkcji translacji
const createAbsenceSchema = (t: (key: string, defaultText: string) => string) =>
  z.object({
    status: z.enum(["ABSENT", "LATE"] as const),
    notes: z
      .string()
      .min(
        3,
        t(
          "dashboard.artist.validation_notes_min",
          "Proszę podać powód/uwagi (min. 3 znaki).",
        ),
      ),
  });

export type AbsenceFormValues = z.infer<ReturnType<typeof createAbsenceSchema>>;

interface AbsenceReportFormProps {
  onSubmit: (data: AbsenceFormValues) => Promise<void>;
  onCancel: () => void;
}

export function AbsenceReportForm({
  onSubmit,
  onCancel,
}: AbsenceReportFormProps): React.JSX.Element {
  const { t } = useTranslation();

  const absenceSchema = useMemo(() => createAbsenceSchema(t), [t]);

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
          {/* Zwykły select został zaktualizowany pod kątem i18n. 
            W przyszłości warto również i ten element wyabstrahować do CVA (np. Select.tsx).
          */}
          <select
            {...register("status")}
            className="w-1/3 px-3 py-2 text-xs font-bold text-stone-800 bg-white border border-stone-200/80 rounded-lg outline-none focus:ring-2 focus:ring-brand/20 appearance-none shadow-sm cursor-pointer"
            aria-label={t("dashboard.artist.absence_status", "Status absencji")}
          >
            <option value="ABSENT">
              {t("dashboard.artist.status_absent", "Nie będę")}
            </option>
            <option value="LATE">
              {t("dashboard.artist.status_late", "Spóźnię się")}
            </option>
          </select>

          <div className="flex-1">
            <Input
              {...register("notes")}
              placeholder={t(
                "dashboard.artist.notes_placeholder",
                "Powód / Uwagi...",
              )}
              hasError={!!errors.notes}
              error={errors.notes?.message}
              className="w-full"
            />
          </div>
        </div>

        {errors.notes && (
          <span
            className="text-[10px] font-bold text-red-500 pl-1"
            role="alert"
          >
            {errors.notes.message}
          </span>
        )}
      </div>

      <div className="flex gap-2 justify-end mt-2">
        <Button
          type="button"
          variant="ghost" // wykorzystanie CVA zamiast klasycznych ciągów klas
          size="sm"
          onClick={() => {
            reset();
            onCancel();
          }}
        >
          {t("common.cancel", "Anuluj")}
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 size={12} className="animate-spin mr-1.5 inline-block" />
          ) : (
            <Send size={12} className="mr-1.5 inline-block" />
          )}
          {t("common.send", "Wyślij")}
        </Button>
      </div>
    </form>
  );
}
