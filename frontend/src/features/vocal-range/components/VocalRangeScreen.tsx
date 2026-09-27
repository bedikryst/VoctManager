/**
 * @file VocalRangeScreen.tsx
 * @description The singer's own range, written by touching keys that sound,
 * never by typing note names: a typed "A1" is 55 Hz to one reader and 440 Hz to
 * another, and a tenor reads a treble-8 clef an octave above what they sing. A
 * key that sounds settles it. See docs/specs/vocal-range-self-report-2026-09.md.
 *
 * One full-screen moment in the welcome's nave scenography, opened two ways:
 *  - `prompt` — the first-run takeover, mounted by the panel shell while
 *    `useFirstRunTakeover()` says so. "Later" snoozes it and it never blocks
 *    the panel. Following the welcome, it enters over the welcome's own scene,
 *    already lit;
 *  - `revisit` — the Settings row, which reopens it with the saved proposal.
 * Either way an unsent draft survives a close for the session and comes back
 * at the next opening.
 *
 * Layout, phone first. On a wide screen the header, the slots and everything
 * after them form the left column, and the keyboard stands on the right, one
 * screen tall and held in view. On a phone the slots and the keyboard are one
 * screen together: the slot strip sticks to the top of the scroll area and the
 * keyboard takes the rest of the viewport, so a note costs a tap on a slot and
 * a tap on a key, with no scrolling between. Nothing above the keys changes
 * height when a key is pressed: the slots are sized for their widest name and
 * the status line under them has a fixed height.
 *
 * An account with no singing voice (the developer, the conductor) gets a trial
 * run: a voice picker instead of their own voice, everything working, and a
 * line saying nothing will be saved. That is how the screen is tried on a real
 * phone before any singer sees it.
 *
 * Every sound starts synchronously inside the tap that asks for it (the iOS
 * rule; see `toneContext`). A new sound stops the one before it, so the note
 * the singer is judging is never muddied by the last.
 * @module features/vocal-range/components/VocalRangeScreen
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { getSectionPresentation } from "@/features/artists/constants/voiceSections";
import {
  playArpeggio,
  playVoicedTone,
  type VoicedToneHandle,
} from "@/shared/lib/audio/voicedTone";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { useFocusTrap } from "@/shared/lib/dom/useFocusTrap";
import {
  notationForLanguage,
  spokenPitch,
  type VocalRangeMidi,
} from "@/shared/lib/music/pitchNotation";
import { cn } from "@/shared/lib/utils";
import { artistRoleLabel } from "@/shared/lib/voiceTypes";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import {
  VerticalKeyboard,
  type KeyboardCenterRequest,
} from "@/shared/ui/instruments/VerticalKeyboard";
import { EASE } from "@/shared/ui/kinematics/motion-presets";
import { NaveScene } from "@/shared/ui/kinematics/NaveScene";
import { ACCENT_BADGE } from "@/shared/ui/primitives/accents";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";

import {
  keyboardWindow,
  SINGING_VOICES,
  singingVoiceOf,
  voiceCentreMidi,
  type SingingVoice,
} from "../constants/voices";
import { useSubmitVocalRange } from "../hooks/useSubmitVocalRange";
import {
  draftFromProposal,
  EMPTY_DRAFT,
  isExtremeSlot,
  rangeBands,
  rangePitches,
  rangeProblem,
  RANGE_SLOTS,
  slotCentre,
  slotSpan,
  toSubmission,
  type RangeSlot,
} from "../lib/rangeDraft";
import {
  clearVocalRangeDraft,
  keepVocalRangeDraft,
  readVocalRangeDraft,
} from "../lib/vocalRangeSession";
import { NoteReadout } from "./NoteReadout";
import { RangeNotationTable } from "./RangeNotationTable";
import { RangeSlots, SLOT_KEY } from "./RangeSlots";

/** The server's limit on the comment (`VocalRangeProposalDTO`). */
const COMMENT_MAX_LENGTH = 500;

/** The blocks that arrive with the first note rise into place one after
 *  another, or only fade in for a reader who prefers reduced motion. Their
 *  space opens below everything already on screen, so nothing above them
 *  moves while they come. */
const arrival = (reduceMotion: boolean, order: number) => ({
  initial: { opacity: 0, y: reduceMotion ? 0 : 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.6, delay: order * 0.09, ease: EASE.buttery },
});

/** What the status line under the slots is saying; a change of kind
 *  cross-fades, a new note within the readout does not. */
type StatusKind = "order" | "readout" | "hint";

const sameDraft = (
  a: VocalRangeMidi,
  aComment: string,
  b: VocalRangeMidi,
  bComment: string,
): boolean =>
  RANGE_SLOTS.every((slot) => a[slot] === b[slot]) &&
  aComment.trim() === bComment.trim();

export type VocalRangeScreenMode = "prompt" | "revisit";

interface StageProps {
  readonly mode: VocalRangeScreenMode;
  readonly entersLit: boolean;
  readonly onClose: () => void;
}

/** Mounted only while open, so every opening starts from the saved proposal
 *  or the draft kept at the last close. */
const VocalRangeStage = ({
  mode,
  entersLit,
  onClose,
}: StageProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const { user, refreshUser } = useAuth();
  const reduceMotion = useReducedMotion() ?? false;
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const notation = notationForLanguage(i18n.language);

  const ownVoice = singingVoiceOf(user?.voice_type);
  const isTrial = ownVoice === null;
  const [trialVoice, setTrialVoice] = useState<SingingVoice>(SINGING_VOICES[0]);
  const voice = ownVoice ?? trialVoice;

  // What this opening would show with nothing kept: the saved proposal, or a
  // blank for a first answer and for a trial run.
  const saved = isTrial ? null : user?.vocal_range_proposal;
  const baseDraft = useMemo(
    () => (isTrial ? EMPTY_DRAFT : draftFromProposal(saved)),
    [isTrial, saved],
  );
  const baseComment = saved?.comment ?? "";

  const [draft, setDraft] = useState<VocalRangeMidi>(
    () => readVocalRangeDraft()?.draft ?? baseDraft,
  );
  const [comment, setComment] = useState(
    () => readVocalRangeDraft()?.comment ?? baseComment,
  );
  const [slot, setSlot] = useState<RangeSlot>("tessituraLow");
  const [centerRequest, setCenterRequest] = useState<KeyboardCenterRequest>(
    () => ({
      midi: slotCentre("tessituraLow", draft, voiceCentreMidi(voice)),
      seq: 0,
    }),
  );
  /** The key last pressed since the slot was chosen; the readout names it. */
  const [touched, setTouched] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [isRinging, setIsRinging] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = useSubmitVocalRange();

  const tone = useRef<VoicedToneHandle | null>(null);
  const toneToken = useRef(0);

  useFocusTrap(dialogRef, true);

  // The phone layout sizes the slots-and-keyboard block to exactly one screen
  // of the scroll area, which only the scroll area itself can measure.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const update = (): void => {
      scroller.style.setProperty("--vr-view", `${scroller.clientHeight}px`);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  /** Start a sound, stopping the one before. Only the latest sound's end may
   *  dim the light, so a stopped note cannot darken a ringing one. */
  const ring = (
    start: (onEnded: () => void) => VoicedToneHandle | null,
  ): void => {
    const token = toneToken.current + 1;
    toneToken.current = token;
    tone.current?.stop();
    const handle = start(() => {
      if (toneToken.current === token) setIsRinging(false);
    });
    tone.current = handle;
    setIsRinging(handle !== null);
  };

  const leave = useCallback((): void => {
    tone.current?.stop();
    if (sent) {
      clearVocalRangeDraft();
      void refreshUser();
    } else if (sameDraft(draft, comment, baseDraft, baseComment)) {
      clearVocalRangeDraft();
    } else {
      keepVocalRangeDraft({ draft, comment });
    }
    onClose();
  }, [baseComment, baseDraft, comment, draft, onClose, refreshUser, sent]);

  // Escape closes from anywhere but a text field, where it belongs to the
  // field: a half-written comment must not close the screen.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      const target = event.target;
      if (
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement
      ) {
        return;
      }
      leave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [leave]);

  const slotLabel = (each: RangeSlot): string =>
    t(`vocal_range.slots.${SLOT_KEY[each]}.label`);

  const handleKeyPress = (midi: number): void => {
    ring((onEnded) => playVoicedTone(midi, onEnded));
    setTouched(midi);
    // Once sent, the keys still sound but the proposal no longer changes: an
    // edit here would look saved and not be.
    if (sent) return;
    setDraft((current) => ({ ...current, [slot]: midi }));
    setAnnouncement(`${slotLabel(slot)}: ${spokenPitch(midi, notation)}`);
  };

  const requestCentre = (midi: number): void => {
    setCenterRequest((current) => ({ midi, seq: current.seq + 1 }));
  };

  const selectSlot = (next: RangeSlot): void => {
    setSlot(next);
    setTouched(null);
    requestCentre(slotCentre(next, draft, voiceCentreMidi(voice)));
  };

  const clearSlot = (): void => {
    setDraft((current) => ({ ...current, [slot]: null }));
    setTouched(null);
  };

  const pickTrialVoice = (next: SingingVoice): void => {
    setTrialVoice(next);
    requestCentre(slotCentre(slot, draft, voiceCentreMidi(next)));
  };

  const keySpan = useMemo(
    () => keyboardWindow(voice, rangePitches(draft)),
    [voice, draft],
  );
  const bands = useMemo(() => rangeBands(draft), [draft]);
  const emphasis = useMemo(() => slotSpan(slot, draft), [slot, draft]);

  const problem = rangeProblem(draft);
  const submission = toSubmission(draft, comment);
  const hasAnyNote = rangePitches(draft).length > 0;

  const handleSend = (): void => {
    if (submission === null || submit.isPending) return;
    // The singer hears what the conductor will read, then it goes.
    ring((onEnded) => playArpeggio(rangePitches(draft), onEnded));
    submit.mutate(submission, {
      onSuccess: () => {
        setSent(true);
        clearVocalRangeDraft();
      },
    });
  };

  const orderMessage =
    problem === "tessituraOrder"
      ? t(
          "vocal_range.validation.tessitura_order",
          "Dolna granica tessitury musi leżeć niżej niż górna.",
        )
      : problem === "extremeLowOrder"
        ? t(
            "vocal_range.validation.extreme_low_order",
            "Skrajny dźwięk dolny nie może leżeć wyżej niż dolna granica tessitury.",
          )
        : problem === "extremeHighOrder"
          ? t(
              "vocal_range.validation.extreme_high_order",
              "Skrajny dźwięk górny nie może leżeć niżej niż górna granica tessitury.",
            )
          : null;
  const readoutMidi = touched ?? draft[slot];
  const statusKind: StatusKind = orderMessage
    ? "order"
    : readoutMidi !== null
      ? "readout"
      : "hint";
  const presentation = getSectionPresentation(voice);
  const voiceLabel = (each: SingingVoice): string =>
    artistRoleLabel(t, each, null);

  return (
    <motion.div
      ref={dialogRef}
      initial={entersLit ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: EASE.buttery }}
      className="fixed inset-0 z-focus-trap flex flex-col pt-[env(safe-area-inset-top)] outline-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <NaveScene
        isToneRinging={isRinging}
        reduceMotion={reduceMotion}
        lit={entersLit}
      />

      {/* A bar that never scrolls, so "Later" is always one tap away and the
          slot strip can stick directly under it. */}
      <div className="relative z-20 flex h-14 shrink-0 items-center justify-end px-5">
        <Button type="button" variant="ghost" size="sm" onClick={leave}>
          {mode === "prompt" && !sent
            ? t("vocal_range.later", "Później")
            : t("vocal_range.close", "Zamknij")}
        </Button>
      </div>

      {/* The words scroll, the light stays. */}
      <div
        ref={scrollerRef}
        className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] lg:pt-4"
      >
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: EASE.buttery }}
          // Top-aligned, never centred: blocks arrive under the slots with the
          // first note, and a centred column would slide up under the finger.
          // On a wide screen the last row is flexible: it takes up whatever the
          // keyboard is taller than the left column, so the other rows keep
          // their own height and no gap opens between the header and the slots.
          className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-y-6 lg:grid-cols-3 lg:grid-rows-[auto_auto_auto_auto_1fr] lg:gap-x-12 lg:gap-y-0"
        >
          <header className="flex flex-col items-start lg:col-span-2 lg:col-start-1">
            <Eyebrow color="gold" as="p">
              {t("vocal_range.eyebrow", "Skala głosu")}
            </Eyebrow>
            <Heading
              as="h1"
              id={titleId}
              size="5xl"
              className="mt-3 text-balance leading-[1.05] sm:text-5xl lg:text-6xl"
            >
              {t(
                "vocal_range.title",
                "Jaka jest Twoja tessitura w śpiewie zespołowym?",
              )}
            </Heading>
            <Text size="md" color="graphite" className="mt-3 max-w-xl leading-7">
              {t(
                "vocal_range.intro",
                "To informacja dla dyrygenta. Pozostali chórzyści jej nie zobaczą. Dźwięki skrajne w nawiasach są opcjonalne.",
              )}
            </Text>

            {isTrial ? (
              <div className="mt-5 flex flex-col items-start gap-2">
                <Eyebrow color="gold" as="p">
                  {t(
                    "vocal_range.trial.notice",
                    "Tryb próbny: nic nie zostanie zapisane",
                  )}
                </Eyebrow>
                <SegmentedTabs
                  items={SINGING_VOICES.map((each) => ({
                    id: each,
                    label: voiceLabel(each),
                  }))}
                  value={trialVoice}
                  onChange={pickTrialVoice}
                  ariaLabel={t("vocal_range.trial.voice_picker", "Głos do próby")}
                  wrap
                />
              </div>
            ) : (
              <span className="mt-4 inline-flex items-center gap-2">
                <Eyebrow color="muted">
                  {t("vocal_range.voice_label", "Twój głos")}
                </Eyebrow>
                <Badge
                  casing="natural"
                  variant={
                    presentation ? ACCENT_BADGE[presentation.accent] : "outline"
                  }
                >
                  {artistRoleLabel(t, voice, user?.instrument)}
                </Badge>
              </span>
            )}
          </header>

          {/* The bench: on a phone, one screen holding the slot strip and the
              keyboard; on a wide screen it dissolves into the grid, the strip
              in the left column and the keyboard alone on the right. */}
          <div className="flex h-[calc(var(--vr-view,100dvh)-env(safe-area-inset-bottom))] flex-col lg:contents">
            <div
              className="sticky top-0 z-10 -mx-5 shrink-0 bg-glass-surface px-5 pb-2 pt-3 backdrop-blur-ethereal lg:static lg:col-span-2 lg:col-start-1 lg:mx-0 lg:mt-10 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0 lg:backdrop-blur-none"
            >
              <RangeSlots
                draft={draft}
                selected={slot}
                notation={notation}
                low={keySpan.low}
                high={keySpan.high}
                onSelect={selectSlot}
              />
              {/* One status line of fixed height: the note, a hint, or what is
                  out of order. The remove button keeps its place while an
                  extreme is selected, so filling that slot moves nothing. */}
              <div className="mt-2 flex h-10 items-center gap-3">
                <div className="relative h-full min-w-0 flex-1">
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={statusKind}
                      className="absolute inset-0 flex items-center"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      {orderMessage ? (
                        <Text
                          size="sm"
                          color="crimson"
                          role="alert"
                          className="line-clamp-2 leading-5"
                        >
                          {orderMessage}
                        </Text>
                      ) : readoutMidi !== null ? (
                        <NoteReadout midi={readoutMidi} notation={notation} />
                      ) : (
                        <Text size="sm" color="muted" className="line-clamp-2 leading-5">
                          {t(
                            "vocal_range.note_card.hint",
                            "Dotknij klawisza: zabrzmi i trafi do zaznaczonego pola.",
                          )}
                        </Text>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
                {isExtremeSlot(slot) && !sent ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearSlot}
                    aria-label={t(
                      "vocal_range.slots.clear_extreme",
                      "Usuń skrajny dźwięk",
                    )}
                    className={cn("shrink-0", draft[slot] === null && "invisible")}
                  >
                    {t("vocal_range.slots.clear", "Usuń")}
                  </Button>
                ) : null}
              </div>
              <p className="sr-only" aria-live="polite">
                {announcement}
              </p>
            </div>

            {/* On a wide screen the keyboard is one screen tall and stays in
                view, whatever the left column holds: it never grows when the
                blocks below the slots arrive. */}
            <div className="min-h-48 flex-1 pb-3 lg:sticky lg:top-4 lg:col-start-3 lg:row-span-5 lg:row-start-1 lg:h-[calc(var(--vr-view,100dvh)-3.5rem-env(safe-area-inset-bottom))] lg:self-start lg:pb-0">
              <VerticalKeyboard
                low={keySpan.low}
                high={keySpan.high}
                notation={notation}
                label={t("vocal_range.keyboard_label", {
                  slot: slotLabel(slot),
                  defaultValue: "Klawiatura. Dotknięty klawisz trafi do pola: {{slot}}",
                })}
                bands={bands}
                emphasis={emphasis}
                activeKey={draft[slot]}
                centerRequest={centerRequest}
                onKeyPress={handleKeyPress}
                className="h-full"
              />
            </div>
          </div>

          {/* Nothing below the slots stands empty: the table, the comment and
              the send button arrive with the first note. */}
          <AnimatePresence initial={false}>
            {hasAnyNote ? (
              <motion.div
                key="table"
                {...arrival(reduceMotion, 0)}
                className="lg:col-span-2 lg:col-start-1 lg:mt-8"
              >
                <RangeNotationTable draft={draft} notation={notation} />
              </motion.div>
            ) : null}
            {hasAnyNote ? (
              <motion.div
                key="comment"
                {...arrival(reduceMotion, 1)}
                className="lg:col-span-2 lg:col-start-1 lg:mt-8"
              >
                <Textarea
                  label={t(
                    "vocal_range.comment_label",
                    "Uwagi dla dyrygenta (opcjonalnie)",
                  )}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={COMMENT_MAX_LENGTH}
                  readOnly={sent}
                  rows={3}
                />
                <Text
                  as="p"
                  size="xs"
                  color="muted"
                  className="mr-1 mt-1 text-right tabular-nums"
                >
                  {comment.length}/{COMMENT_MAX_LENGTH}
                </Text>
              </motion.div>
            ) : null}
            {hasAnyNote && !isTrial ? (
              <motion.footer
                key="footer"
                {...arrival(reduceMotion, 2)}
                className="flex flex-col items-start gap-3 lg:col-span-2 lg:col-start-1 lg:mt-8"
              >
                {sent ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Check
                        className="h-5 w-5 text-ethereal-sage"
                        aria-hidden="true"
                      />
                      <Heading as="p" size="xl">
                        {t("vocal_range.sent.title", "Wysłane")}
                      </Heading>
                    </div>
                    <Text color="graphite" className="max-w-md">
                      {t(
                        "vocal_range.sent.body",
                        "Dyrygent zobaczy Twój zakres. Zmienisz go w Ustawieniach, w zakładce Profil.",
                      )}
                    </Text>
                    <Button type="button" size="lg" onClick={leave}>
                      {t("vocal_range.sent.done", "Wróć do panelu")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="lg"
                      onClick={handleSend}
                      disabled={submission === null}
                      isLoading={submit.isPending}
                    >
                      {t("vocal_range.send", "Wyślij dyrygentowi")}
                    </Button>
                    {problem === "incomplete" ? (
                      <Text size="xs" color="muted">
                        {t(
                          "vocal_range.validation.incomplete",
                          "Wybierz obie granice tessitury, żeby wysłać.",
                        )}
                      </Text>
                    ) : null}
                    {submit.isError ? (
                      <Text size="sm" color="crimson" role="alert">
                        {t(
                          "vocal_range.send_error",
                          "Nie udało się wysłać. Spróbuj jeszcze raz.",
                        )}
                      </Text>
                    ) : null}
                  </>
                )}
              </motion.footer>
            ) : null}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
};

export interface VocalRangeScreenProps {
  readonly open: boolean;
  readonly mode: VocalRangeScreenMode;
  /** Opens over a first-run moment whose scene is already on screen: no fade
   *  of the backdrop, no redrawing of the stave. */
  readonly entersLit?: boolean;
  /** `prompt`: snooze. `revisit`: close the screen. */
  readonly onClose: () => void;
}

export const VocalRangeScreen = ({
  open,
  mode,
  entersLit = false,
  onClose,
}: VocalRangeScreenProps): React.JSX.Element | null => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useBodyScrollLock(open);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <VocalRangeStage
          key="vocal-range"
          mode={mode}
          entersLit={entersLit}
          onClose={onClose}
        />
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};
