/**
 * @file CalendarSubscribeLinks.tsx
 * @description One subscribed calendar's ways in: the one-tap subscribe row
 * (Google's render intent, `webcal://` for Apple and Outlook) and the raw https
 * address with a copy button. Shared by the personal feed and the manager's
 * whole-season feed, which differ here in the address and nothing else.
 * @architecture Enterprise SaaS 2026
 * @module features/settings/components/CalendarSubscribeLinks
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarPlus, CheckCircle2, Copy } from "lucide-react";

import { Button } from "@ui/primitives/Button";
import { Input } from "@ui/primitives/Input";
import { Eyebrow } from "@ui/primitives/typography";

interface CalendarSubscribeLinksProps {
  /** The feed's https address; empty while the account has none yet. */
  url: string;
  /** Names the address field, on screen and for assistive technology. */
  urlLabel: string;
}

export const CalendarSubscribeLinks = ({
  url,
  urlLabel,
}: CalendarSubscribeLinksProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  // `webcal://` and nothing else. iOS registers no `webcals://` handler — Safari
  // answers a link carrying it with "the address is invalid" and never reaches
  // Calendar. (An earlier probe against an iCloud host appeared to prove the
  // opposite; Apple's own domain opens Apple's own app whatever the scheme, so
  // the probe measured the host, not the scheme.) The tap therefore still goes
  // through the cleartext hop this scheme is defined as, which is why the iPhone
  // route is the address rather than this button.
  const webcalUrl = url.replace(/^https?:\/\//, "webcal://");
  const googleUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable in insecure contexts
    }
  };

  return (
    <>
      {url && (
        <div className="mb-6 space-y-2">
          <Eyebrow>
            {t(
              "settings.integrations.quick_title",
              "Subskrybuj jednym dotknięciem",
            )}
          </Eyebrow>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button asChild variant="secondary" className="sm:shrink-0">
              <a href={googleUrl} target="_blank" rel="noopener noreferrer">
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                {t("settings.integrations.quick_google", "Google Kalendarz")}
              </a>
            </Button>
            <Button asChild variant="secondary" className="sm:shrink-0">
              <a href={webcalUrl}>
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                {t("settings.integrations.quick_apple", "Apple / Outlook")}
              </a>
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Eyebrow>{urlLabel}</Eyebrow>
        <div className="flex flex-col gap-2.5 md:flex-row">
          <Input readOnly value={url} aria-label={urlLabel} />
          <Button
            onClick={handleCopy}
            variant="outline"
            className="shrink-0"
            leftIcon={
              copied ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )
            }
          >
            {copied
              ? t("settings.integrations.copied", "Skopiowano!")
              : t("settings.integrations.copy_link", "Kopiuj link")}
          </Button>
        </div>
      </div>
    </>
  );
};
