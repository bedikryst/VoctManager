/**
 * @file ProjectInvitationsSheet.tsx
 * @description Drill-down for one production's invitation roster: who has
 * confirmed, who is still pending and who declined — with one-tap mail/phone to
 * chase the stragglers — plus a link straight into the project hub. Opened from a
 * ProductionPipeline row, in the same bottom-sheet language as the rest of the app.
 * @module panel/dashboard/components/ProjectInvitationsSheet
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Clock,
  Mail,
  Phone,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { cn } from "@/shared/lib/utils";
import {
  useProjectInvitations,
  type InvitationRosterRow,
} from "../hooks/useProjectInvitations";

interface ProjectInvitationsSheetProps {
  projectId: string | null;
  projectTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

type GroupTone = "gold" | "sage" | "graphite";

interface ToneStyle {
  headerBg: string;
  headerBorder: string;
  bodyBorder: string;
  text: string;
}

// Static class strings (Tailwind can't see interpolated tokens). Each group is a
// self-contained card: a tinted, coloured header band + a bordered body, so the
// boundary between Oczekują / Potwierdzili / Odmówili is unmissable without
// tinting every name (which would fight legibility).
const TONE: Record<GroupTone, ToneStyle> = {
  gold: {
    headerBg: "bg-ethereal-gold/12",
    headerBorder: "border-ethereal-gold/30",
    bodyBorder: "border-ethereal-gold/20",
    text: "text-ethereal-gold",
  },
  sage: {
    headerBg: "bg-ethereal-sage/12",
    headerBorder: "border-ethereal-sage/30",
    bodyBorder: "border-ethereal-sage/20",
    text: "text-ethereal-sage",
  },
  graphite: {
    headerBg: "bg-ethereal-graphite/8",
    headerBorder: "border-ethereal-graphite/20",
    bodyBorder: "border-ethereal-graphite/15",
    text: "text-ethereal-graphite/70",
  },
};

/**
 * Three ranks and no more: the name at the panel's body size, the addresses one
 * step under it, and the absence of an address quieter still. The row used to
 * set a name at 16px bold — louder than anything else on the sheet — over a
 * contact line that was a raw 14px span, so a name and its own e-mail sat 2px
 * apart while "no contact" (10px) and an e-mail (14px) filled the same slot at
 * wildly different weights on adjacent rows.
 */
const RosterRow = ({ row }: { row: InvitationRosterRow }): React.JSX.Element => {
  const { t } = useTranslation();
  const hasContact = Boolean(row.email || row.phone);

  return (
    <li className="border-b border-hairline py-2.5 last:border-0">
      <div className="flex items-baseline justify-between gap-2">
        <Text size="base" weight="semibold" truncate className="min-w-0">
          {row.name}
        </Text>
        {row.voice && (
          <Eyebrow size="overline-sm" color="muted" className="shrink-0">
            {row.voice}
          </Eyebrow>
        )}
      </div>

      {hasContact ? (
        <div className="mt-1 flex flex-col gap-0.5">
          {row.email && (
            <a
              href={`mailto:${row.email}`}
              className="group/c inline-flex items-center gap-2 text-ethereal-graphite transition-colors hover:text-ethereal-sage"
            >
              <Mail
                size={12}
                className="shrink-0 text-ethereal-graphite/45 transition-colors group-hover/c:text-ethereal-sage"
                aria-hidden="true"
              />
              <Text as="span" size="sm" color="inherit" className="break-all">
                {row.email}
              </Text>
            </a>
          )}
          {row.phone && (
            <a
              href={`tel:${row.phone}`}
              className="group/c inline-flex items-center gap-2 text-ethereal-graphite transition-colors hover:text-ethereal-sage"
            >
              <Phone
                size={12}
                className="shrink-0 text-ethereal-graphite/45 transition-colors group-hover/c:text-ethereal-sage"
                aria-hidden="true"
              />
              <Text as="span" size="sm" color="inherit" className="tabular-nums">
                {row.phone}
              </Text>
            </a>
          )}
        </div>
      ) : (
        <Caption className="mt-1 block italic">
          {t("dashboard.admin.roster.no_contact", "Brak danych kontaktowych")}
        </Caption>
      )}
    </li>
  );
};

const RosterGroup = ({
  rows,
  label,
  tone,
  Icon,
}: {
  rows: InvitationRosterRow[];
  label: string;
  tone: GroupTone;
  Icon: typeof UserCheck;
}): React.JSX.Element | null => {
  if (rows.length === 0) return null;
  const c = TONE[tone];
  return (
    <section className="mt-4 first:mt-0">
      <div
        className={cn(
          "flex items-center justify-between rounded-t-nested border px-4 py-2",
          c.headerBg,
          c.headerBorder,
        )}
      >
        <div className={cn("flex items-center gap-2", c.text)}>
          <Icon size={14} aria-hidden="true" />
          <Eyebrow as="h3" size="overline-sm" color="inherit">
            {label}
          </Eyebrow>
        </div>
        {/* How many people are in the group is a measurement, not a status, so
            it is plain type in the group's own tone — a filled chip inside an
            already-tinted band is a second surface saying the same thing. */}
        <Text as="span" size="sm" weight="semibold" className={cn("tabular-nums", c.text)}>
          {rows.length}
        </Text>
      </div>
      <ul className={cn("rounded-b-nested border border-t-0 bg-white/40 px-4", c.bodyBorder)}>
        {rows.map((row) => (
          <RosterRow key={row.id} row={row} />
        ))}
      </ul>
    </section>
  );
};

export const ProjectInvitationsSheet = ({
  projectId,
  projectTitle,
  isOpen,
  onClose,
}: ProjectInvitationsSheetProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { roster, isLoading } = useProjectInvitations(projectId, isOpen);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={projectTitle}
      subtitle={t("dashboard.admin.roster.subtitle", "Status zaproszeń")}
      headerBadge={
        roster.total > 0 ? (
          <Badge
            variant="neutral"
            casing="natural"
            className="tabular-nums"
            icon={<Users size={11} aria-hidden="true" />}
          >
            {roster.total}
          </Badge>
        ) : undefined
      }
      footer={
        projectId ? (
          <Button variant="primary" size="touch" fullWidth asChild>
            <Link to={`/panel/projects/${projectId}`} onClick={onClose}>
              {t("dashboard.admin.roster.open_project", "Otwórz projekt")}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </Button>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <EtherealLoader
            fullHeight={false}
            message={t("dashboard.admin.roster.loading", "Wczytywanie składu...")}
          />
        </div>
      ) : roster.total === 0 ? (
        <Text size="sm" color="muted" className="py-8 text-center italic">
          {t(
            "dashboard.admin.roster.empty",
            "Do tego projektu nie zaproszono jeszcze nikogo.",
          )}
        </Text>
      ) : (
        <div className="pb-2">
          <RosterGroup
            rows={roster.pending}
            label={t("dashboard.admin.roster.pending", "Oczekują na odpowiedź")}
            tone="gold"
            Icon={Clock}
          />
          <RosterGroup
            rows={roster.confirmed}
            label={t("dashboard.admin.roster.confirmed", "Potwierdzili")}
            tone="sage"
            Icon={UserCheck}
          />
          <RosterGroup
            rows={roster.declined}
            label={t("dashboard.admin.roster.declined", "Odmówili")}
            tone="graphite"
            Icon={UserX}
          />
        </div>
      )}
    </BottomSheet>
  );
};
