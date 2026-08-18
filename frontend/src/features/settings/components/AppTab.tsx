/**
 * @file AppTab.tsx
 * @description "Aplikacja" settings pane: a deterministic, always-available home
 * for installing VoctManager to the device — independent of the ambient nudge
 * card, which is best-effort by nature. Resolves every platform case (installed
 * / one-tap Chromium / the four Apple routes to the home screen / other
 * browsers) and lets users hand the app to the ensemble via link, native share
 * sheet, or a scannable QR.
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
  ExternalLink,
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
import type { AppleInstallGuide } from "@/shared/pwa/platform";
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
  <div className="flex items-center gap-2.5 rounded-control border border-hairline-strong bg-white/40 px-3 py-2.5">
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

const Step = ({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}): React.JSX.Element => (
  <li className="flex items-start gap-2.5">
    <Icon
      size={15}
      className="mt-0.5 shrink-0 text-ethereal-gold"
      aria-hidden="true"
    />
    <Text size="sm" color="graphite">
      {children}
    </Text>
  </li>
);

/**
 * The manual route to the home screen, told for the app the member is actually
 * holding. Since iOS 16.4 every real browser reaches it through the same share
 * sheet; what differs is where the Share button sits — the top toolbar on an
 * iPad, under "•••" in the compact layout iOS 26 made the iPhone default, in
 * the address bar in Chrome (where the entry also sits further down the sheet).
 * Only a WebView embedded in Messenger or Gmail has no route at all. Each
 * variant closes with a fallback, because the detection is user-agent sniffing
 * and iPadOS desktop mode can still make Chrome look like Safari.
 */
const AppleInstallCard = ({
  guide,
}: {
  guide: AppleInstallGuide;
}): React.JSX.Element => {
  const { t } = useTranslation();

  if (guide === "in-app") {
    return (
      <div className="space-y-3 rounded-nested border border-hairline-strong bg-white/40 p-4">
        <Text weight="medium">
          {t("settings.app.in_app.title", "Otwórz stronę w Safari")}
        </Text>
        <Text size="sm" color="muted">
          {t(
            "settings.app.in_app.desc",
            "Ta strona działa w okienku wbudowanym w inną aplikację (np. Messenger, Gmail). Taka przeglądarka nie potrafi dodać aplikacji do ekranu początkowego.",
          )}
        </Text>
        <ol className="space-y-2.5">
          <Step icon={ExternalLink}>
            {t(
              "settings.app.in_app.step_1",
              "Dotknij „•••” w rogu okna i wybierz „Otwórz w Safari”",
            )}
          </Step>
          <Step icon={SquarePlus}>
            {t(
              "settings.app.in_app.step_2",
              "W Safari dodaj aplikację do ekranu początkowego",
            )}
          </Step>
        </ol>
      </div>
    );
  }

  if (guide === "other-browser") {
    return (
      <div className="space-y-3 rounded-nested border border-hairline-strong bg-white/40 p-4">
        <Text weight="medium">
          {t("settings.app.apple_other.title", "Dodaj do ekranu początkowego")}
        </Text>
        <ol className="space-y-2.5">
          <Step icon={Share}>
            {t(
              "settings.app.apple_other.step_1",
              "Dotknij ikony Udostępnij w pasku adresu",
            )}
          </Step>
          <Step icon={SquarePlus}>
            {t(
              "settings.app.apple_other.step_2",
              "Wybierz „Do ekranu początkowego” — bywa niżej na liście, przewiń arkusz",
            )}
          </Step>
          <Step icon={Check}>
            {t(
              "settings.app.apple_other.step_3",
              "Potwierdź — ikona pojawi się na ekranie początkowym",
            )}
          </Step>
        </ol>
        <Caption as="p" color="muted">
          {t(
            "settings.app.apple_other.hint",
            "Nie ma tej pozycji? Otwórz ten adres w Safari — tam dodawanie jest zawsze dostępne.",
          )}
        </Caption>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-nested border border-hairline-strong bg-white/40 p-4">
      <Text weight="medium">
        {t("settings.app.ios.title", "Dodaj do ekranu początkowego")}
      </Text>
      <ol className="space-y-2.5">
        <Step icon={Share}>
          {/* An iPad keeps Share on the top toolbar; on iPhone the compact
              layout iOS 26 defaults to hides it under "•••" by the address
              bar. Pointing at the wrong edge is as good as no instruction. */}
          {guide === "safari-ipad"
            ? t(
                "settings.app.ios.step_1_tablet",
                "Dotknij ikony Udostępnij na górnym pasku, obok adresu",
              )
            : t(
                "settings.app.ios.step_1",
                "Dotknij ikony Udostępnij przy pasku adresu — w układzie kompaktowym kryje się pod „•••”",
              )}
        </Step>
        <Step icon={SquarePlus}>
          {t("settings.app.ios.step_2", "Wybierz „Do ekranu początkowego”")}
        </Step>
        <Step icon={Check}>
          {t(
            "settings.app.ios.step_3",
            "Potwierdź — ikona pojawi się na ekranie początkowym",
          )}
        </Step>
      </ol>
      <Caption as="p" color="muted">
        {t(
          "settings.app.ios.hint",
          "Nie widzisz ikony Udostępnij? Rozwiń „•••” (Więcej) — albo w Ustawieniach → Aplikacje → Safari → Karty wybierz układ „Dół” lub „Góra”.",
        )}
      </Caption>
    </div>
  );
};

export const AppTab = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { canPrompt, isIOS, appleGuide, isInstalled, promptInstall } =
    useInstallPrompt();
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
          <div className="flex items-center gap-3 rounded-nested border border-ethereal-gold/30 bg-ethereal-gold/6 p-4">
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
          <div className="flex flex-col gap-4 rounded-nested border border-ethereal-gold/25 bg-ethereal-gold/5 p-4 sm:flex-row sm:items-center sm:justify-between">
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
        ) : isIOS && appleGuide !== null ? (
          <AppleInstallCard guide={appleGuide} />
        ) : (
          <div className="space-y-2 rounded-nested border border-hairline-strong bg-white/40 p-4">
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
            <div className="flex items-center gap-2 rounded-control border border-hairline-strong bg-white/50 px-3 py-2.5">
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
            <div className="rounded-nested border border-hairline-strong bg-white p-3 shadow-sm">
              <Suspense
                fallback={
                  <div
                    className="animate-pulse rounded-control bg-ethereal-ink/5"
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
