/**
 * @file ContractRow.tsx
 * @description Manages individual row state, and localized PDF generation.
 * Uses strict mutations instead of raw Axios calls.
 * @module panel/contracts/ContractRow
 */

import React, { useState } from "react";
import { toast } from "sonner";
import { FileText, CheckCircle2 } from "lucide-react";
import { Input } from "../../../shared/ui/Input";
import { Button } from "../../../shared/ui/Button";
import { useUpdateFee } from "../api/contracts.queries";

import type {
  EnrichedParticipation,
  EnrichedCrewAssignment,
} from "../types/contracts.dto";

interface ContractRowProps {
  record: EnrichedParticipation | EnrichedCrewAssignment;
  type: "CAST" | "CREW";
  onDownload: (
    id: string | number,
    name: string,
    type: "CAST" | "CREW",
  ) => void;
}

export function ContractRow({
  record,
  type,
  onDownload,
}: ContractRowProps): React.JSX.Element {
  const updateFeeMutation = useUpdateFee(type);
  const [fee, setFee] = useState<string>(record.fee ? String(record.fee) : "");
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Zabezpieczenie typu - backend rzuca inne nazwy dla wokalistów i dla techniki
  const personName =
    type === "CAST"
      ? (record as EnrichedParticipation).artist_name
      : (record as EnrichedCrewAssignment).collaborator_name;
  const roleDisplay =
    type === "CAST"
      ? (record as EnrichedParticipation).artist_voice_type_display
      : (record as EnrichedCrewAssignment).collaborator_specialty_display;

  const isMissingFee = !fee || parseFloat(fee) === 0;

  const handleSaveFee = async (): Promise<void> => {
    setSaveSuccess(false);
    try {
      const numericFee = fee === "" ? null : parseFloat(fee);
      await updateFeeMutation.mutateAsync({ id: record.id, fee: numericFee });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      toast.error(
        `Failed to save remuneration for ${personName || "contractor"}.`,
      );
    }
  };

  const isFeeUnchanged =
    parseFloat(fee || "0") === parseFloat(String(record.fee || "0"));

  return (
    <tr
      className={`transition-colors group ${isMissingFee ? "bg-orange-50/10 hover:bg-orange-50/30" : "hover:bg-stone-50/50"}`}
    >
      <td className="px-6 py-5">
        <p className="font-bold text-stone-800 whitespace-nowrap tracking-tight">
          {personName || "-"}
        </p>
        {isMissingFee && (
          <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest mt-1 md:hidden">
            Missing Fee
          </p>
        )}
      </td>
      <td className="px-6 py-5 hidden sm:table-cell text-[9px] uppercase font-bold antialiased text-stone-500 tracking-widest">
        {roleDisplay || "-"}
      </td>
      <td className="px-6 py-5 hidden md:table-cell text-[9px] uppercase font-bold antialiased tracking-widest text-stone-400">
        {record.status}
      </td>

      <td className="px-6 py-5">
        <div className="flex items-center justify-end space-x-2">
          <Input
            type="number"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="0.00"
            disabled={updateFeeMutation.isPending}
            hasError={isMissingFee}
            rightElement="PLN"
            className="w-28 text-right font-mono font-bold"
          />
          <Button
            onClick={handleSaveFee}
            disabled={updateFeeMutation.isPending || isFeeUnchanged}
            variant={saveSuccess ? "outline" : "primary"}
            isLoading={updateFeeMutation.isPending}
            className={`min-w-[70px] ${saveSuccess ? "border-emerald-200 text-emerald-700 bg-emerald-50" : ""}`}
          >
            {saveSuccess ? <CheckCircle2 size={14} /> : "Save"}
          </Button>
        </div>
      </td>

      <td className="px-6 py-5 text-right">
        <Button
          variant="outline"
          onClick={() => onDownload(record.id, personName || "Contract", type)}
          disabled={isMissingFee}
          leftIcon={<FileText size={14} aria-hidden="true" />}
          className="w-full sm:w-auto"
        >
          PDF
        </Button>
      </td>
    </tr>
  );
}
