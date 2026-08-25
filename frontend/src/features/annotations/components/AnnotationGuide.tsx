/**
 * @file AnnotationGuide.tsx
 * @description The answer to "co się stanie z tym, co tu napiszę?", given where
 * the question is actually asked — over the score, one tap from the pencil.
 *
 * Five facts, no more, because the point is that a singer reads it once between
 * two pieces and never opens it again: who can see this, what the red ink is,
 * where the marks live afterwards, that they reach the printed book, and that
 * none of it needs signal. The conductor's copy states the mirror image — which
 * of his two layers the choir receives, and that the singers' own pencil marks
 * are closed to him too.
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
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Heading, Text } from "@/shared/ui/primitives/typography";

interface AnnotationGuideProps {
  isOpen: boolean;
  mode: "conductor" | "personal";
  onClose: () => void;
}

interface GuideFact {
  icon: LucideIcon;
  title: string;
  body: string;
  /** The privacy line leads, and is the only one that gets the gold. */
  accent?: boolean;
}

export const AnnotationGuide = ({
  isOpen,
  mode,
  onClose,
}: AnnotationGuideProps): React.JSX.Element => {
  const { t } = useTranslation();

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

  const facts: GuideFact[] =
    mode === "personal"
      ? [
          {
            icon: Lock,
            accent: true,
            title: t("annotations.guide.personal.private_title", "Tylko Twoje"),
            body: t(
              "annotations.guide.personal.private_body",
              "Wszystko, co tu napiszesz, widzisz wyłącznie Ty. Nie widzi tego dyrygent ani nikt inny w chórze.",
            ),
          },
          {
            icon: Eye,
            title: t("annotations.guide.personal.shared_title", "Oznaczenia dyrygenta"),
            body: t(
              "annotations.guide.personal.shared_body",
              "Czerwone oznaczenia pochodzą od dyrygenta. Możesz je ukryć w panelu warstw, ale nie możesz ich zmienić ani skasować. Jeśli dopisze coś w trakcie próby, pojawią się same.",
            ),
          },
          {
            icon: FolderClosed,
            title: t("annotations.guide.personal.persist_title", "Zostają na stałe"),
            body: t(
              "annotations.guide.personal.persist_body",
              "Twoje ślady trzymają się utworu, nie tego jednego otwarcia. Znajdziesz je zawsze w Materiałach, przy tych samych nutach.",
            ),
          },
          {
            icon: BookOpen,
            title: t("annotations.guide.personal.book_title", "W książce nutowej"),
            body: t(
              "annotations.guide.personal.book_body",
              "Pobierając partyturę koncertu możesz włączyć „Moje oznaczenia” — wtedy zostaną dorysowane na Twoim egzemplarzu. Egzemplarz jest składany osobno dla Ciebie; nikt inny ich tam nie zobaczy.",
            ),
          },
          {
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
            icon: Eye,
            accent: true,
            title: t("annotations.guide.conductor.shared_title", "Warstwa „Chór”"),
            body: t(
              "annotations.guide.conductor.shared_body",
              "To, co napiszesz na tej warstwie, trafia do każdego chórzysty obsadzonego w projekcie z tym utworem. U nich jest tylko do odczytu.",
            ),
          },
          {
            icon: Lock,
            title: t("annotations.guide.conductor.private_title", "Warstwa „Prywatne”"),
            body: t(
              "annotations.guide.conductor.private_body",
              "Twoje własne wskazówki. Nie widzi ich nikt poza Tobą. Przełącznik przy narzędziach decyduje, na którą warstwę piszesz.",
            ),
          },
          {
            icon: Lock,
            title: t("annotations.guide.conductor.theirs_title", "Ich notatki są zamknięte"),
            body: t(
              "annotations.guide.conductor.theirs_body",
              "Ślady, które chórzyści robią na swoich nutach, są prywatne również przed Tobą — nie zobaczysz ich tutaj ani nigdzie indziej w panelu.",
            ),
          },
          {
            icon: BookOpen,
            title: t("annotations.guide.conductor.book_title", "Druk książki nutowej"),
            body: t(
              "annotations.guide.conductor.book_body",
              "Oznaczenia z warstwy „Chór” drukują się w książce nutowej, gdy w kokpicie jest włączona ich obsługa. Rysunek poza oprawionym zakresem stron nie wejdzie do druku — kokpit to sygnalizuje.",
            ),
          },
          {
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
          className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-ethereal-ink/70 p-4 backdrop-blur-md"
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
            className="no-scrollbar flex max-h-full w-full max-w-lg flex-col overflow-y-auto rounded-3xl border border-white/10 bg-ethereal-ink/95 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          >
            <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <Heading as="h2" size="md" color="marble">
                  {mode === "personal"
                    ? t("annotations.guide.personal.title", "Twoje ślady na nutach")
                    : t("annotations.guide.conductor.title", "Dwie warstwy oznaczeń")}
                </Heading>
                <Text as="p" size="sm" color="marble-muted" className="mt-1">
                  {mode === "personal"
                    ? t(
                        "annotations.guide.personal.lede",
                        "Krótko o tym, co się dzieje z tym, co tu zapiszesz.",
                      )
                    : t(
                        "annotations.guide.conductor.lede",
                        "Co dociera do chóru, a co zostaje przy Tobie.",
                      )}
                </Text>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.close_aria", "Zamknij")}
                className="shrink-0 rounded-full p-1.5 text-ethereal-marble/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <ul className="flex flex-col gap-4 px-5 py-5">
              {facts.map((fact) => (
                <li key={fact.title} className="flex items-start gap-3">
                  <span
                    className={
                      fact.accent
                        ? "mt-0.5 shrink-0 rounded-full bg-ethereal-gold/20 p-2 text-ethereal-gold"
                        : "mt-0.5 shrink-0 rounded-full bg-white/5 p-2 text-ethereal-marble/70"
                    }
                  >
                    <fact.icon size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <Text as="p" weight="semibold" color="marble">
                      {fact.title}
                    </Text>
                    <Text as="p" size="sm" color="marble-muted" className="mt-0.5">
                      {fact.body}
                    </Text>
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
