// chorister-hub/components/modals/DocumentUploadModal.tsx
import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, UploadCloud, File, Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import {
  Heading,
  Text,
  Label,
  Caption,
} from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import type {
  DocumentCategoryDTO,
  DocumentRole,
} from "../../types/chorister-hub.dto";

const ROLE_OPTIONS: {
  value: DocumentRole;
  labelKey: string;
  labelDefault: string;
}[] = [
  {
    value: "ARTIST",
    labelKey: "chorister_hub.roles.artist_all",
    labelDefault: "Share with all artists (all logged in)",
  },
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const uploadSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(2000),
  allowed_roles: z.array(z.enum(["ARTIST", "MANAGER", "ADMIN"] as const)),
  order: z.number().int().min(0),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

interface DocumentUploadModalProps {
  isOpen: boolean;
  targetCategory: DocumentCategoryDTO | null;
  onClose: () => void;
  onSubmit: (categoryId: string, formData: FormData) => void;
  isPending: boolean;
}

export const DocumentUploadModal = ({
  isOpen,
  targetCategory,
  onClose,
  onSubmit,
  isPending,
}: DocumentUploadModalProps): React.JSX.Element => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: "",
      description: "",
      allowed_roles: [],
      order: 0,
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setFileError(null);
    if (file && file.size > MAX_FILE_SIZE) {
      setFileError("File exceeds the 50 MB limit.");
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleFormSubmit = (values: UploadFormValues) => {
    if (!selectedFile) {
      setFileError("A file is required.");
      return;
    }
    if (!targetCategory) return;

    const fd = new FormData();
    fd.append("title", values.title);
    fd.append("description", values.description);
    fd.append("order", String(values.order));
    if (values.allowed_roles.includes("ARTIST")) {
      fd.append("allowed_roles", "ARTIST");
    } else {
      fd.append("allowed_roles", "MANAGER");
    }
    fd.append("file", selectedFile);

    onSubmit(targetCategory.id, fd);
  };

  const handleClose = () => {
    reset();
    setSelectedFile(null);
    setFileError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-focus-trap flex items-center justify-center p-4 bg-ethereal-ink/30 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <GlassCard
              variant="ethereal"
              padding="lg"
              className="shadow-glass-ethereal"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <Heading size="xl" className="tracking-tight">
                    {t("chorister_hub.modal.document.title", "Upload document")}
                  </Heading>
                  {targetCategory && (
                    <Caption color="muted" className="block mt-0.5">
                      {t(
                        "chorister_hub.modal.document.into",
                        "Into: {{category}}",
                        {
                          category: targetCategory.name,
                        },
                      )}
                    </Caption>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  aria-label={t("common.close_aria", "Close")}
                >
                  <X size={18} aria-hidden="true" />
                </Button>
              </div>

              <form
                onSubmit={handleSubmit(handleFormSubmit)}
                className="space-y-5"
                noValidate
              >
                <div>
                  <Label className="block mb-1.5">
                    {t("chorister_hub.modal.document.file_label", "File")}
                  </Label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "w-full flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed transition-all",
                      selectedFile
                        ? "border-ethereal-gold/50 bg-ethereal-gold/5"
                        : "border-ethereal-incense/30 hover:border-ethereal-gold/40 hover:bg-ethereal-parchment/30",
                    )}
                  >
                    {selectedFile ? (
                      <>
                        <File
                          size={24}
                          className="text-ethereal-gold"
                          aria-hidden="true"
                        />
                        <Text
                          size="sm"
                          weight="semibold"
                          className="text-ethereal-ink"
                        >
                          {selectedFile.name}
                        </Text>
                        <Caption color="muted">
                          {(selectedFile.size / 1_048_576).toFixed(1)} MB
                        </Caption>
                      </>
                    ) : (
                      <>
                        <UploadCloud
                          size={24}
                          className="text-ethereal-graphite/40"
                          aria-hidden="true"
                        />
                        <Text size="sm" color="muted">
                          {t(
                            "chorister_hub.modal.document.drop_hint",
                            "Click to select a file (max 50 MB)",
                          )}
                        </Text>
                      </>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                  {fileError && (
                    <Text size="xs" color="crimson" className="mt-1">
                      {fileError}
                    </Text>
                  )}
                </div>

                <Input
                  {...register("title")}
                  label={t(
                    "chorister_hub.modal.document.title_label",
                    "Document title",
                  )}
                  error={errors.title?.message}
                  placeholder={t(
                    "chorister_hub.modal.document.title_placeholder",
                    "Foundation Statute (2026 Edition)",
                  )}
                />

                <Textarea
                  {...register("description")}
                  label={t(
                    "chorister_hub.modal.document.description_label",
                    "Description",
                  )}
                  rows={2}
                  placeholder={t(
                    "chorister_hub.modal.document.description_placeholder",
                    "Brief description...",
                  )}
                />

                <div>
                  <Label className="block mb-2">
                    {t(
                      "chorister_hub.modal.document.roles_label",
                      "Override visible roles",
                    )}
                    <Caption color="muted" className="ml-1">
                      (empty = inherit from category)
                    </Caption>
                  </Label>
                  <Controller
                    name="allowed_roles"
                    control={control}
                    render={({ field }) => (
                      <div className="flex gap-3 flex-wrap">
                        {ROLE_OPTIONS.map(
                          ({ value, labelKey, labelDefault }) => {
                            const checked =
                              field.value?.includes(value) ?? false;
                            return (
                              <label
                                key={value}
                                className={cn(
                                  "flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all select-none",
                                  checked
                                    ? "bg-ethereal-gold/5 border-ethereal-gold/50 text-ethereal-ink shadow-sm"
                                    : "bg-ethereal-alabaster/40 border-ethereal-incense/20 text-ethereal-graphite/70 hover:border-ethereal-incense/40 hover:bg-ethereal-alabaster/80",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const currentVal = field.value ?? [];
                                    field.onChange(
                                      e.target.checked
                                        ? [...currentVal, value]
                                        : currentVal.filter((r) => r !== value),
                                    );
                                  }}
                                  className="sr-only"
                                />
                                <div
                                  className={cn(
                                    "w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0",
                                    checked
                                      ? "bg-ethereal-gold border-ethereal-gold text-white"
                                      : "border-ethereal-incense/40 bg-white",
                                  )}
                                >
                                  {checked && (
                                    <Check
                                      size={14}
                                      strokeWidth={3}
                                      aria-hidden="true"
                                    />
                                  )}
                                </div>
                                <Text
                                  size="sm"
                                  weight={checked ? "semibold" : "medium"}
                                  color="inherit"
                                >
                                  {t(labelKey, labelDefault)}
                                </Text>
                              </label>
                            );
                          },
                        )}
                      </div>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-ethereal-incense/15">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    {t("common.cancel", "Cancel")}
                  </Button>
                  <Button type="submit" isLoading={isPending}>
                    {t("chorister_hub.modal.document.submit", "Upload")}
                  </Button>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
