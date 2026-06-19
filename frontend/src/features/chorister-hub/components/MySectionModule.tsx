// chorister-hub/components/MySectionModule.tsx
// "Z kim śpiewam" — concert roster scoped to the chorister's own upcoming concerts.
// For each piece they sing, the co-singers grouped by the voice line they take IN
// THAT PIECE (it can differ piece to piece). Never the whole base, never default
// voices — it exists only to serve the concert.
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronDown, Users } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { useMyEnsemble } from "../api/chorister-hub.queries";
import type {
  ConcertRosterDTO,
  PieceVoiceSectionDTO,
} from "../types/chorister-hub.dto";

const VOICE_ACCENT: Record<string, string> = {
  S: "border-ethereal-incense/30 bg-ethereal-incense/10 text-ethereal-incense",
  A: "border-ethereal-sage/30 bg-ethereal-sage/10 text-ethereal-sage",
  T: "border-ethereal-gold/30 bg-ethereal-gold/10 text-ethereal-gold",
  B: "border-ethereal-ink/20 bg-ethereal-ink/8 text-ethereal-ink",
};
const DEFAULT_ACCENT =
  "border-ethereal-graphite/20 bg-ethereal-graphite/8 text-ethereal-graphite";

const formatDate = (iso: string | null, locale: string): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
};

const VoiceRow = ({ section }: { section: PieceVoiceSectionDTO }): React.JSX.Element => {
  const { t } = useTranslation();
  const accent = VOICE_ACCENT[section.voice_line?.[0]] ?? DEFAULT_ACCENT;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2 py-1.5",
        section.is_mine && "bg-ethereal-gold/8",
      )}
    >
      <span
        className={cn(
          "inline-flex h-6 min-w-9 items-center justify-center rounded-md border px-1.5 font-mono text-[11px] font-bold",
          accent,
        )}
      >
        {section.voice_line}
      </span>
      {section.is_mine && (
        <Eyebrow as="span" color="gold" className="shrink-0">
          {t("chorister_hub.section.mine", "Twój głos")}
        </Eyebrow>
      )}
      <Text size="sm" className="min-w-0 flex-1">
        {(section.members ?? []).map((m, i) => (
          <React.Fragment key={m.artist_id}>
            {i > 0 && <span className="text-ethereal-graphite/40">, </span>}
            <span className={cn(m.is_me && "font-bold text-ethereal-gold")}>
              {m.first_name} {m.last_name}
              {m.is_me && ` (${t("chorister_hub.section.you", "Ty")})`}
            </span>
          </React.Fragment>
        ))}
      </Text>
    </div>
  );
};

const ConcertCard = ({
  concert,
  defaultOpen,
  locale,
}: {
  concert: ConcertRosterDTO;
  defaultOpen: boolean;
  locale: string;
}): React.JSX.Element => {
  const [open, setOpen] = useState(defaultOpen);
  const dateLabel = formatDate(concert.date, locale);

  return (
    <GlassCard variant="ethereal" padding="md" isHoverable={false}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={open}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ethereal-gold/20 bg-ethereal-gold/10 text-ethereal-gold">
          <CalendarDays size={16} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <Heading size="lg" truncate className="tracking-tight">
            {concert.title}
          </Heading>
          {dateLabel && <Caption color="muted">{dateLabel}</Caption>}
        </div>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-ethereal-graphite/50 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-ethereal-incense/15 pt-4">
          {(concert.pieces ?? []).map((piece) => (
            <div key={piece.piece_id} className="space-y-1.5">
              <Text size="sm" weight="semibold" className="text-ethereal-ink">
                {piece.title}
              </Text>
              <div className="space-y-1">
                {(piece.sections ?? []).map((section) => (
                  <VoiceRow key={section.voice_line} section={section} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
};

export const MySectionModule = (): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const { data: ensemble } = useMyEnsemble();
  const concerts = ensemble.concerts ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-ethereal-gold/20 bg-ethereal-gold/10 text-ethereal-gold">
          <Users size={18} aria-hidden="true" />
        </div>
        <div>
          <Heading size="xl" className="tracking-tight">
            {t("chorister_hub.section.title", "Z kim śpiewam")}
          </Heading>
          <Text size="xs" color="muted">
            {t(
              "chorister_hub.section.subtitle",
              "Skład Twoich nadchodzących koncertów — utwór po utworze",
            )}
          </Text>
        </div>
      </div>

      {concerts.length === 0 ? (
        <GlassCard variant="ethereal" padding="lg" isHoverable={false} className="py-10 text-center">
          <Users size={28} className="mx-auto mb-3 text-ethereal-graphite/25" aria-hidden="true" />
          <Text color="muted" size="sm">
            {t(
              "chorister_hub.section.empty",
              "Nie masz nadchodzących koncertów. Skład pojawi się, gdy zostaniesz obsadzony.",
            )}
          </Text>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Eyebrow color="muted">
              {t("chorister_hub.section.upcoming", "Nadchodzące koncerty")}
            </Eyebrow>
            <Badge variant="glass" className="tabular-nums">
              {concerts.length}
            </Badge>
          </div>
          {concerts.map((concert, idx) => (
            <ConcertCard
              key={concert.project_id}
              concert={concert}
              defaultOpen={idx === 0}
              locale={i18n.language}
            />
          ))}
        </div>
      )}
    </div>
  );
};
