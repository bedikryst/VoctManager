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
 * Rendered INSIDE the viewer's overlay rather than as a portalled sheet: the
 * PDF modal and BottomSheet both sit on `z-focus-trap`, and stacking a second
 * focus trap over a full-screen one is a fight with no winner.
 * @module features/annotations/components
 */

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CloudOff,
  Eye,
  FolderClosed,
  Lock,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Caption, Heading, Text } from "@/shared/ui/primitives/typography";

import { WRITE_LAYERS, writeLayerCopy } from "../lib/layers";

interface AnnotationGuideProps {
  isOpen: boolean;
  mode: "conductor" | "personal";
  /**
   * Whether this reader actually holds cues written for whoever runs a
   * rehearsal. Their presence IS the permission, so it is also the only honest
   * trigger for explaining the layer — naming it to a singer who has none would
   * describe something they will never see.
   */
  hasLeaderMarks: boolean;
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
}

export const AnnotationGuide = ({
  isOpen,
  mode,
  hasLeaderMarks,
  onClose,
}: AnnotationGuideProps): React.JSX.Element => {
  const { t } = useTranslation();
  const layerCopy = writeLayerCopy(t);

  // Escape belongs to the topmost thing on screen. The viewer is a Radix dialog
  // listening on the document, so without claiming the key here first, dismissing
  // this panel would slam the whole score shut — and the reader would have to
  // find their page again to learn one fact about privacy.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, onClose]);

  const leaderFact: GuideFact = {
    id: "leader",
    icon: UserCheck,
    title: t("annotations.guide.personal.leader_title", "Wskazówki dla prowadzącego"),
    body: t(
      "annotations.guide.personal.leader_body",
      "Prowadzisz tę próbę, więc dyrygent zostawił tu wskazówki napisane dla Ciebie. Reszta chóru ich nie widzi. Tak jak jego oznaczenia dla chóru — możesz je ukryć, ale nie zmienić ani skasować.",
    ),
  };

  const facts: GuideFact[] =
    mode === "personal"
      ? [
          {
            id: "private",
            icon: Lock,
            accent: true,
            title: t("annotations.guide.personal.private_title", "Tylko Twoje"),
            body: t(
              "annotations.guide.personal.private_body",
              "Wszystko, co tu napiszesz, widzisz wyłącznie Ty. Nie widzi tego dyrygent ani nikt inny w chórze.",
            ),
          },
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          // The viewer hands its overlay slot out with pointer-events off, so
          // every layer that wants a click has to switch them back on — without
          // this the backdrop is scenery and the panel cannot be dismissed.
          // A scrim, not a surface — black on both themes.
          className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="false"
            onClick={(event) => event.stopPropagation()}
            className="no-scrollbar flex max-h-full w-full max-w-lg flex-col overflow-y-auto rounded-3xl border border-line-on-inverse bg-surface-inverse/95 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          >
            <header className="flex items-start justify-between gap-3 border-b border-line-on-inverse px-5 py-4">
              <div className="min-w-0">
                <Heading as="h2" size="md" color="ink-on-inverse">
                  {mode === "personal"
                    ? t("annotations.guide.personal.title", "Twoje ślady na nutach")
                    : t("annotations.guide.conductor.title", "Trzy zasięgi oznaczeń")}
                </Heading>
                <Text as="p" size="sm" color="ink-on-inverse-muted" className="mt-1">
                  {mode === "personal"
                    ? t(
                        "annotations.guide.personal.lede",
                        "Krótko o tym, co się dzieje z tym, co tu zapiszesz.",
                      )
                    : t(
                        "annotations.guide.conductor.lede",
                        "Co dociera do chóru, co do prowadzącego próbę, a co zostaje przy Tobie.",
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

            <ul className="flex flex-col gap-4 px-5 py-5">
              {facts.map((fact) => (
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
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
