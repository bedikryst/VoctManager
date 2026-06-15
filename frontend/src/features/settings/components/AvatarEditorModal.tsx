/**
 * @file AvatarEditorModal.tsx
 * @description Profile picture editor: drop/select an image, then a circular
 * crop stage (drag to reposition, zoom slider/wheel) before upload. The client
 * exports a square WebP so the network payload is tiny and the conductor sees
 * exactly the framing they'll get; the server re-encodes defensively regardless.
 * @architecture Enterprise SaaS 2026
 * @module features/settings/components/AvatarEditorModal
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { ImageUp, RotateCcw, Trash2, ZoomIn } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { Heading, Text, Caption } from "@/shared/ui/primitives/typography";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { useUploadAvatar, useDeleteAvatar } from "../api/settings.queries";

const VIEWPORT = 288; // px — circular crop stage edge
const OUTPUT = 512; // px — exported square render edge
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ZOOM = 3;

interface AvatarEditorModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly hasAvatar: boolean;
}

interface Transform {
  scale: number; // effective px-per-source-px (cover baseline × zoom)
  base: number; // cover-fit baseline scale
  x: number; // displayed image top-left X relative to viewport
  y: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const AvatarEditorModal = ({
  isOpen,
  onClose,
  hasAvatar,
}: AvatarEditorModalProps): React.ReactPortal | null => {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const { mutateAsync: uploadAvatar, isPending: isUploading } =
    useUploadAvatar();
  const { mutateAsync: deleteAvatar, isPending: isDeleting } =
    useDeleteAvatar();

  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [transform, setTransform] = useState<Transform | null>(null);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(
    null,
  );

  useBodyScrollLock(isOpen);
  useEffect(() => setMounted(true), []);

  const revokeUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    revokeUrl();
    setImageEl(null);
    setTransform(null);
    setError(null);
  }, [revokeUrl]);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  useEffect(() => () => revokeUrl(), [revokeUrl]);

  // ── Position helpers ────────────────────────────────────────────
  const fitTransform = useCallback((img: HTMLImageElement): Transform => {
    const base = Math.max(VIEWPORT / img.naturalWidth, VIEWPORT / img.naturalHeight);
    const dispW = img.naturalWidth * base;
    const dispH = img.naturalHeight * base;
    return {
      base,
      scale: base,
      x: (VIEWPORT - dispW) / 2,
      y: (VIEWPORT - dispH) / 2,
    };
  }, []);

  const withClampedOffsets = useCallback(
    (img: HTMLImageElement, next: Transform): Transform => {
      const dispW = img.naturalWidth * next.scale;
      const dispH = img.naturalHeight * next.scale;
      return {
        ...next,
        x: clamp(next.x, VIEWPORT - dispW, 0),
        y: clamp(next.y, VIEWPORT - dispH, 0),
      };
    },
    [],
  );

  // ── File intake ─────────────────────────────────────────────────
  const loadFile = useCallback(
    (file: File) => {
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError(t("settings.avatar.error_type", "Wybierz plik obrazu (JPG, PNG, WebP)."));
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(t("settings.avatar.error_size", "Plik jest za duży (maks. 8 MB)."));
        return;
      }
      revokeUrl();
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      const img = new Image();
      img.onload = () => {
        setImageEl(img);
        setTransform(fitTransform(img));
      };
      img.onerror = () => {
        setError(t("settings.avatar.error_invalid", "Nie udało się wczytać obrazu."));
        revokeUrl();
      };
      img.src = url;
    },
    [fitTransform, revokeUrl, t],
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) loadFile(accepted[0]);
    },
    [loadFile],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    noClick: true,
    noKeyboard: true,
  });

  // ── Interaction (drag + zoom) ───────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (!transform) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: transform.x, oy: transform.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !transform || !imageEl) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setTransform(
      withClampedOffsets(imageEl, {
        ...transform,
        x: dragRef.current.ox + dx,
        y: dragRef.current.oy + dy,
      }),
    );
  };

  const endDrag = (e: React.PointerEvent) => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const applyZoom = useCallback(
    (zoom: number) => {
      if (!transform || !imageEl) return;
      const nextScale = transform.base * clamp(zoom, 1, MAX_ZOOM);
      // Zoom around the viewport centre so framing stays put.
      const cx = VIEWPORT / 2;
      const cy = VIEWPORT / 2;
      const ratio = nextScale / transform.scale;
      setTransform(
        withClampedOffsets(imageEl, {
          ...transform,
          scale: nextScale,
          x: cx - (cx - transform.x) * ratio,
          y: cy - (cy - transform.y) * ratio,
        }),
      );
    },
    [transform, imageEl, withClampedOffsets],
  );

  const onWheel = (e: React.WheelEvent) => {
    if (!transform) return;
    const currentZoom = transform.scale / transform.base;
    applyZoom(currentZoom - e.deltaY * 0.0015);
  };

  // ── Export + persist ────────────────────────────────────────────
  const handleSave = async () => {
    if (!imageEl || !transform) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Map the visible viewport square back to source-image coordinates.
    const srcX = -transform.x / transform.scale;
    const srcY = -transform.y / transform.scale;
    const srcSize = VIEWPORT / transform.scale;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imageEl, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT, OUTPUT);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.9),
    );
    if (!blob) {
      setError(t("settings.avatar.error_invalid", "Nie udało się przetworzyć obrazu."));
      return;
    }
    try {
      await uploadAvatar(blob);
      onClose();
    } catch {
      setError(t("settings.avatar.error_upload", "Nie udało się zapisać zdjęcia. Spróbuj ponownie."));
    }
  };

  const handleRemove = async () => {
    try {
      await deleteAvatar();
      onClose();
    } catch {
      setError(t("settings.avatar.error_upload", "Nie udało się usunąć zdjęcia. Spróbuj ponownie."));
    }
  };

  if (!mounted) return null;

  const busy = isUploading || isDeleting;
  const currentZoom = transform ? transform.scale / transform.base : 1;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-(--z-toast) flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ethereal-ink/40 backdrop-blur-sm"
            onClick={!busy ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-ethereal-incense/20 bg-ethereal-marble shadow-glass-solid"
            role="dialog"
            aria-modal="true"
          >
            <div className="border-b border-ethereal-incense/10 p-6 pb-4">
              <Heading as="h3" size="lg" weight="bold">
                {t("settings.avatar.title", "Zdjęcie profilowe")}
              </Heading>
              <Text color="muted" size="sm" className="mt-1">
                {imageEl
                  ? t("settings.avatar.crop_hint", "Przeciągnij, aby wykadrować. Przybliż suwakiem.")
                  : t("settings.avatar.pick_hint", "Wybierz kwadratowe zdjęcie dla najlepszego efektu.")}
              </Text>
            </div>

            <div className="flex flex-col items-center gap-5 p-6">
              {!imageEl ? (
                <div
                  {...getRootProps()}
                  onClick={open}
                  className={cn(
                    "flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                    isDragActive
                      ? "border-ethereal-gold bg-ethereal-gold/[0.06]"
                      : "border-ethereal-incense/30 hover:border-ethereal-gold/50 hover:bg-ethereal-alabaster/60",
                  )}
                >
                  <input {...getInputProps()} />
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ethereal-gold/10 text-ethereal-gold">
                    <ImageUp size={24} aria-hidden="true" />
                  </span>
                  <Text weight="medium">
                    {t("settings.avatar.dropzone_title", "Upuść zdjęcie lub kliknij, aby wybrać")}
                  </Text>
                  <Caption color="muted">
                    {t("settings.avatar.dropzone_hint", "JPG, PNG lub WebP — do 8 MB")}
                  </Caption>
                </div>
              ) : (
                <>
                  <div
                    className="relative touch-none overflow-hidden rounded-full border border-ethereal-ink/10 shadow-glass-solid"
                    style={{ width: VIEWPORT, height: VIEWPORT }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onWheel={onWheel}
                    role="application"
                    aria-label={t("settings.avatar.crop_aria", "Obszar kadrowania zdjęcia")}
                  >
                    {transform && (
                      <img
                        src={objectUrlRef.current ?? undefined}
                        alt=""
                        draggable={false}
                        className="pointer-events-none absolute max-w-none origin-top-left select-none"
                        style={{
                          width: imageEl.naturalWidth * transform.scale,
                          height: imageEl.naturalHeight * transform.scale,
                          transform: `translate(${transform.x}px, ${transform.y}px)`,
                        }}
                      />
                    )}
                    <span
                      className="pointer-events-none absolute inset-0 cursor-grab rounded-full ring-1 ring-inset ring-ethereal-marble/40"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="flex w-full items-center gap-3">
                    <ZoomIn size={16} className="shrink-0 text-ethereal-graphite/60" aria-hidden="true" />
                    <input
                      type="range"
                      min={1}
                      max={MAX_ZOOM}
                      step={0.01}
                      value={currentZoom}
                      onChange={(e) => applyZoom(Number(e.target.value))}
                      aria-label={t("settings.avatar.zoom_aria", "Przybliżenie")}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ethereal-ink/10 accent-ethereal-gold"
                    />
                    <button
                      type="button"
                      onClick={reset}
                      title={t("settings.avatar.change_photo", "Zmień zdjęcie")}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ethereal-graphite/60 transition-colors hover:bg-ethereal-ink/[0.04] hover:text-ethereal-ink"
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                    </button>
                  </div>
                </>
              )}

              {error && (
                <Text size="sm" color="crimson" align="center">
                  {error}
                </Text>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-ethereal-incense/10 bg-ethereal-alabaster px-6 py-4">
              {hasAvatar ? (
                <Button
                  variant="ghost"
                  onClick={handleRemove}
                  isLoading={isDeleting}
                  disabled={busy}
                  leftIcon={!isDeleting ? <Trash2 size={14} aria-hidden="true" /> : undefined}
                  className="text-ethereal-crimson hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
                >
                  {t("settings.avatar.remove", "Usuń zdjęcie")}
                </Button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={onClose} disabled={busy}>
                  {t("common.actions.cancel", "Anuluj")}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  isLoading={isUploading}
                  disabled={!imageEl || busy}
                >
                  {t("settings.avatar.save", "Zapisz zdjęcie")}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
