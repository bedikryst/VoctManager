// chorister-hub/components/modals/CategoryFormModal.tsx
import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  X,
  Check,
  BookOpen,
  Shirt,
  FileText,
  Shield,
  HeartPulse,
  Music,
  Users,
  Briefcase,
  MapPin,
  Landmark,
  GraduationCap,
  ScrollText,
  Scale,
  Mic2,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Heading, Text, Label } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import type {
  DocumentCategoryDTO,
  DocumentIconKey,
  DocumentRole,
} from "../../types/chorister-hub.dto";

const ICON_OPTIONS: DocumentIconKey[] = [
  "BookOpen",
  "Shirt",
  "FileText",
  "Shield",
  "HeartPulse",
  "Music",
  "Users",
  "Briefcase",
  "MapPin",
  "Landmark",
  "GraduationCap",
  "ScrollText",
  "Scale",
  "Mic2",
];

const ICON_MAP: Record<DocumentIconKey, LucideIcon> = {
  BookOpen,
  Shirt,
  FileText,
  Shield,
  HeartPulse,
  Music,
  Users,
  Briefcase,
  MapPin,
  Landmark,
  GraduationCap,
  ScrollText,
  Scale,
  Mic2,
};

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

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  description: z.string().max(2000),
  icon_key: z.enum([
    "BookOpen",
    "Shirt",
    "FileText",
    "Shield",
    "HeartPulse",
    "Music",
    "Users",
    "Briefcase",
    "MapPin",
    "Landmark",
    "GraduationCap",
    "ScrollText",
    "Scale",
    "Mic2",
  ] as const),
  allowed_roles: z
    .array(z.enum(["ARTIST", "MANAGER", "ADMIN"] as const)),
  order: z.number().int().min(0),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryFormModalProps {
  isOpen: boolean;
  editingCategory: DocumentCategoryDTO | null;
  onClose: () => void;
  onSubmit: (values: CategoryFormValues, editId?: string) => void;
  isPending: boolean;
}

export const CategoryFormModal = ({
  isOpen,
  editingCategory,
  onClose,
  onSubmit,
  isPending,
}: CategoryFormModalProps): React.JSX.Element => {
  const { t } = useTranslation();
  const isEditing = editingCategory != null;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: "",
      icon_key: "BookOpen",
      allowed_roles: ["ARTIST"],
      order: 0,
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset(
        editingCategory
          ? {
              name: editingCategory.name,
              description: editingCategory.description,
              icon_key: editingCategory.icon_key,
              allowed_roles: editingCategory.allowed_roles,
              order: editingCategory.order,
            }
          : {
              name: "",
              description: "",
              icon_key: "BookOpen",
              allowed_roles: ["ARTIST"],
              order: 0,
            },
      );
    }
  }, [isOpen, editingCategory, reset]);

  const handleFormSubmit = (values: CategoryFormValues) => {
    const finalRoles = values.allowed_roles.includes("ARTIST") ? ["ARTIST"] : ["MANAGER"];
    onSubmit({ ...values, allowed_roles: finalRoles as any }, editingCategory?.id);
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
          onClick={onClose}
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
                <Heading size="xl" className="tracking-tight">
                  {isEditing
                    ? t(
                        "chorister_hub.modal.category.title_edit",
                        "Edit category",
                      )
                    : t(
                        "chorister_hub.modal.category.title_create",
                        "New category",
                      )}
                </Heading>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
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
                <Input
                  {...register("name")}
                  label={t(
                    "chorister_hub.modal.category.name_label",
                    "Category name",
                  )}
                  error={errors.name?.message}
                  placeholder={t(
                    "chorister_hub.modal.category.name_placeholder",
                    "Foundation Statute",
                  )}
                />

                <Textarea
                  {...register("description")}
                  label={t(
                    "chorister_hub.modal.category.description_label",
                    "Description",
                  )}
                  rows={2}
                  placeholder={t(
                    "chorister_hub.modal.category.description_placeholder",
                    "Brief description of the category contents...",
                  )}
                />

                <div>
                  <Label className="block mb-2">
                    {t("chorister_hub.modal.category.icon_label", "Icon")}
                  </Label>
                  <Controller
                    name="icon_key"
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-wrap gap-2">
                        {ICON_OPTIONS.map((key) => {
                          const IconComponent = ICON_MAP[key];
                          return (
                            <Button
                              key={key}
                              type="button"
                              size="icon"
                              variant={
                                field.value === key ? "primary" : "outline"
                              }
                              onClick={() => field.onChange(key)}
                              aria-label={key}
                              className={cn(
                                field.value === key &&
                                  "ring-2 ring-ethereal-gold/30 ring-offset-1",
                              )}
                            >
                              <IconComponent size={18} aria-hidden="true" />
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  />
                </div>

                <div>
                  <Label className="block mb-2">
                    {t(
                      "chorister_hub.modal.category.roles_label",
                      "Visible to roles",
                    )}
                  </Label>
                  <Controller
                    name="allowed_roles"
                    control={control}
                    render={({ field }) => (
                      <div className="flex gap-3 flex-wrap">
                        {ROLE_OPTIONS.map(
                          ({ value, labelKey, labelDefault }) => {
                            const checked = field.value.includes(value);
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
                                    field.onChange(
                                      e.target.checked
                                        ? [...field.value, value]
                                        : field.value.filter(
                                            (r) => r !== value,
                                          ),
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
                  {errors.allowed_roles && (
                    <Text size="xs" color="crimson" className="mt-1">
                      {errors.allowed_roles.message}
                    </Text>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-ethereal-incense/15">
                  <Button type="button" variant="outline" onClick={onClose}>
                    {t("common.cancel", "Cancel")}
                  </Button>
                  <Button type="submit" isLoading={isPending}>
                    {isEditing
                      ? t("common.save_changes", "Save changes")
                      : t("common.create", "Create")}
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
