/**
 * @file InstallQrCode.tsx
 * @description Lazily-rendered QR encoding of the app URL so a chorister can
 * scan it (e.g. off a screen at rehearsal) to open and install VoctManager. The
 * `qrcode` encoder is dynamically imported here, so it stays out of the panel
 * shell — and even out of the settings chunk — until this pane is opened. The QR
 * is a pure enhancement: if encoding fails, the copy/share link remain.
 * @module features/settings/components/InstallQrCode
 */
import { useEffect, useState } from "react";

interface InstallQrCodeProps {
  readonly url: string;
  readonly size?: number;
}

export const InstallQrCode = ({
  url,
  size = 156,
}: InstallQrCodeProps): React.JSX.Element => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void import("qrcode")
      .then((mod) =>
        mod.toDataURL(url, {
          margin: 1,
          width: size * 2, // render at 2× for a crisp result on hi-dpi screens
          errorCorrectionLevel: "M",
          color: { dark: "#1c1917", light: "#ffffff" },
        }),
      )
      .then((src) => {
        if (active) setDataUrl(src);
      })
      .catch(() => {
        /* enhancement only — the copy/share link is the primary path */
      });
    return () => {
      active = false;
    };
  }, [url, size]);

  if (!dataUrl) {
    return (
      <div
        className="animate-pulse rounded-lg bg-ethereal-ink/5"
        style={{ height: size, width: size }}
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt=""
      width={size}
      height={size}
      className="rounded-lg"
    />
  );
};
