/**
 * @file AnnotationGuide.tsx
 * @description The answer to "co się stanie z tym, co tu napiszę?", given where
 * the question is actually asked — over the score, one tap from the pencil.
 *
 * A handful of facts and no more, because the point is that a reader takes it in
 * once between two pieces and never opens it again: who can see this, what the
 * red ink is, where the marks live afterwards, that they reach the printed book,
 * and that none of it needs signal.
 *
 * The conductor's copy leads with the one thing everything else follows from:
 * his three reaches are NESTED, and any mark can be moved between them after the
 * fact. That ladder is rendered from the same table the per-mark picker reads,
 * so the help and the control can never describe the layers differently.
 *
 * Below the facts, the tools that do not explain themselves: the selection, the
 * musical shapes, the boxed note and the jump link. The keys are listed only where a keyboard
 * is likely (a fine pointer is attached), and the pen's eraser end only on a
 * device that has seen a pen; the keys are read from the toolbar's own table.
 *
 * Rendered INSIDE the viewer's modal slot rather than as a portalled sheet: the
 * PDF modal and BottomSheet both sit on `z-focus-trap`, and stacking a second
 * focus trap over a full-screen one is a fight with no winner. The slot lies
 * over the viewer's own chrome, and its keys go through the annotator's
 * `claimKey`, which closes it on Escape and lets nothing else act behind it.
 * @module features/annotations/components
 */

import React, { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CloudOff,
  CornerDownRight,
  Eraser,
  Eye,
  FolderClosed,
  Hash,
  Keyboard,
  LassoSelect,
  Lock,
  Music,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useMediaQuery } from "@/shared/lib/dom/useMediaQuery";
import { cn } from "@/shared/lib/utils";
import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";

import { TOOL_DEFS } from "./AnnotationToolbar";
import { WRITE_LAYERS, writeLayerCopy } from "../lib/layers";
import { TOOL_KEYS } from "../lib/useAnnotationTools";
import type { DelegateLayer, ScoreAnnotatorMode } from "../useScoreAnnotator";

interface AnnotationGuideProps {
  isOpen: boolean;
  mode: ScoreAnnotatorMode;
  /** In `leader` mode, the layers the grant opens beside the reader's pencil. */
  delegateLayers: readonly DelegateLayer[];
  /**
   * Whether this reader actually holds cues written for whoever runs a
   * rehearsal. Their presence IS the permission, so it is also the only honest
   * trigger for explaining the layer — naming it to a singer who has none would
   * describe something they will never see.
   */
  hasLeaderMarks: boolean;
  /** Whether a pen has ever touched this device — the eraser end is a pen's. */
  stylusSeen: boolean;
  onClose: () => void;
}

interface GuideFact {
  /** Keyed on this, never on the translated title: two facts sharing a title in
   *  any one locale would be a silent React key collision. */
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
  /** The lead line, and the only one that gets the gold. */
  accent?: boolean;
  /** Renders the three reaches under the body, widest first. */
  rungs?: boolean;
  /** Renders each tool's key under the body. */
  keys?: boolean;
}

export const AnnotationGuide = ({
  isOpen,
  mode,
  delegateLayers,
  hasLeaderMarks,
  stylusSeen,
  onClose,
}: AnnotationGuideProps): React.JSX.Element => {
  const { t } = useTranslation();
  const layerCopy = writeLayerCopy(t);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const hasKeyboard = useMediaQuery("(any-pointer: fine)");

  // The panel takes focus when it opens, so a keyboard or a screen reader is
  // in it rather than behind it, and hands focus back to whatever opened it.
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });
    return () => opener?.focus({ preventScroll: true });
  }, [isOpen]);

  const leaderFact: GuideFact = {
    id: "leader",
    icon: UserCheck,
    title: t("annotations.guide.personal.leader_title", "Wskazówki dla prowadzącego"),
    body: t(
      "annotations.guide.personal.leader_body",
      "Prowadzisz tę próbę, więc dyrygent zostawił tu wskazówki napisane dla Ciebie. Reszta chóru ich nie widzi. Tak jak jego oznaczenia dla chóru — możesz je ukryć, ale nie zmienić ani skasować.",
    ),
  };

  // The lead fact is the one that differs between a singer and a leader: for
  // a singer everything they write is theirs alone; for a leader the toolbar
  // toggle decides whether the next mark is theirs, the whole choir's or the
  // conductor's too, and saying "only yours" there would be the wrong promise.
  // It names exactly the targets their grant opens.
  const forChoir = delegateLayers.includes("shared");
  const withConductor = delegateLayers.includes("leader");
  const leaderLead: Pick<GuideFact, "title" | "body"> =
    forChoir && withConductor
      ? {
          title: t("annotations.guide.leader.both_title", "Moje, dla chóru albo z dyrygentem"),
          body: t(
            "annotations.guide.leader.both_body",
            "Przełącznik przy narzędziach decyduje, gdzie trafi NASTĘPNE oznaczenie: „Moje” widzisz tylko Ty, „Chór” zobaczy każdy, kto śpiewa ten utwór, a „Z dyrygentem” tylko dyrygent i Ty. Zmienić i skasować możesz tylko własne oznaczenia — te od dyrygenta zostają jego.",
          ),
        }
      : withConductor
        ? {
            title: t("annotations.guide.leader.conductor_title", "Moje albo z dyrygentem"),
            body: t(
              "annotations.guide.leader.conductor_body",
              "Przełącznik przy narzędziach decyduje, gdzie trafi NASTĘPNE oznaczenie: „Moje” widzisz tylko Ty, „Z dyrygentem” zobaczy też dyrygent, ale nikt z chóru. Tak odpowiadasz na jego wskazówki tam, gdzie je zapisał. Zmienić i skasować możesz tylko własne oznaczenia.",
            ),
          }
        : {
            title: t("annotations.guide.leader.choir_title", "Moje albo dla chóru"),
            body: t(
              "annotations.guide.leader.choir_body",
              "Przełącznik przy narzędziach decyduje, gdzie trafi NASTĘPNE oznaczenie: „Moje” widzisz tylko Ty, „Chór” zobaczy każdy, kto śpiewa ten utwór. Zmienić i skasować możesz tylko własne oznaczenia — te od dyrygenta zostają jego.",
            ),
          };
  const leadFact: GuideFact =
    mode === "leader"
      ? {
          id: "choir",
          icon: forChoir ? Users : UserCheck,
          accent: true,
          ...leaderLead,
        }
      : {
          id: "private",
          icon: Lock,
          accent: true,
          title: t("annotations.guide.personal.private_title", "Tylko Twoje"),
          body: t(
            "annotations.guide.personal.private_body",
            "Wszystko, co tu napiszesz, widzisz wyłącznie Ty. Nie widzi tego dyrygent ani nikt inny w chórze.",
          ),
        };

  const facts: GuideFact[] =
    mode !== "conductor"
      ? [
          leadFact,
          {
            id: "shared",
            icon: Eye,
            title: t("annotations.guide.personal.shared_title", "Oznaczenia dyrygenta"),
            body: t(
              "annotations.guide.personal.shared_body",
              "Czerwone oznaczenia pochodzą od dyrygenta. Możesz je ukryć w panelu warstw, ale nie możesz ich zmienić ani skasować. Jeśli dopisze coś w trakcie próby, pojawią się same.",
            ),
          },
          // Only where it is true: a singer who was never handed an evening
          // would be reading about a layer that does not exist for them.
          ...(hasLeaderMarks ? [leaderFact] : []),
          {
            id: "persist",
            icon: FolderClosed,
            title: t("annotations.guide.personal.persist_title", "Zostają na stałe"),
            body: t(
              "annotations.guide.personal.persist_body",
              "Twoje ślady trzymają się utworu, nie tego jednego otwarcia. Znajdziesz je zawsze w Materiałach, przy tych samych nutach.",
            ),
          },
          {
            id: "book",
            icon: BookOpen,
            title: t("annotations.guide.personal.book_title", "W książce nutowej"),
            body: t(
              "annotations.guide.personal.book_body",
              "Pobierając partyturę koncertu możesz włączyć „Moje oznaczenia” — wtedy zostaną dorysowane na Twoim egzemplarzu. Egzemplarz jest składany osobno dla Ciebie; nikt inny ich tam nie zobaczy.",
            ),
          },
          {
            id: "offline",
            icon: CloudOff,
            title: t("annotations.guide.personal.offline_title", "Działa bez internetu"),
            body: t(
              "annotations.guide.personal.offline_body",
              "Możesz pisać bez zasięgu. Zmiany czekają na urządzeniu i wyślą się same, gdy sieć wróci — nawet jeśli w międzyczasie zamkniesz aplikację.",
            ),
          },
        ]
      : [
          {
            id: "reach",
            icon: Eye,
            accent: true,
            rungs: true,
            title: t("annotations.guide.conductor.reach_title", "Kto zobaczy Twoje oznaczenie"),
            body: t(
              "annotations.guide.conductor.reach_body",
              "Każde oznaczenie ma jeden zasięg, a zasięgi zawierają się w sobie. Zmienisz go po fakcie: dotknij oznaczenia na nutach i wybierz, kto ma je widzieć. Przełącznik przy narzędziach decyduje tylko o NASTĘPNYM.",
            ),
          },
          {
            id: "theirs",
            icon: Lock,
            title: t("annotations.guide.conductor.theirs_title", "Ich notatki są zamknięte"),
            body: t(
              "annotations.guide.conductor.theirs_body",
              "Ślady, które chórzyści robią na swoich nutach, są prywatne również przed Tobą — nie zobaczysz ich tutaj ani nigdzie indziej w panelu.",
            ),
          },
          {
            id: "book",
            icon: BookOpen,
            title: t("annotations.guide.conductor.book_title", "Druk książki nutowej"),
            body: t(
              "annotations.guide.conductor.book_body",
              "Oznaczenia z zasięgu „Chór” drukują się w książce nutowej, gdy w kokpicie jest włączona ich obsługa. Prowadzący próbę może dociągnąć swój zasięg na własny egzemplarz. Rysunek poza oprawionym zakresem stron nie wejdzie do druku — kokpit to sygnalizuje.",
            ),
          },
          {
            id: "offline",
            icon: CloudOff,
            title: t("annotations.guide.conductor.offline_title", "Przygotowanie bez sieci"),
            body: t(
              "annotations.guide.conductor.offline_body",
              "Możesz przygotować oznaczenia bez zasięgu. Czekają na urządzeniu i wysyłają się same po powrocie sieci — również po zamknięciu aplikacji.",
            ),
          },
        ];

  const toolFacts: GuideFact[] = [
    {
      id: "select",
      icon: LassoSelect,
      title: t("annotations.guide.tools.select_title", "Zaznacz kilka naraz"),
      body: t(
        "annotations.guide.tools.select_body",
        "Narzędziem Zaznacz obwiedź oznaczenia pętlą albo dotykaj ich po kolei. Ramkę przeciągasz, żeby je przesunąć, a na karcie zmienisz im kolor, powielisz je, skopiujesz na inną stronę tego utworu albo usuniesz. Każdą z tych zmian cofa jedno „Cofnij”.",
      ),
    },
    {
      id: "shapes",
      icon: Music,
      title: t("annotations.guide.tools.shapes_title", "Widełki, łuk i klamra"),
      body: t(
        "annotations.guide.tools.shapes_body",
        "Wybierz je w Kształtach i przeciągnij od początku do końca frazy. Od lewej do prawej łuk wygina się w górę, a klamra ma haczyki w dół, tak jak nad pięciolinią. Od prawej do lewej oba się odwracają.",
      ),
    },
    {
      id: "box",
      icon: Hash,
      title: t("annotations.guide.tools.box_title", "Litery orientacyjne i numery taktów"),
      body: t(
        "annotations.guide.tools.box_body",
        "Notatka „W ramce” wygląda jak litera orientacyjna albo numer taktu w nutach: pogrubiona, w prostokącie. Tak samo się drukuje.",
      ),
    },
    {
      id: "link",
      icon: CornerDownRight,
      title: t("annotations.guide.tools.link_title", "Skok w inne miejsce"),
      body: t(
        "annotations.guide.tools.link_body",
        "Narzędziem Skok dotknij miejsca, z którego się skacze, np. przy D.S., potem przewróć na stronę, do której prowadzi, i dotknij celu. Dotknięcie strzałki przenosi tam, a „Wróć” z powrotem. Usuniesz go gumką. Do druku skok nie trafia.",
      ),
    },
    {
      id: "voices",
      icon: Users,
      title: t("annotations.guide.tools.voices_title", "Uwagi dla jednego głosu"),
      body:
        mode === "personal"
          ? t(
              "annotations.guide.tools.voices_reader_body",
              "Dyrygent może skierować uwagę do jednej sekcji. W panelu adnotacji wybierz „Mój głos + tutti”, a zobaczysz tylko uwagi dla swojego głosu i dla wszystkich.",
            )
          : t(
              "annotations.guide.tools.voices_writer_body",
              "Przy narzędziach wybierz S, A, T albo B, a następne oznaczenie będzie dla tej sekcji. Na karcie oznaczenia zmienisz to po fakcie. Inni nadal je widzą, ale „Powiadom chór” powie tylko tym głosom, a chórzysta może czytać sam swój głos.",
            ),
    },
    ...(hasKeyboard
      ? [
          {
            id: "keys",
            icon: Keyboard,
            keys: true,
            title: t("annotations.guide.tools.keys_title", "Z klawiatury"),
            body: t(
              "annotations.guide.tools.keys_body",
              "Delete usuwa zaznaczenie, a strzałki je przesuwają (z Shiftem dalej). Ctrl+Z lub ⌘Z cofa, z Shiftem ponawia. Esc odkłada narzędzie.",
            ),
          },
        ]
      : []),
    ...(stylusSeen
      ? [
          {
            id: "eraser_end",
            icon: Eraser,
            title: t("annotations.guide.tools.eraser_end_title", "Gumka w rysiku"),
            body: t(
              "annotations.guide.tools.eraser_end_body",
              "Jeśli Twój rysik ma gumkę na drugim końcu, odwróć go i potrzyj oznaczenie. Zniknie bez zmiany narzędzia.",
            ),
          },
        ]
      : []),
  ];

  const renderFact = (fact: GuideFact): React.JSX.Element => (
    <li key={fact.id} className="flex items-start gap-3">
      <span
        className={
          fact.accent
            ? "mt-0.5 shrink-0 rounded-full bg-ethereal-gold/20 p-2 text-ethereal-gold"
            : "mt-0.5 shrink-0 rounded-full bg-ink-on-inverse/5 p-2 text-ink-on-inverse/70"
        }
      >
        <fact.icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <Text as="p" weight="semibold" color="ink-on-inverse">
          {fact.title}
        </Text>
        <Text as="p" size="sm" color="ink-on-inverse-muted" className="mt-0.5">
          {fact.body}
        </Text>
        {/* The ladder itself, widest reach first and read from the
            same table as the picker on a mark — so the help cannot
            drift from the control it describes. */}
        {fact.rungs && (
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {WRITE_LAYERS.map((rung) => {
              const { Icon, short, hint, tone } = layerCopy[rung];
              return (
                <li
                  key={rung}
                  className="flex items-start gap-2.5 rounded-nested bg-ink-on-inverse/5 px-2.5 py-2"
                >
                  <span
                    className={cn(
                      "mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      tone,
                    )}
                  >
                    <Icon size={13} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <Text
                      as="span"
                      size="sm"
                      weight="semibold"
                      color="ink-on-inverse"
                      className="block"
                    >
                      {short}
                    </Text>
                    <Caption color="ink-on-inverse-muted" className="block">
                      {hint}
                    </Caption>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {/* One key per tool, from the toolbar's own table. */}
        {fact.keys && (
          <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {TOOL_DEFS.map(({ id, labelKey, fallback }) => (
              <li key={id} className="flex items-center gap-2">
                <Caption
                  as="kbd"
                  color="ink-on-inverse"
                  className="flex h-6 min-w-6 items-center justify-center rounded-md border border-line-on-inverse bg-ink-on-inverse/10 px-1.5 font-semibold"
                >
                  {TOOL_KEYS[id].toUpperCase()}
                </Caption>
                <Caption color="ink-on-inverse-muted">{t(labelKey, fallback)}</Caption>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          // The viewer hands its modal slot out with pointer-events off, so
          // every layer that wants a click has to switch them back on — without
          // this the backdrop is scenery and the panel cannot be dismissed.
          // A scrim, not a surface — black on both themes.
          className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, transform: "translateY(16px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: "translateY(16px)" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            className="no-scrollbar flex max-h-full w-full max-w-lg flex-col overflow-y-auto rounded-3xl border border-line-on-inverse bg-surface-inverse/95 shadow-[0_8px_32px_rgba(0,0,0,0.5)] outline-none"
          >
            <header className="flex items-start justify-between gap-3 border-b border-line-on-inverse px-5 py-4">
              <div className="min-w-0">
                <Heading as="h2" id={titleId} size="md" color="ink-on-inverse">
                  {mode === "conductor"
                    ? t("annotations.guide.conductor.title", "Trzy zasięgi oznaczeń")
                    : mode === "leader"
                      ? t("annotations.guide.leader.title", "Dwa zasięgi Twoich oznaczeń")
                      : t("annotations.guide.personal.title", "Twoje ślady na nutach")}
                </Heading>
                <Text as="p" size="sm" color="ink-on-inverse-muted" className="mt-1">
                  {mode === "conductor"
                    ? t(
                        "annotations.guide.conductor.lede",
                        "Co dociera do chóru, co do prowadzącego próbę, a co zostaje przy Tobie.",
                      )
                    : mode === "leader"
                      ? t(
                          "annotations.guide.leader.lede",
                          "Co zostaje przy Tobie, a co zobaczy cały chór.",
                        )
                      : t(
                          "annotations.guide.personal.lede",
                          "Krótko o tym, co się dzieje z tym, co tu zapiszesz.",
                        )}
                </Text>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.close_aria", "Zamknij")}
                className="shrink-0 rounded-full p-1.5 text-ink-on-inverse/70 transition-colors hover:bg-ink-on-inverse/10 hover:text-ink-on-inverse"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <ul className="flex flex-col gap-4 px-5 py-5">{facts.map(renderFact)}</ul>

            {/* The tools that do not explain themselves. */}
            <section className="border-t border-line-on-inverse px-5 py-5">
              <Eyebrow as="h3" color="ink-on-inverse-muted">
                {t("annotations.guide.tools.title", "Narzędzia")}
              </Eyebrow>
              <ul className="mt-3 flex flex-col gap-4">{toolFacts.map(renderFact)}</ul>
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
