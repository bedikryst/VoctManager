/**
 * @file DetailsTab.tsx
 * @description Creation and editing of base project metadata and the concert-day
 * plan. Defers API sync via dirty-state tracking surfaced through the shared
 * `EditorActionBar`.
 * Four sections, by the job each does rather than by field type: what the
 * concert IS (identity, time, venue, conductor), what the DAY looks like (the
 * call time and the run sheet it opens), where the day HAPPENS once everyone
 * has arrived at the address (door, parking, dressing room, the two typed
 * windows and the number to call), and what the ENSEMBLE is told (attire,
 * reference playlist, notes) — every field of the last two is published to the
 * singers, which is why the notes no longer sit under a "production" heading.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/DetailsTab
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Clock,
  DoorOpen,
  Info,
  ListOrdered,
  Megaphone,
  Plus,
  TriangleAlert,
} from "lucide-react";

import { useLocations } from "@/features/logistics/api/logistics.queries";
import type { Project } from "@/shared/types";
import {
  PROJECT_EVENT_KIND,
  type ProjectEventKind,
} from "../../constants/projectDomain";
import { useDetailsForm } from "../hooks/useDetailsForm";
import { useProjectArtistsDictionary } from "../../api/project.queries";
import {
  buildDayTimeline,
  getCallOffsetMinutes,
  isDayWindow,
  readInputDate,
  readInputTime,
  shiftClockTime,
} from "../../lib/dayTimeline";
import { getEventMomentPresentation } from "../../lib/projectPresentation";
import { TimezoneField } from "../../components/TimezoneField";
import { DayTimeline } from "./components/DayTimeline";
import {
  DateTimeField,
  TimeField,
  type CalendarMarker,
} from "@/shared/ui/composites/DateTimeField";
import { Input } from "@/shared/ui/primitives/Input";
import { Button } from "@/shared/ui/primitives/Button";
import { Select, type SelectOption } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { EditorActionBar } from "@/shared/ui/composites/EditorActionBar";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";

/** An evening concert is the norm here; the picker only proposes it. */
const CONCERT_DEFAULT_TIME = "19:00";
/** How long before the downbeat a call is usually called, when none is set. */
const DEFAULT_CALL_OFFSET_MINUTES = -60;

interface DetailsTabProps {
  project: Project | null;
  onSuccess: (updatedProject?: Project) => void;
  onDirtyStateChange?: (isDirty: boolean) => void;
}

export const DetailsTab = ({
  project,
  onSuccess,
  onDirtyStateChange,
}: DetailsTabProps): React.JSX.Element => {
  const { t } = useTranslation();
  const {
    formData,
    setFormData,
    runSheet,
    isDirty,
    isSubmitting,
    handleAddRunSheetItem,
    handleUpdateRunSheetItem,
    handleCommitRunSheetOrder,
    handleRemoveRunSheetItem,
    handleSubmit,
  } = useDetailsForm(project?.id, onSuccess, onDirtyStateChange);

  const { data: locationsData } = useLocations();
  const { data: artists } = useProjectArtistsDictionary();

  const locationOptions = useMemo<SelectOption[]>(
    () =>
      (locationsData ?? []).map((location) => ({
        value: String(location.id),
        label: location.formatted_address
          ? `${location.name} - ${location.formatted_address.split(",")[0]}`
          : location.name,
      })),
    [locationsData],
  );

  // The four kinds are a closed set the API validates, so they are named here
  // rather than fetched; the liturgical *vocabulary* is the opposite case and
  // stays server-side, where one table names every moment for every reader.
  const eventKindOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: PROJECT_EVENT_KIND.CONCERT,
        label: t("projects.details_tab.event_kind.concert", "Koncert"),
      },
      {
        value: PROJECT_EVENT_KIND.MASS,
        label: t("projects.details_tab.event_kind.mass", "Msza"),
      },
      {
        value: PROJECT_EVENT_KIND.WEDDING,
        label: t("projects.details_tab.event_kind.wedding", "Msza ślubna"),
      },
      {
        value: PROJECT_EVENT_KIND.OTHER,
        label: t("projects.details_tab.event_kind.other", "Inne wydarzenie"),
      },
    ],
    [t],
  );

  const conductorOptions = useMemo<SelectOption[]>(
    () =>
      artists
        .filter((artist) => artist.voice_type === "DIR")
        .map((artist) => ({
          value: String(artist.id),
          label: `${artist.first_name} ${artist.last_name}`.trim(),
        })),
    [artists],
  );

  // The two typed windows are edited in the card below this one, and they are
  // merged here on purpose: a sound check moved on top of a run-sheet point is
  // a collision only one axis can show.
  const timelineEntries = useMemo(
    () =>
      buildDayTimeline({
        runSheet,
        callTime: formData.call_time,
        concertTime: formData.date_time,
        warmupStart: formData.warmup_start,
        warmupEnd: formData.warmup_end,
        soundcheckStart: formData.soundcheck_start,
        soundcheckEnd: formData.soundcheck_end,
      }),
    [
      runSheet,
      formData.call_time,
      formData.date_time,
      formData.warmup_start,
      formData.warmup_end,
      formData.soundcheck_start,
      formData.soundcheck_end,
    ],
  );

  // The anchors are the frame, not the plan: a day carrying nothing but a call
  // and a downbeat still has nothing planned between them, and the empty state
  // says so in words the two anchors cannot.
  const hasDayPlan = timelineEntries.some(
    (entry) => entry.kind === "point" || isDayWindow(entry),
  );

  const callOffsetMinutes = getCallOffsetMinutes(
    formData.call_time,
    formData.date_time,
  );

  const concertDayMarker = useMemo<CalendarMarker[] | undefined>(() => {
    const concertDay = readInputDate(formData.date_time);
    const moment = getEventMomentPresentation(formData.event_kind);

    return concertDay
      ? [
          {
            date: concertDay,
            tone: "gold",
            label: t(moment.labelKey, moment.fallbackLabel),
          },
        ]
      : undefined;
  }, [formData.date_time, formData.event_kind, t]);

  const callDefaultTime = useMemo(() => {
    const concertClockTime = readInputTime(formData.date_time);

    return concertClockTime
      ? shiftClockTime(concertClockTime, DEFAULT_CALL_OFFSET_MINUTES)
      : undefined;
  }, [formData.date_time]);

  /**
   * The one thing nothing on this surface used to check: a call time that is not
   * before the concert. Stated as a fact under the field rather than blocking the
   * save — the producer may well be mid-edit, and the whole tab refuses to save
   * when a browser validation bubble fires on a field they are not looking at.
   */
  const callOffsetLabel = useMemo<
    { readonly text: string; readonly isWarning: boolean } | null
  >(() => {
    if (callOffsetMinutes === null) {
      return null;
    }

    if (callOffsetMinutes <= 0) {
      return {
        isWarning: true,
        text: t(
          "projects.details_tab.call_time.offset_after",
          "Zbiórka nie wypada przed rozpoczęciem",
        ),
      };
    }

    const hours = Math.floor(callOffsetMinutes / 60);
    const minutes = callOffsetMinutes % 60;

    if (hours === 0) {
      return {
        isWarning: false,
        text: t(
          "projects.details_tab.call_time.offset_m",
          "{{minutes}} min przed rozpoczęciem",
          { minutes },
        ),
      };
    }

    return {
      isWarning: false,
      text:
        minutes === 0
          ? t(
              "projects.details_tab.call_time.offset_h",
              "{{hours}} godz. przed rozpoczęciem",
              { hours },
            )
          : t(
              "projects.details_tab.call_time.offset_hm",
              "{{hours}} godz. {{minutes}} min przed rozpoczęciem",
              { hours, minutes },
            ),
    };
  }, [callOffsetMinutes, t]);

  const untitledCount = runSheet.filter((item) => !item.title.trim()).length;
  const callClock = readInputTime(formData.call_time);
  const concertClock = readInputTime(formData.date_time);

  return (
    <div className="relative w-full pb-24">
      <EditorActionBar
        isOpen={isDirty}
        description={t(
          "projects.details_tab.fab.description",
          "Zmiany w szczegółach wydarzenia i planie dnia.",
        )}
        formId="details-form"
        confirmText={t("projects.details_tab.fab.save", "Zapisz zmiany")}
        isLoading={isSubmitting}
      />

      <form
        id="details-form"
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start"
      >
        {/* ── Left column: what the concert is, and what the ensemble is told ── */}
        <div className="flex flex-col gap-6">
          <SectionCard
            as="h2"
            icon={<Info size={15} aria-hidden="true" />}
            title={t("projects.details_tab.sections.event", "Wydarzenie")}
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <Input
                  label={t("projects.details_tab.fields.title", "Tytuł projektu *")}
                  type="text"
                  required
                  value={formData.title}
                  onChange={(event) =>
                    setFormData({ ...formData, title: event.target.value })
                  }
                />
              </div>

              <DateTimeField
                label={t("projects.details_tab.fields.date_time", "Data i godzina *")}
                required
                value={formData.date_time}
                onChange={(date_time) => setFormData({ ...formData, date_time })}
                defaultTime={CONCERT_DEFAULT_TIME}
              />

              <Select
                label={t("projects.details_tab.fields.location", "Miejsce wydarzenia")}
                value={formData.location_id || ""}
                onValueChange={(locationId) => {
                  const selected = (locationsData ?? []).find(
                    (location) => String(location.id) === locationId,
                  );

                  setFormData({
                    ...formData,
                    location_id: locationId || null,
                    // The venue owns the timezone: every field on this tab is
                    // wall-clock in it, so adopting it here is what keeps the
                    // stated hour and the stored instant the same event.
                    timezone: selected?.timezone || formData.timezone,
                  });
                }}
                placeholder={t(
                  "projects.details_tab.placeholders.location",
                  "Wybierz miejsce",
                )}
                clearLabel={t(
                  "projects.details_tab.placeholders.location_clear",
                  "Bez lokalizacji",
                )}
                options={locationOptions}
              />

              <div className="md:col-span-2">
                <TimezoneField
                  timezone={formData.timezone}
                  onChange={(timezone) => setFormData({ ...formData, timezone })}
                />
              </div>

              <Select
                label={t("projects.details_tab.fields.conductor", "Dyrygent")}
                value={formData.conductor || ""}
                onValueChange={(conductor) =>
                  setFormData({
                    ...formData,
                    conductor: conductor || null,
                  })
                }
                placeholder={t(
                  "projects.details_tab.placeholders.conductor",
                  "Wybierz dyrygenta",
                )}
                clearLabel={t(
                  "projects.details_tab.placeholders.conductor_clear",
                  "Bez dyrygenta",
                )}
                options={conductorOptions}
              />

              {/* Not a label on the poster: this is the answer that decides
                  whether the programme is a running order or an order of
                  service, and the cast is told when it changes. */}
              <div className="flex flex-col gap-1.5">
                <Select
                  label={t(
                    "projects.details_tab.fields.event_kind",
                    "Rodzaj wydarzenia",
                  )}
                  value={formData.event_kind}
                  onValueChange={(eventKind) =>
                    setFormData({
                      ...formData,
                      event_kind: eventKind as ProjectEventKind,
                    })
                  }
                  options={eventKindOptions}
                />
                <Caption color="muted" className="ml-1">
                  {t(
                    "projects.details_tab.event_kind.hint",
                    "Msza i ślub pozwalają przypisać utworom miejsce w liturgii.",
                  )}
                </Caption>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            as="h2"
            icon={<Megaphone size={15} aria-hidden="true" />}
            title={t(
              "projects.details_tab.sections.ensemble_info",
              "Informacje dla zespołu",
            )}
          >
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Input
                  label={t(
                    "projects.details_tab.fields.dress_code_female",
                    "Ubiór: panie",
                  )}
                  type="text"
                  value={formData.dress_code_female || ""}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      dress_code_female: event.target.value,
                    })
                  }
                  placeholder={t(
                    "projects.details_tab.placeholders.dress_code_female",
                    "np. czarna suknia chóralna",
                  )}
                />
                <Input
                  label={t(
                    "projects.details_tab.fields.dress_code_male",
                    "Ubiór: panowie",
                  )}
                  type="text"
                  value={formData.dress_code_male || ""}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      dress_code_male: event.target.value,
                    })
                  }
                  placeholder={t(
                    "projects.details_tab.placeholders.dress_code_male",
                    "np. frak, biała muszka",
                  )}
                />
              </div>

              <div className="flex flex-col gap-5 border-t border-hairline pt-5">
                <Input
                  label={t("projects.details_tab.fields.spotify", "Playlista Spotify")}
                  type="url"
                  value={formData.spotify_playlist_url || ""}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      spotify_playlist_url: event.target.value,
                    })
                  }
                  placeholder={t(
                    "projects.details_tab.placeholders.spotify",
                    "Wklej link do playlisty z referencjami",
                  )}
                />

                <Textarea
                  label={t("projects.details_tab.fields.description", "Opis wydarzenia")}
                  rows={4}
                  value={formData.description || ""}
                  onChange={(event) =>
                    setFormData({ ...formData, description: event.target.value })
                  }
                  placeholder={t(
                    "projects.details_tab.placeholders.description",
                    "np. proszę o punktualność",
                  )}
                />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Right column: the day itself ─────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <SectionCard
            as="h2"
            icon={<ListOrdered size={15} aria-hidden="true" />}
            title={t("projects.details_tab.sections.day_plan", "Plan dnia")}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRunSheetItem}
                leftIcon={<Plus size={14} aria-hidden="true" />}
              >
                {t("projects.details_tab.buttons.add_run_sheet", "Dodaj punkt")}
              </Button>
            }
            footer={
              untitledCount > 0 ? (
                <div className="flex items-center gap-2">
                  <TriangleAlert
                    size={13}
                    className="shrink-0 text-ethereal-gold"
                    aria-hidden="true"
                  />
                  {/* Stated once for the whole day instead of a marker on each
                      row: a freshly added point is nameless by definition, and
                      a badge per row would light up the moment you add one. */}
                  <Eyebrow color="gold">
                    {t(
                      "projects.details_tab.day_plan.untitled_count",
                      "Bez nazwy: {{count}}",
                      { count: untitledCount },
                    )}
                  </Eyebrow>
                </div>
              ) : undefined
            }
          >
            <div className="flex flex-1 flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <DateTimeField
                  label={t("projects.details_tab.fields.call_time", "Zbiórka")}
                  value={formData.call_time || ""}
                  onChange={(call_time) => setFormData({ ...formData, call_time })}
                  clearable
                  // The concert is what a call time is set against, so the day
                  // it falls on is marked and pre-selected rather than left for
                  // the producer to find twice.
                  markers={concertDayMarker}
                  defaultTime={callDefaultTime}
                  anchorValue={formData.date_time}
                />
                {callOffsetLabel && (
                  <Caption
                    color={callOffsetLabel.isWarning ? "gold" : "muted"}
                    className="ml-1"
                  >
                    {callOffsetLabel.text}
                  </Caption>
                )}
              </div>

              {hasDayPlan ? (
                <DayTimeline
                  entries={timelineEntries}
                  onUpdate={handleUpdateRunSheetItem}
                  onCommitOrder={handleCommitRunSheetOrder}
                  onRemove={handleRemoveRunSheetItem}
                  callDate={readInputDate(formData.call_time)}
                  concertDate={readInputDate(formData.date_time)}
                  eventKind={formData.event_kind}
                />
              ) : (
                /* The empty state states the frame it is empty inside — the two
                   anchors the timeline would otherwise draw. */
                <StatePanel
                  variant="inline"
                  icon={<Clock size={24} aria-hidden="true" />}
                  title={t("projects.details_tab.empty.run_sheet", "Brak planu dnia")}
                  description={
                    callClock && concertClock
                      ? t(
                          "projects.details_tab.empty.run_sheet_frame",
                          "Zbiórka {{call}}, początek {{start}} — ułóż przebieg pomiędzy.",
                          { call: callClock, start: concertClock },
                        )
                      : t(
                          "projects.details_tab.empty.run_sheet_hint",
                          "Dodaj pierwszy punkt, aby ułożyć przebieg dnia.",
                        )
                  }
                />
              )}
            </div>
          </SectionCard>

          {/* Where the day happens once everyone has found the address. These
              used to be prose inside the description, so they reached nobody as
              a fact — and the two windows are typed rather than written into the
              run sheet because a typed moment prints in the reader's own
              language, where a hand-written title prints in the writer's. */}
          <SectionCard
            as="h2"
            icon={<DoorOpen size={15} aria-hidden="true" />}
            title={t("projects.details_tab.sections.onsite", "Na miejscu")}
          >
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TimeField
                  label={t(
                    "projects.details_tab.fields.warmup_start",
                    "Rozśpiewanie od",
                  )}
                  value={formData.warmup_start}
                  onChange={(warmup_start) =>
                    setFormData({
                      ...formData,
                      warmup_start,
                      // A window with no beginning is not a window; clearing
                      // the start takes its end with it rather than leaving an
                      // hour the API would refuse on save.
                      warmup_end: warmup_start ? formData.warmup_end : "",
                    })
                  }
                />
                <TimeField
                  label={t(
                    "projects.details_tab.fields.warmup_end",
                    "Rozśpiewanie do",
                  )}
                  value={formData.warmup_end}
                  disabled={!formData.warmup_start}
                  onChange={(warmup_end) =>
                    setFormData({ ...formData, warmup_end })
                  }
                />
                <TimeField
                  label={t(
                    "projects.details_tab.fields.soundcheck_start",
                    "Próba akustyczna od",
                  )}
                  value={formData.soundcheck_start}
                  onChange={(soundcheck_start) =>
                    setFormData({
                      ...formData,
                      soundcheck_start,
                      soundcheck_end: soundcheck_start
                        ? formData.soundcheck_end
                        : "",
                    })
                  }
                />
                <TimeField
                  label={t(
                    "projects.details_tab.fields.soundcheck_end",
                    "Próba akustyczna do",
                  )}
                  value={formData.soundcheck_end}
                  disabled={!formData.soundcheck_start}
                  onChange={(soundcheck_end) =>
                    setFormData({ ...formData, soundcheck_end })
                  }
                />
              </div>

              <div className="flex flex-col gap-5 border-t border-hairline pt-5">
                <Input
                  label={t("projects.details_tab.fields.entrance", "Wejście / brama")}
                  type="text"
                  value={formData.entrance_note}
                  onChange={(event) =>
                    setFormData({ ...formData, entrance_note: event.target.value })
                  }
                  placeholder={t(
                    "projects.details_tab.placeholders.entrance",
                    "np. wejście boczne od Rakowieckiej, brama nr 2",
                  )}
                />
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Input
                    label={t("projects.details_tab.fields.parking", "Parking")}
                    type="text"
                    value={formData.parking_note}
                    onChange={(event) =>
                      setFormData({ ...formData, parking_note: event.target.value })
                    }
                    placeholder={t(
                      "projects.details_tab.placeholders.parking",
                      "np. dziedziniec, wjazd do 18:00",
                    )}
                  />
                  <Input
                    label={t(
                      "projects.details_tab.fields.dressing_room",
                      "Garderoba",
                    )}
                    type="text"
                    value={formData.dressing_room_note}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        dressing_room_note: event.target.value,
                      })
                    }
                    placeholder={t(
                      "projects.details_tab.placeholders.dressing_room",
                      "np. sala pod wieżą, klucz u zakrystiana",
                    )}
                  />
                </div>
              </div>

              {/* The one number that prints on all forty sheets. It is typed for
                  this concert, not read off anybody's profile — which is what
                  makes publishing it to the whole choir the producer's decision
                  rather than a leak. */}
              <div className="grid grid-cols-1 gap-5 border-t border-hairline pt-5 sm:grid-cols-2">
                <Input
                  label={t(
                    "projects.details_tab.fields.onsite_contact_name",
                    "Kontakt na miejscu",
                  )}
                  type="text"
                  value={formData.onsite_contact_name}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      onsite_contact_name: event.target.value,
                    })
                  }
                  placeholder={t(
                    "projects.details_tab.placeholders.onsite_contact_name",
                    "np. Anna Nowak (produkcja)",
                  )}
                />
                <Input
                  label={t(
                    "projects.details_tab.fields.onsite_contact_phone",
                    "Telefon na miejscu",
                  )}
                  type="tel"
                  value={formData.onsite_contact_phone}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      onsite_contact_phone: event.target.value,
                    })
                  }
                  placeholder={t(
                    "projects.details_tab.placeholders.onsite_contact_phone",
                    "+48 600 000 000",
                  )}
                />
              </div>
            </div>
          </SectionCard>
        </div>
      </form>
    </div>
  );
};
