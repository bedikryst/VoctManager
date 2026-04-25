import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X, Send, AlertTriangle, Info } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Heading, Text } from "@/shared/ui/primitives/typography";
import { useSendToArtist } from "@/features/notifications/api/notifications.queries";
import type { Artist } from "@/shared/types";

const schema = z.object({
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(2000),
  level: z.enum(["INFO", "WARNING", "URGENT"]),
  cta_url: z.string().url().max(500).optional().or(z.literal("")),
  cta_label: z.string().max(80).optional(),
});

type FormValues = z.infer<typeof schema>;

interface SendNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  artist: Artist;
}

const LEVEL_OPTIONS: {
  value: FormValues["level"];
  labelKey: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "INFO",
    labelKey: "notifications.send_modal.level_info",
    icon: <Info size={14} className="text-ethereal-amethyst" />,
  },
  {
    value: "WARNING",
    labelKey: "notifications.send_modal.level_warning",
    icon: <AlertTriangle size={14} className="text-ethereal-gold" />,
  },
  {
    value: "URGENT",
    labelKey: "notifications.send_modal.level_urgent",
    icon: <AlertTriangle size={14} className="text-ethereal-crimson" />,
  },
];

const STYLE_LABEL =
  "block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";
const STYLE_TEXTAREA =
  "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] resize-none";

export const SendNotificationModal: React.FC<SendNotificationModalProps> = ({
  isOpen,
  onClose,
  artist,
}) => {
  const { t } = useTranslation();
  const { mutate: sendToArtist, isPending } = useSendToArtist();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { level: "INFO" },
  });

  const selectedLevel = watch("level");

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = (values: FormValues) => {
    sendToArtist(
      {
        artist_id: artist.id,
        title: values.title,
        message: values.message,
        level: values.level,
        cta_url: values.cta_url || null,
        cta_label: values.cta_label || null,
      },
      {
        onSuccess: () => {
          toast.success(
            t("notifications.send_modal.success", {
              name: `${artist.first_name} ${artist.last_name}`,
            }),
          );
          handleClose();
        },
        onError: () => {
          toast.error(t("notifications.send_modal.error"));
        },
      },
    );
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-ethereal-ink/40 backdrop-blur-sm z-(--z-toast)"
            onClick={handleClose}
          />

          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-9999 flex items-center justify-center p-4 pointer-events-none"
          >
            <GlassCard
              isHoverable={false}
              className="w-full max-w-lg pointer-events-auto"
            >
              <form onSubmit={handleSubmit(onSubmit)}>
                {/* Header */}
                <div className="flex items-start justify-between p-6 pb-0">
                  <div>
                    <Heading as="h4" size="xl" color="graphite">
                      {t(
                        "notifications.send_modal.heading",
                        "Wyślij powiadomienie",
                      )}
                    </Heading>
                    <Text
                      size="sm"
                      color="graphite"
                      className="opacity-60 mt-1"
                    >
                      {artist.first_name} {artist.last_name}
                    </Text>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="p-2 rounded-lg hover:bg-black/5 transition-colors text-stone-400"
                    aria-label={t("common.close", "Zamknij")}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-4">
                  {/* Level selector */}
                  <div>
                    <p className={STYLE_LABEL}>
                      {t("notifications.send_modal.level", "Poziom ważności")}
                    </p>
                    <div className="flex gap-2">
                      {LEVEL_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setValue("level", opt.value)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                            selectedLevel === opt.value
                              ? "bg-ethereal-ink text-white border-ethereal-ink"
                              : "bg-white/40 text-stone-600 border-stone-200/60 hover:bg-white/70"
                          }`}
                        >
                          {opt.icon}
                          {t(opt.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className={STYLE_LABEL}>
                      {t("notifications.send_modal.title")}
                    </label>
                    <Input
                      {...register("title")}
                      placeholder={t(
                        "notifications.send_modal.title_placeholder",
                      )}
                      error={!!errors.title}
                    />
                    {errors.title && (
                      <Text
                        size="xs"
                        className="text-ethereal-crimson mt-1 ml-1"
                      >
                        {errors.title.message}
                      </Text>
                    )}
                  </div>

                  {/* Message */}
                  <div>
                    <label className={STYLE_LABEL}>
                      {t("notifications.send_modal.message")}
                    </label>
                    <textarea
                      {...register("message")}
                      rows={5}
                      placeholder={t(
                        "notifications.send_modal.message_placeholder",
                      )}
                      className={STYLE_TEXTAREA}
                    />
                    {errors.message && (
                      <Text
                        size="xs"
                        className="text-ethereal-crimson mt-1 ml-1"
                      >
                        {errors.message.message}
                      </Text>
                    )}
                  </div>

                  {/* Optional CTA */}
                  <details className="group">
                    <summary className="cursor-pointer list-none flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-stone-600 transition-colors select-none ml-1">
                      <span className="group-open:rotate-90 transition-transform inline-block">
                        ▶
                      </span>
                      {t("notifications.send_modal.cta_optional")}
                    </summary>
                    <div className="mt-3 flex flex-col gap-3 pl-3 border-l border-stone-200/60">
                      <div>
                        <label className={STYLE_LABEL}>
                          {t("notifications.send_modal.cta_url")}
                        </label>
                        <Input
                          {...register("cta_url")}
                          placeholder="https://..."
                          error={!!errors.cta_url}
                        />
                      </div>
                      <div>
                        <label className={STYLE_LABEL}>
                          {t("notifications.send_modal.cta_label")}
                        </label>
                        <Input
                          {...register("cta_label")}
                          placeholder={t(
                            "notifications.send_modal.cta_label_placeholder",
                          )}
                        />
                      </div>
                    </div>
                  </details>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-0">
                  <Button variant="ghost" type="button" onClick={handleClose}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-2"
                  >
                    <Send size={14} />
                    {isPending
                      ? t("notifications.send_modal.sending")
                      : t("notifications.send_modal.send")}
                  </Button>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};
