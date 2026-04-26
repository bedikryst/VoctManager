/**
 * @file LegalModals.tsx
 * @description Enterprise-grade legal modals for Terms of Service and Privacy Policy.
 * Compliant with Ethereal UI constraints (Glassmorphism, CVA Typography).
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Printer } from "lucide-react";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";
import { Button } from "@/shared/ui/primitives/Button";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";

export interface LegalModalProps {
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

  const handlePrint = (): void => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-toast flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-ethereal-ink/60 backdrop-blur-sm"
          aria-hidden="true"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl max-h-[150vh] flex flex-col"
          role="dialog"
          aria-modal="true"
        >
          <GlassCard
            variant="solid"
            padding="none"
            isHoverable={false}
            className="flex flex-col h-full overflow-hidden shadow-glass-ethereal"
          >
            <div className="flex items-center justify-between p-6 border-b border-ethereal-incense/10 bg-white/5">
              <div>
                <Heading size="3xl" weight="medium" color="default">
                  {type === "privacy"
                    ? "Polityka Prywatności"
                    : "Regulamin Serwisu"}
                </Heading>
                <Eyebrow color="muted" className="mt-1">
                  Ostatnia aktualizacja: 26.04.2026
                </Eyebrow>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrint}
                  className="hidden sm:flex"
                >
                  <Printer className="w-4 h-4 ml-3 items-center" />
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

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-white/40">
              {type === "privacy" ? <PrivacyContent /> : <TermsContent />}
            </div>

            <div className="p-4 border-t border-ethereal-incense/10 flex justify-end bg-white/50">
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

const PrivacyContent: React.FC = () => (
  <div className="space-y-6">
    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        1. Administrator Danych
      </Eyebrow>
      <Text color="graphite" size="md" className="mt-2">
        Administratorem Twoich danych jest Fundacja „VoctFoundation” z siedzibą
        w Krakowie (31-150), ul. Św. Filipa 23/3. Kontakt w sprawach ochrony
        danych: rodo@voctfoundation.pl.
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        2. Cele i Podstawy Przetwarzania
      </Eyebrow>
      <ul className="space-y-3 list-none pl-0 m-0">
        <li>
          <Text weight="bold" color="default" size={"md"} className="mt-2">
            Konto i Komunikacja:
          </Text>
          <Text size="md" color="graphite" className="mt-1">
            Imię, nazwisko, e-mail, telefon – niezbędne do realizacji współpracy
            (Art. 6 ust. 1 lit. b RODO).
          </Text>
        </li>
        <li>
          <Text weight="bold" color="default" size={"md"}>
            Logistyka:
          </Text>
          <Text size="md" color="graphite" className="mt-1">
            Rozmiar ubrań i dane transportowe – nasz prawnie uzasadniony interes
            w organizacji produkcji (Art. 6 ust. 1 lit. f RODO).
          </Text>
        </li>
        {/* Tekst poniżej został usunięty w ostatniej aktualizacji, ale zostawiam go tutaj dla kontekstu i ewentualnego przywrócenia w przyszłości. --- IGNORE ---
        <li>
          <Text weight="bold" color="default" size={"md"}>
            Rozliczenia:
          </Text>
          <Text size="md" color="graphite" className="mt-1">
            PESEL, nr konta – obowiązek prawny (podatkowy/księgowy) przy
            generowaniu umów.
          </Text>
        </li>
            */}
      </ul>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        3. Dostawcy i Transfer Danych
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        Dane powierzamy: DigitalOcean (serwery), Google (mapy lokalizacji),
        Spotify (widgety audio). Korzystanie z Google/Spotify może wiązać się z
        transferem do USA w ramach Data Privacy Framework.
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        4. Twoje Prawa
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        Masz prawo do wglądu, sprostowania oraz usunięcia danych w dowolnym
        momencie w ustawieniach profilu. Dane rozliczeniowe przechowujemy przez
        5 lat zgodnie z wymogami skarbowymi.
      </Text>
    </div>
  </div>
);

const TermsContent: React.FC = () => (
  <div className="space-y-6">
    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        1. Zasady Korzystania
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        VoctManager jest wewnętrznym systemem Fundacji. Dostęp jest osobisty i
        nieprzenoszalny. Zakazuje się udostępniania linków iCal oraz haseł
        osobom trzecim.
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        2. Własność Intelektualna
      </Eyebrow>
      <div className="bg-ethereal-gold/30 p-3 border-l-2 border-ethereal-gold mt-2">
        <Text size="md" color="graphite" className="italic">
          Wszelkie nuty (PDF), nagrania (MP3) i materiały edukacyjne są
          własnością Fundacji lub twórców. Dostęp jest udzielany wyłącznie do
          celów przygotowania do koncertów. Kopiowanie i publiczne
          rozpowszechnianie bez zgody Zarządu jest surowo zabronione.
        </Text>
      </div>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        3. Poufność (NDA)
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        Listy obsady, stawki, lokalizacje prób i plany produkcyjne są objęte
        tajemnicą. Obowiązuje zakaz robienia i publikowania zrzutów ekranu z
        aplikacji.
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        4. Deklaracje i Nieobecności
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        Kliknięcie "Akceptuję projekt" w systemie jest traktowane jako wiążąca
        deklaracja udziału. Nieobecności muszą być zgłaszane przez moduł
        systemowy z odpowiednim wyprzedzeniem.
      </Text>
    </div>
  </div>
);
