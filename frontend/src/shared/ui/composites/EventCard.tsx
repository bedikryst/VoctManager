import React from "react";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { Calendar } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface EventCardProps {
  theme?: "gold" | "sage" | "incense";
  backgroundElement?: React.ReactNode;
  badgesSlot?: React.ReactNode;
  title: string;
  dateSlot?: React.ReactNode;
  timeSlot?: React.ReactNode;
  locationSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}

export function EventCard({
  theme = "gold",
  backgroundElement,
  badgesSlot,
  title,
  dateSlot,
  timeSlot,
  locationSlot,
  actionSlot,
  footerSlot,
}: EventCardProps): React.JSX.Element {
  const iconColorClass =
    theme === "gold"
      ? "text-ethereal-gold"
      : theme === "sage"
        ? "text-ethereal-sage"
        : "text-ethereal-incense";

  return (
    <GlassCard
      variant="light"
      padding="none"
      glow={true}
      className="flex flex-col h-full relative z-10 !overflow-visible transition-all duration-300"
    >
      {backgroundElement}

      <div className="p-6 md:p-8 flex-1 relative z-50 rounded-t-[inherit] flex flex-col">
        {badgesSlot && (
          <div className="flex items-center justify-between mb-4">
            {badgesSlot}
          </div>
        )}

        <Heading
          as="h3"
          size="3xl"
          weight="bold"
          className="mb-5 leading-tight text-ethereal-ink relative z-50"
        >
          {title}
        </Heading>

        <div className="flex flex-col gap-3 mb-2 relative z-50 mt-auto">
          {dateSlot && (
            <div className="flex items-center gap-2">
              <Calendar
                size={13}
                strokeWidth={1.5}
                className={cn("shrink-0 opacity-70", iconColorClass)}
              />
              <Eyebrow color="default" weight="medium">
                {dateSlot}
              </Eyebrow>
            </div>
          )}

          {timeSlot}

          {locationSlot && (
            <div className="flex items-center gap-2 pl-0.5 z-[100]">
              {locationSlot}
            </div>
          )}
        </div>
      </div>

      {(actionSlot || footerSlot) && (
        <div className="relative z-10 border-t border-ethereal-incense/10 bg-ethereal-alabaster/40 py-4 px-6 rounded-b-[inherit]">
          {actionSlot && (
            <div className="flex flex-col sm:flex-row gap-2 relative z-10">
              {actionSlot}
            </div>
          )}
          {footerSlot && <div className="pt-2">{footerSlot}</div>}
        </div>
      )}
    </GlassCard>
  );
}
