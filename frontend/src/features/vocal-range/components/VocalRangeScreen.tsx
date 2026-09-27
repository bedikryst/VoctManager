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
 *    the panel;
 *  - `revisit` — the Settings row, which reopens it with the saved proposal.
 * Either way an unsent draft survives a close for the session and comes back
 * at the next opening.
 *
 * How it enters depends on what is on screen when it opens (`entrance`): as
 * the curtain on the panel's first frame, opaque from the start, so the panel
 * assembling underneath is never seen; over the welcome's scene, already lit;
 * or fading in over a panel already in use. Then the words arrive in order:
 * the header line by line, the slot line ruling itself in, the keyboard, the
 * status line.
 *
 * Layout, phone first. On a wide screen the header, the slots and everything
 * after them form the left column, and the keyboard stands on the right, one
 * screen tall and held in view. On a phone the slots and the keyboard are one
 * screen together: the slot strip sticks to the top of the scroll area and the
 * keyboard takes the rest of the viewport, so a note costs a tap on a slot and
 * a tap on a key, with no scrolling between. The keyboard opens on the voice's
 * own span (`keyboardWindow`), and a singer who reaches further asks for more
 * keys at either end of it. Nothing above the keys changes
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
 *
 * A slot can also be filled by voice. "Sing" opens the microphone and "Done"
 * closes it; nothing depends on holding the button. In between, the status
 * line names the note sung and says that the voice is neither recorded nor
 * heard by anyone, a cursor follows the voice on the keys, and each note held
 * for a moment fills the selected slot, silently. "Done" closes the
 * microphone, then plays the slot's note inside that tap, so an octave
 * misheard is caught by ear. Nothing plays while the microphone is open: a
 * sound stops when listening starts, and a key pressed while listening ends
 * it. The microphone names the note sung; the singer still decides which slot
 * it belongs in.
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
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { Check, Mic } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import {
  KEYBOARD_LIMIT,
  keyboardWindow,
  NO_REACH,
  SINGING_VOICES,
  singingVoiceOf,
  voiceCentreMidi,
  type KeyboardReach,
  type SingingVoice,
} from "@/features/artists/constants/voices";
import { getSectionPresentation } from "@/features/artists/constants/voiceSections";
import { usePitchNotation } from "@/features/artists/hooks/usePitchNotation";
import {
  playArpeggio,
  playVoicedTone,
  type VoicedToneHandle,
} from "@/shared/lib/audio/voicedTone";
import { usePitchDetection } from "@/shared/lib/audio/usePitchDetection";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { useFocusTrap } from "@/shared/lib/dom/useFocusTrap";
import {
  spokenPitch,
  type VocalRangeMidi,
} from "@/shared/lib/music/pitchNotation";
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
} from "@/shared/lib/music/rangeDraft";
import { cn } from "@/shared/lib/utils";
import { artistRoleLabel } from "@/shared/lib/voiceTypes";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import { NoteReadout } from "@/shared/ui/instruments/NoteReadout";
import { RangeSlots, SLOT_KEY } from "@/shared/ui/instruments/RangeSlots";
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

import { useSubmitVocalRange } from "../hooks/useSubmitVocalRange";
import {
  clearVocalRangeDraft,
  keepVocalRangeDraft,
  readVocalRangeDraft,
} from "../lib/vocalRangeSession";
import { RangeNotationTable } from "./RangeNotationTable";

/** The server's limit on the comment (`VocalRangeProposalDTO`). */
const COMMENT_MAX_LENGTH = 500;

/** The blocks under the slots rise into place one after another, or only fade
 *  in for a reader who prefers reduced motion. Present at the opening, they
 *  follow the entrance (`lead`); brought by the first note, they come at once.
 *  Their space opens below everything already on screen, so nothing above
 *  them moves while they come. */
const arrival = (reduceMotion: boolean, order: number, lead: number) => ({
  initial: { opacity: 0, y: reduceMotion ? 0 : 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.6, delay: lead + order * 0.09, ease: EASE.buttery },
});

/** How far into the entrance the blocks under the slots may start. */
const ENTRANCE_LEAD = 0.6;

/** The entrance's order: each level hands its children a stagger. */
const sequence = (stagger: number, delay = 0): Variants => ({
  hidden: {},
  shown: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

const rise = (reduceMotion: boolean): Variants => ({
  hidden: { opacity: 0, y: reduceMotion ? 0 : 14 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE.buttery } },
});

/** The keyboard comes in from its own side: the right on a wide screen, from
 *  below on a phone, where it stands under the slots. */
const keyboardEntrance = (reduceMotion: boolean, wide: boolean): Variants => ({
  hidden: {
    opacity: 0,
    x: reduceMotion || !wide ? 0 : 16,
    y: reduceMotion || wide ? 0 : 16,
  },
  shown: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 0.6, ease: EASE.buttery },
  },
});

const FADE_IN: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

/** Tailwind's `lg`, where the keyboard stands beside the words. */
const WIDE_QUERY = "(min-width: 64rem)";

/** What the status line under the slots is saying; a change of kind
 *  cross-fades, a new note within the readout does not. */
type StatusKind = "listening" | "order" | "mic" | "readout" | "hint";

const sameDraft = (
  a: VocalRangeMidi,
  aComment: string,
  b: VocalRangeMidi,
  bComment: string,
): boolean =>
  RANGE_SLOTS.every((slot) => a[slot] === b[slot]) &&
  aComment.trim() === bComment.trim();

export type VocalRangeScreenMode = "prompt" | "revisit";

/**
 * - `curtain`: the panel's first frame (login, app open, reload). The stage is
 *   opaque from the start and the scene lights itself.
 * - `lit`: over the welcome's scene, which is already on screen.
 * - `over`: over a panel already in use; the stage fades in.
 */
export type VocalRangeEntrance = "curtain" | "lit" | "over";

interface StageProps {
  readonly mode: VocalRangeScreenMode;
  readonly entrance: VocalRangeEntrance;
  readonly onClose: () => void;
}

/** Mounted only while open, so every opening starts from the saved proposal
 *  or the draft kept at the last close. */
const VocalRangeStage = ({
  mode,
  entrance,
  onClose,
}: StageProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const reduceMotion = useReducedMotion() ?? false;
  // Read once: it only chooses the side the keyboard enters from.
  const [wide] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  const riseIn = rise(reduceMotion);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const notation = usePitchNotation();

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
  // Blocks under the slots that mount during the entrance (a saved proposal,
  // a kept draft) wait for it; blocks brought later by a note come at once.
  const [entered, setEntered] = useState(false);
  const blocksLead = entered ? 0 : ENTRANCE_LEAD;
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

  /** How far the singer has widened the keyboard past the voice's own span,
   *  for this opening; a chosen note keeps its keys at the next one anyway. */
  const [reach, setReach] = useState<KeyboardReach>(NO_REACH);
  const keySpan = useMemo(
    () => keyboardWindow(voice, rangePitches(draft), reach),
    [voice, draft, reach],
  );

  /** More keys past one end, brought into view. The microphone listens in
   *  the widened span at once, so a note sung out of reach can be caught by
   *  widening while listening. */
  const widen = (side: keyof KeyboardReach): void => {
    const next = { ...reach, [side]: reach[side] + 1 };
    setReach(next);
    const span = keyboardWindow(voice, rangePitches(draft), next);
    requestCentre(side === "above" ? span.high : span.low);
  };
  const extendAbove =
    keySpan.high < KEYBOARD_LIMIT.high
      ? {
          label: t("vocal_range.keyboard_more_above", "Wyższe dźwięki"),
          onPress: () => widen("above"),
        }
      : null;
  const extendBelow =
    keySpan.low > KEYBOARD_LIMIT.low
      ? {
          label: t("vocal_range.keyboard_more_below", "Niższe dźwięki"),
          onPress: () => widen("below"),
        }
      : null;

  /** A refusal, a missing microphone or a timeout is said once, on the status
   *  line, until the next key or slot. */
  const [micNotice, setMicNotice] = useState(false);
  /** The last note the voice put in the slot during this listening; "Done"
   *  plays it back. */
  const sungNote = useRef<number | null>(null);
  // The microphone listens in the keyboard's own window: a note it could not
  // show on the keys is taken for an octave error, not for the singer's note.
  // A held note fills the slot without a sound, which the open microphone
  // would hear.
  const pitch = usePitchDetection(keySpan, (midi) => {
    sungNote.current = midi;
    setDraft((current) =>
      current[slot] === midi ? current : { ...current, [slot]: midi },
    );
    setAnnouncement(`${slotLabel(slot)}: ${spokenPitch(midi, notation)}`);
  });
  const isListening =
    pitch.status === "starting" || pitch.status === "listening";
  const micAvailable =
    pitch.supported &&
    pitch.status !== "denied" &&
    pitch.status !== "unavailable";
  const stopListening = pitch.cancel;

  // The stage stays mounted through its exit fade, so the hook's own unmount
  // comes too late: the microphone stops the moment the exit begins, however
  // the screen was closed. A hold must not fill a draft that has been kept.
  const isPresent = useIsPresent();
  useEffect(() => {
    if (!isPresent) stopListening();
  }, [isPresent, stopListening]);

  const leave = useCallback((): void => {
    stopListening();
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
  }, [
    baseComment,
    baseDraft,
    comment,
    draft,
    onClose,
    refreshUser,
    sent,
    stopListening,
  ]);

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

  const toggleListening = (): void => {
    if (isListening) {
      // "Done": the microphone closes first, then the slot's note plays in
      // this tap, which is also the gesture iOS wants for the sound.
      pitch.cancel();
      const sung = sungNote.current;
      sungNote.current = null;
      if (sung !== null) {
        setTouched(sung);
        ring((onEnded) => playVoicedTone(sung, onEnded));
      }
      return;
    }
    // A tap during the exit fade must not open a microphone nothing will
    // stop until the unmount.
    if (!isPresent) return;
    // The microphone must not hear the last note, and iOS ducks whatever
    // plays while it is open.
    tone.current?.stop();
    setTouched(null);
    setMicNotice(true);
    sungNote.current = null;
    pitch.start();
  };

  const pressKey = (midi: number): void => {
    pitch.cancel();
    setMicNotice(false);
    handleKeyPress(midi);
  };

  const selectSlot = (next: RangeSlot): void => {
    pitch.cancel();
    setMicNotice(false);
    setSlot(next);
    setTouched(null);
    requestCentre(slotCentre(next, draft, voiceCentreMidi(voice)));
  };

  const clearSlot = (): void => {
    pitch.cancel();
    setMicNotice(false);
    setDraft((current) => ({ ...current, [slot]: null }));
    setTouched(null);
  };

  const pickTrialVoice = (next: SingingVoice): void => {
    pitch.cancel();
    setTrialVoice(next);
    setReach(NO_REACH);
    requestCentre(slotCentre(slot, draft, voiceCentreMidi(next)));
  };
  const bands = useMemo(() => rangeBands(draft), [draft]);
  const emphasis = useMemo(() => slotSpan(slot, draft), [slot, draft]);

  const problem = rangeProblem(draft);
  const submission = toSubmission(draft, comment);
  const hasAnyNote = rangePitches(draft).length > 0;

  const handleSend = (): void => {
    if (submission === null || submit.isPending) return;
    pitch.cancel();
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
  const micMessage = !micNotice
    ? null
    : pitch.status === "denied"
      ? t(
          "vocal_range.mic.denied",
          "Bez dostępu do mikrofonu. Wybierz dźwięk na klawiaturze.",
        )
      : pitch.status === "unavailable"
        ? t(
            "vocal_range.mic.unavailable",
            "Mikrofon jest niedostępny. Wybierz dźwięk na klawiaturze.",
          )
        : pitch.status === "timedOut"
          ? t(
              "vocal_range.mic.timed_out",
              "Nie wychwycono trzymanego dźwięku. Spróbuj jeszcze raz.",
            )
          : null;
  const listeningText = t(
    "vocal_range.mic.listening",
    "Trzymany dźwięk trafi do pola.",
  );
  const privacyText = t(
    "vocal_range.mic.privacy",
    "Twój głos nie jest nagrywany ani nigdzie zapisywany. Nikt go nie usłyszy.",
  );
  // The status line cross-fades between elements, which a screen reader does
  // not follow; what the microphone is doing is said through the live region.
  const micSpoken =
    pitch.status === "listening"
      ? `${listeningText} ${privacyText}`
      : micMessage;
  useEffect(() => {
    if (micSpoken) setAnnouncement(micSpoken);
  }, [micSpoken]);
  const readoutMidi = touched ?? draft[slot];
  const statusKind: StatusKind = isListening
    ? "listening"
    : orderMessage
      ? "order"
      : micMessage
        ? "mic"
        : readoutMidi !== null
          ? "readout"
          : "hint";
  const micButtonLabel = isListening
    ? t("vocal_range.mic.stop", "Gotowe")
    : t("vocal_range.mic.start", "Zaśpiewaj");
  const presentation = getSectionPresentation(voice);
  const voiceLabel = (each: SingingVoice): string =>
    artistRoleLabel(t, each, null);

  return (
    <motion.div
      ref={dialogRef}
      initial={entrance === "over" ? { opacity: 0 } : false}
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
        lit={entrance === "lit"}
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
          initial="hidden"
          animate="shown"
          variants={sequence(0.2, 0.1)}
          onAnimationComplete={() => setEntered(true)}
          // Top-aligned, never centred: blocks arrive under the slots with the
          // first note, and a centred column would slide up under the finger.
          // On a wide screen the last row is flexible: it takes up whatever the
          // keyboard is taller than the left column, so the other rows keep
          // their own height and no gap opens between the header and the slots.
          className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-y-6 lg:grid-cols-3 lg:grid-rows-[auto_auto_auto_auto_1fr] lg:gap-x-12 lg:gap-y-0"
        >
          <motion.header
            variants={sequence(0.08)}
            className="flex flex-col items-start lg:col-span-2 lg:col-start-1"
          >
            <motion.div variants={riseIn}>
              <Eyebrow color="gold" as="p">
                {t("vocal_range.eyebrow", "Skala głosu")}
              </Eyebrow>
            </motion.div>
            <motion.div variants={riseIn}>
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
            </motion.div>
            <motion.div variants={riseIn}>
              <Text size="md" color="graphite" className="mt-3 max-w-xl leading-7">
                {t(
                  "vocal_range.intro",
                  "Podaj swoją tessiturę, czyli zakres dźwięków, które możesz swobodnie i naturalnie śpiewać w zespole, także piano. W nawiasach możesz dodatkowo podać skrajne dźwięki swojej skali, najniższy i najwyższy, które jesteś w stanie osiągnąć. To informacja dla dyrygenta i pomoże w odpowiednim doborze partii. Pozostali chórzyści jej nie zobaczą.",
                )}
              </Text>
            </motion.div>

            {isTrial ? (
              <motion.div
                variants={riseIn}
                className="mt-5 flex flex-col items-start gap-2"
              >
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
              </motion.div>
            ) : (
              <motion.span
                variants={riseIn}
                className="mt-4 inline-flex items-center gap-2"
              >
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
              </motion.span>
            )}
          </motion.header>

          {/* The bench: on a phone, one screen holding the slot strip and the
              keyboard; on a wide screen it dissolves into the grid, the strip
              in the left column and the keyboard alone on the right. */}
          <div className="flex h-[calc(var(--vr-view,100dvh)-env(safe-area-inset-bottom))] flex-col lg:contents">
            <motion.div
              variants={sequence(0.15)}
              className="sticky top-0 z-10 -mx-5 shrink-0 bg-glass-surface px-5 pb-2 pt-3 backdrop-blur-ethereal lg:static lg:col-span-2 lg:col-start-1 lg:mx-0 lg:mt-10 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0 lg:backdrop-blur-none"
            >
              <RangeSlots
                draft={draft}
                selected={slot}
                notation={notation}
                low={keySpan.low}
                high={keySpan.high}
                label={t("vocal_range.slots.group_label", "Twój zakres")}
                onSelect={selectSlot}
              />
              {/* One status line of fixed height: the note, a hint, or what is
                  out of order. Its height is the listening state on a phone:
                  the note on one line and the privacy line on two. The remove
                  button keeps its place while an extreme is selected, so
                  filling that slot moves nothing; it steps aside while the
                  microphone is open, where it would stand beside "Done". */}
              <motion.div
                variants={FADE_IN}
                className="mt-2 flex h-15 items-center gap-3"
              >
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
                      {statusKind === "listening" ? (
                        // The privacy line stands for as long as the
                        // microphone is open; above it, the note sung, live.
                        <div className="flex min-w-0 flex-col">
                          {pitch.note !== null ? (
                            <NoteReadout midi={pitch.note} notation={notation} />
                          ) : (
                            <Text as="p" size="md" color="graphite" className="truncate">
                              {listeningText}
                            </Text>
                          )}
                          <Text as="p" size="sm" color="muted" className="line-clamp-2 leading-4">
                            {privacyText}
                          </Text>
                        </div>
                      ) : statusKind === "order" ? (
                        <Text
                          size="sm"
                          color="crimson"
                          role="alert"
                          className="line-clamp-2 leading-5"
                        >
                          {orderMessage}
                        </Text>
                      ) : statusKind === "mic" ? (
                        <Text size="sm" color="muted" className="line-clamp-2 leading-5">
                          {micMessage}
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
                {/* Icon only on a phone, where the readout needs the width;
                    the name stays for assistive technology. */}
                {micAvailable && !sent ? (
                  <Button
                    type="button"
                    variant={isListening ? "primary" : "outline"}
                    size="sm"
                    onClick={toggleListening}
                    aria-label={micButtonLabel}
                    leftIcon={
                      isListening ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                      )
                    }
                    className="shrink-0"
                  >
                    <span className="hidden sm:inline">{micButtonLabel}</span>
                  </Button>
                ) : null}
                {isExtremeSlot(slot) && !sent && !isListening ? (
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
              </motion.div>
              <p className="sr-only" aria-live="polite">
                {announcement}
              </p>
            </motion.div>

            {/* On a wide screen the keyboard is one screen tall and stays in
                view, whatever the left column holds: it never grows when the
                blocks below the slots arrive. */}
            <motion.div
              variants={keyboardEntrance(reduceMotion, wide)}
              className="min-h-48 flex-1 pb-3 lg:sticky lg:top-4 lg:col-start-3 lg:row-span-5 lg:row-start-1 lg:h-[calc(var(--vr-view,100dvh)-3.5rem-env(safe-area-inset-bottom))] lg:self-start lg:pb-0"
            >
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
                liveCursor={pitch.cursor}
                centerRequest={centerRequest}
                onKeyPress={pressKey}
                extendAbove={extendAbove}
                extendBelow={extendBelow}
                className="h-full"
              />
            </motion.div>
          </div>

          {/* Nothing below the slots stands empty: the table, the comment and
              the send button arrive with the first note. */}
          <AnimatePresence>
            {hasAnyNote ? (
              <motion.div
                key="table"
                {...arrival(reduceMotion, 0, blocksLead)}
                className="lg:col-span-2 lg:col-start-1 lg:mt-8"
              >
                <RangeNotationTable draft={draft} notation={notation} />
              </motion.div>
            ) : null}
            {hasAnyNote ? (
              <motion.div
                key="comment"
                {...arrival(reduceMotion, 1, blocksLead)}
                className="lg:col-span-2 lg:col-start-1 lg:mt-8"
              >
                <Textarea
                  label={t(
                    "vocal_range.comment_label",
                    "Uwagi dla dyrygenta (opcjonalnie)",
                  )}
                  placeholder={t(
                    "vocal_range.comment_placeholder",
                    "Na przykład: w którym głosie czujesz się najlepiej.",
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
                {...arrival(reduceMotion, 2, blocksLead)}
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
  /** What is on screen when it opens; see `VocalRangeEntrance`. */
  readonly entrance?: VocalRangeEntrance;
  /** `prompt`: snooze. `revisit`: close the screen. */
  readonly onClose: () => void;
}

export const VocalRangeScreen = ({
  open,
  mode,
  entrance = "over",
  onClose,
}: VocalRangeScreenProps): React.JSX.Element => {
  useBodyScrollLock(open);

  // Portalled in the very first commit (a client-only app has no server render
  // to wait for): a curtain that arrived one effect later would show the
  // panel for a frame first.
  return createPortal(
    <AnimatePresence>
      {open ? (
        <VocalRangeStage
          key="vocal-range"
          mode={mode}
          entrance={entrance}
          onClose={onClose}
        />
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};
