import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Printer, Download } from "lucide-react";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Text, Caption } from "@/shared/ui/primitives/typography";
import { Button } from "@/shared/ui/primitives/Button";
import { Divider } from "@/shared/ui/primitives/Divider";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "privacy" | "terms";
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  type,
}) => {
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden"
        >
          <GlassCard className="flex flex-col h-full border-white/10 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <Heading level={2} className="text-white">
                  {type === "privacy"
                    ? "Polityka Prywatności"
                    : "Regulamin Platformy"}
                </Heading>
                <Caption className="text-white/50">
                  Ostatnia aktualizacja: 26.04.2026
                </Caption>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrint}
                  className="hidden sm:flex"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Drukuj
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-black/20">
              {type === "privacy" ? <PrivacyContent /> : <TermsContent />}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 flex justify-end bg-black/40">
              <Button variant="primary" onClick={onClose}>
                Rozumiem i zamykam
              </Button>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const PrivacyContent = () => (
  <article className="space-y-6 text-white/80">
    <section>
      <Heading level={4} className="mb-2 text-primary-400">
        1. Administrator Danych
      </Heading>
      <Text>
        Administratorem Twoich danych jest **Fundacja „VoctFoundation”** z
        siedzibą w Krakowie (31-150), ul. Św. Filipa 23/3. Kontakt w sprawach
        ochrony danych: **rodo@voctfoundation.pl**.
      </Text>
    </section>

    <section>
      <Heading level={4} className="mb-2 text-primary-400">
        2. Cele i Podstawy Przetwarzania
      </Heading>
      <ul className="space-y-3 list-none pl-0">
        <li>
          <Text weight="bold" className="text-white">
            Konto i Komunikacja:
          </Text>
          <Text size="sm">
            Imię, nazwisko, e-mail, telefon – niezbędne do realizacji współpracy
            (Art. 6 ust. 1 lit. b RODO).
          </Text>
        </li>
        <li>
          <Text weight="bold" className="text-white">
            Dieta i Alergie (Dane Wrażliwe):
          </Text>
          <Text size="sm">
            Przetwarzane wyłącznie na podstawie Twojej wyraźnej zgody w celu
            zapewnienia bezpieczeństwa podczas projektów (Art. 9 ust. 2 lit. a
            RODO).
          </Text>
        </li>
        <li>
          <Text weight="bold" className="text-white">
            Logistyka:
          </Text>
          <Text size="sm">
            Rozmiar ubrań i dane transportowe – nasz prawnie uzasadniony interes
            w organizacji produkcji (Art. 6 ust. 1 lit. f RODO).
          </Text>
        </li>
        <li>
          <Text weight="bold" className="text-white">
            Rozliczenia:
          </Text>
          <Text size="sm">
            PESEL, nr konta – obowiązek prawny (podatkowy/księgowy) przy
            generowaniu umów.
          </Text>
        </li>
      </ul>
    </section>

    <section>
      <Heading level={4} className="mb-2 text-primary-400">
        3. Dostawcy i Transfer Danych
      </Heading>
      <Text size="sm">
        Dane powierzamy: DigitalOcean (serwery), Google (mapy lokalizacji),
        Spotify (widgety audio). Korzystanie z Google/Spotify może wiązać się z
        transferem do USA w ramach Data Privacy Framework.
      </Text>
    </section>

    <section>
      <Heading level={4} className="mb-2 text-primary-400">
        4. Twoje Prawa
      </Heading>
      <Text size="sm">
        Masz prawo do wglądu, sprostowania, usunięcia danych oraz wycofania
        zgody na dane dietetyczne w dowolnym momencie w ustawieniach profilu.
        Dane rozliczeniowe przechowujemy przez 5 lat zgodnie z wymogami
        skarbowymi.
      </Text>
    </section>
  </article>
);

const TermsContent = () => (
  <article className="space-y-6 text-white/80">
    <section>
      <Heading level={4} className="mb-2 text-primary-400">
        1. Zasady Korzystania
      </Heading>
      <Text size="sm">
        VoctManager jest wewnętrznym systemem Fundacji. Dostęp jest osobisty i
        nieprzenoszalny. Zakazuje się udostępniania linków iCal oraz haseł
        osobom trzecim.
      </Text>
    </section>

    <section>
      <Heading level={4} className="mb-2 text-primary-400">
        2. Własność Intelektualna
      </Heading>
      <Text
        size="sm"
        className="bg-primary-500/10 p-3 border-l-2 border-primary-500 italic"
      >
        Wszelkie nuty (PDF), nagrania (MP3/Spotify) i materiały edukacyjne są
        własnością Fundacji lub twórców. Dostęp jest udzielany wyłącznie do
        celów przygotowania do koncertów. Kopiowanie i publiczne
        rozpowszechnianie bez zgody Zarządu jest surowo zabronione.
      </Text>
    </section>

    <section>
      <Heading level={4} className="mb-2 text-primary-400">
        3. Poufność (NDA)
      </Heading>
      <Text size="sm">
        Listy obsady, stawki, lokalizacje prób i plany produkcyjne są objęte
        tajemnicą. Obowiązuje zakaz robienia i publikowania zrzutów ekranu z
        aplikacji.
      </Text>
    </section>

    <section>
      <Heading level={4} className="mb-2 text-primary-400">
        4. Deklaracje i Nieobecności
      </Heading>
      <Text size="sm">
        Kliknięcie "Akceptuję projekt" w systemie jest traktowane jako wiążąca
        deklaracja udziału. Nieobecności muszą być zgłaszane przez moduł
        systemowy z odpowiednim wyprzedzeniem.
      </Text>
    </section>
  </article>
);
