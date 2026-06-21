/**
 * @file AppTab.tsx
 * @description "Aplikacja" settings pane: a deterministic, always-available home
 * for installing VoctManager to the device — independent of the ambient nudge
 * card, which is best-effort by nature. Resolves every platform case (installed
 * / one-tap Chromium / iOS Add-to-Home-Screen / other browsers) and lets users
 * hand the app to the ensemble via link, native share sheet, or a scannable QR.
 * @architecture Enterprise SaaS 2026
 * @module features/settings/components/AppTab
 */
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  Link2,
  Maximize2,
  Share,
  Share2,
  Smartphone,
  SquarePlus,
  WifiOff,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { GlassCard } from "@ui/composites/GlassCard";
import { SectionHeader } from "@ui/composites/SectionHeader";
import { Button } from "@ui/primitives/Button";
import { Text, Caption } from "@ui/primitives/typography";
import { useInstallPrompt } from "@/shared/pwa/useInstallPrompt";

const InstallQrCode = lazy(() =>
  import("./InstallQrCode").then((m) => ({ default: m.InstallQrCode })),
);

const COPIED_RESET_MS = 2000;

const Benefit = ({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}): React.JSX.Element => (
  <div className="flex items-center gap-2.5 rounded-xl border border-ethereal-ink/8 bg-white/40 px-3 py-2.5">
    <Icon
      className="h-4 w-4 shrink-0 text-ethereal-gold"
      strokeWidth={1.5}
      aria-hidden="true"
    />
    <Text size="sm" color="graphite" className="leading-snug">
      {label}
    </Text>
  </div>
);

export const AppTab = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { canPrompt, isIOS, isInstalled, promptInstall } = useInstallPrompt();
  const [justCopied, setJustCopied] = useState(false);

  // start_url of the installable app (the manifest scope entry point). Sharing
  // root "/" would land on the public marketing site, not the app.
  const appUrl = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}/panel`
        : "/panel",
    [],
  );
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setJustCopied(true);
      window.setTimeout(() => setJustCopied(false), COPIED_RESET_MS);
      toast.success(t("settings.app.share.copied", "Skopiowano link"));
    } catch {
      toast.error(
        t("settings.app.share.copy_failed", "Nie udało się skopiować linku"),
      );
    }
  }, [appUrl, t]);

  const shareLink = useCallback(() => {
    void navigator
      .share({
        title: t("settings.app.share.share_title", "VoctManager"),
        text: t(
          "settings.app.share.share_text",
          "Panel chóru VoctEnsemble — harmonogram, nuty i obecności.",
        ),
        url: appUrl,
      })
      .catch(() => {
        /* user cancelled the share sheet — not an error */
      });
  }, [appUrl, t]);

  return (
    <div className="space-y-6">
      {/* ── INSTALL ─────────────────────────────────── */}
      <GlassCard variant="light" isHoverable={false}>
        <SectionHeader
          title={t("settings.app.title", "Aplikacja")}
          icon={<Smartphone className="h-5 w-5" />}
        />
        <Text color="muted" className="mb-6 mt-1">
          {t(
            "settings.app.subtitle",
            "Zainstaluj VoctManager na urządzeniu — pełny ekran, błyskawiczny dostęp i ćwiczenia offline. Działa na telefonie, tablecie i komputerze.",
          )}
        </Text>

        {isInstalled ? (
          <div className="flex items-center gap-3 rounded-2xl border border-ethereal-gold/30 bg-ethereal-gold/[0.06] p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ethereal-gold/15 text-ethereal-gold">
              <Check className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <Text weight="medium">
                {t("settings.app.installed.title", "Aplikacja jest zainstalowana")}
              </Text>
              <Text size="sm" color="muted">
                {t(
                  "settings.app.installed.desc",
                  "Uruchamiasz VoctManager jako aplikację na tym urządzeniu.",
                )}
              </Text>
            </div>
          </div>
        ) : canPrompt ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-ethereal-gold/25 bg-ethereal-gold/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ethereal-gold/15 text-ethereal-gold">
                <Download className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <Text weight="medium">
                  {t("settings.app.install_ready", "Gotowe do instalacji")}
                </Text>
                <Text size="sm" color="muted">
                  {t(
                    "settings.app.install_ready_desc",
                    "Jedno dotknięcie dodaje VoctManager do tego urządzenia.",
                  )}
                </Text>
              </div>
            </div>
            <Button
              variant="primary"
              size="touch"
              leftIcon={<Download size={15} aria-hidden="true" />}
              onClick={() => void promptInstall()}
              className="w-full shrink-0 sm:w-auto"
            >
              {t("settings.app.install_action", "Zainstaluj aplikację")}
            </Button>
          </div>
        ) : isIOS ? (
          <div className="space-y-3 rounded-2xl border border-ethereal-ink/8 bg-white/40 p-4">
            <Text weight="medium">
              {t("settings.app.ios.title", "Dodaj do ekranu początkowego")}
            </Text>
            <ol className="space-y-2.5">
              <li className="flex items-center gap-2.5">
                <Share
                  size={15}
                  className="shrink-0 text-ethereal-gold"
                  aria-hidden="true"
                />
                <Text size="sm" color="graphite">
                  {t(
                    "settings.app.ios.step_1",
                    "Dotknij ikony Udostępnij na dolnym pasku Safari",
                  )}
                </Text>
              </li>
              <li className="flex items-center gap-2.5">
                <SquarePlus
                  size={15}
                  className="shrink-0 text-ethereal-gold"
                  aria-hidden="true"
                />
                <Text size="sm" color="graphite">
                  {t("settings.app.ios.step_2", "Wybierz „Do ekranu początkowego”")}
                </Text>
              </li>
              <li className="flex items-center gap-2.5">
                <Check
                  size={15}
                  className="shrink-0 text-ethereal-gold"
                  aria-hidden="true"
                />
                <Text size="sm" color="graphite">
                  {t(
                    "settings.app.ios.step_3",
                    "Potwierdź — ikona pojawi się na ekranie telefonu",
                  )}
                </Text>
              </li>
            </ol>
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-ethereal-ink/8 bg-white/40 p-4">
            <Text weight="medium">
              {t("settings.app.other.title", "Instalacja w tej przeglądarce")}
            </Text>
            <Text size="sm" color="muted">
              {t(
                "settings.app.other.desc",
                "Aby zainstalować aplikację, otwórz ten adres w Chrome lub Edge — albo na telefonie. Link do wysłania znajdziesz poniżej.",
              )}
            </Text>
          </div>
        )}

        {!isInstalled && (
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Benefit
              icon={Maximize2}
              label={t("settings.app.benefits.fullscreen", "Pełny ekran, bez paska przeglądarki")}
            />
            <Benefit
              icon={WifiOff}
              label={t("settings.app.benefits.offline", "Nuty i obecności także offline")}
            />
            <Benefit
              icon={Zap}
              label={t("settings.app.benefits.fast", "Ikona na ekranie — jak zwykła aplikacja")}
            />
          </div>
        )}
      </GlassCard>

      {/* ── SHARE ───────────────────────────────────── */}
      <GlassCard variant="light" isHoverable={false}>
        <SectionHeader
          title={t("settings.app.share.title", "Udostępnij aplikację")}
          icon={<Share2 className="h-5 w-5" />}
        />
        <Text color="muted" className="mb-5 mt-1">
          {t(
            "settings.app.share.subtitle",
            "Wyślij link chórzystom albo pokaż kod QR na próbie — wystarczy zeskanować telefonem.",
          )}
        </Text>

        <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-ethereal-ink/10 bg-white/50 px-3 py-2.5">
              <Link2
                size={15}
                className="shrink-0 text-ethereal-graphite/50"
                aria-hidden="true"
              />
              <span className="truncate font-mono text-sm text-ethereal-graphite">
                {appUrl}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={
                  justCopied ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )
                }
                onClick={() => void copyLink()}
              >
                {justCopied
                  ? t("settings.app.share.copied_short", "Skopiowano")
                  : t("settings.app.share.copy", "Kopiuj link")}
              </Button>
              {canShare && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Share size={14} aria-hidden="true" />}
                  onClick={shareLink}
                >
                  {t("settings.app.share.share", "Udostępnij")}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 justify-self-center sm:justify-self-end">
            <div className="rounded-2xl border border-ethereal-ink/10 bg-white p-3 shadow-sm">
              <Suspense
                fallback={
                  <div
                    className="animate-pulse rounded-lg bg-ethereal-ink/5"
                    style={{ height: 156, width: 156 }}
                    aria-hidden="true"
                  />
                }
              >
                <InstallQrCode url={appUrl} size={156} />
              </Suspense>
            </div>
            <Caption color="muted">
              {t("settings.app.share.qr_hint", "Zeskanuj telefonem")}
            </Caption>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
