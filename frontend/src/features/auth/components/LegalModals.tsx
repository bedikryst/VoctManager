/**
 * @file LegalModals.tsx
 * @description Enterprise-grade legal modals for Terms of Service and Privacy Policy.
 * Compliant with Ethereal UI constraints (Glassmorphism, CVA Typography).
 * Updated: 2026-04-26
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
      <div className="fixed inset-0 z-20 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-ethereal-ink/60 backdrop-blur-sm"
          aria-hidden="true"
        />

        <div className="relative w-full max-w-4xl">
          <GlassCard
            as={motion.div}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            variant="solid"
            padding="none"
            isHoverable={false}
            className="relative w-full max-h-[90vh] flex flex-col min-h-0 shadow-glass-ethereal overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
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
                  <Printer className="w-4 h-4 ml-3" />
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

            {/* Content Area */}
            <div className="min-h-0 flex-1 overflow-y-auto touch-pan-y overscroll-contain pointer-events-auto p-6 space-y-8 custom-scrollbar bg-white/40">
              {type === "privacy" ? <PrivacyContent /> : <TermsContent />}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-ethereal-incense/10 flex justify-end bg-white/50">
              <Button variant="primary" onClick={onClose} className="mr-6">
                Rozumiem i zamykam
              </Button>
            </div>
          </GlassCard>
        </div>
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
        danych: kontakt@voctensemble.com.
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        2. Cele i Podstawy Przetwarzania
      </Eyebrow>
      <ul className="space-y-4 list-none pl-0 m-0">
        <li>
          <Text weight="bold" color="default" size={"md"} className="mt-2">
            Obsługa Konta i Współpraca:
          </Text>
          <Text size="md" color="graphite" className="mt-1">
            Imię, nazwisko, e-mail, telefon – dane niezbędne do realizacji celów
            statutowych Fundacji i współpracy artystycznej (Art. 6 ust. 1 lit. b
            RODO).
          </Text>
        </li>
        <li>
          <Text weight="bold" color="default" size={"md"}>
            Logistyka i Produkcja:
          </Text>
          <Text size="md" color="graphite" className="mt-1">
            Rozmiar ubrań (kostiumy) oraz dane o lokalizacji – nasz prawnie
            uzasadniony interes w organizacji produkcji koncertowych (Art. 6
            ust. 1 lit. f RODO).
          </Text>
        </li>
        <li>
          <Text weight="bold" color="default" size={"md"} className="mt-2">
            Przygotowanie Umów:
          </Text>
          <Text size="md" color="graphite" className="mt-1">
            Imię i nazwisko są wykorzystywane do generowania wzorów dokumentów.
            Pozostałe dane (PESEL, adres) są uzupełniane przez Użytkownika
            ręcznie poza systemem.
          </Text>
        </li>
      </ul>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        3. Technologie i Bezpieczeństwo (JWT)
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        Aplikacja wykorzystuje technologię JWT (JSON Web Token) przechowywaną w
        pamięci przeglądarki (LocalStorage) wyłącznie w celu utrzymania sesji
        logowania oraz zapewnienia bezpieczeństwa dostępu do danych. Nie
        stosujemy ciasteczek śledzących.
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        4. Odbiorcy Danych
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        Dane powierzamy sprawdzonym dostawcom: DigitalOcean (infrastruktura
        serwerowa) oraz Google (usługi map). Korzystanie z widgetów audio może
        wiązać się z transferem technicznym danych do USA w oparciu o Data
        Privacy Framework.
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        5. Twoje Prawa
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        Masz prawo do: wglądu w swoje dane, ich sprostowania, usunięcia,
        ograniczenia przetwarzania, przenoszenia danych oraz wniesienia
        sprzeciwu. Przysługuje Ci również prawo do wniesienia skargi do Prezesa
        Urzędu Ochrony Danych Osobowych (PUODO).
      </Text>
    </div>
  </div>
);

const TermsContent: React.FC = () => (
  <div className="space-y-6">
    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        1. Charakter Systemu
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        VoctManager jest wewnętrznym narzędziem operacyjnym Fundacji. Dostęp do
        niego jest przyznawany indywidualnie. Zakazuje się udostępniania danych
        dostępowych oraz personalnych linków iCal osobom trzecim.
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        2. Własność Intelektualna i Materiały
      </Eyebrow>
      <div className="bg-ethereal-gold/10 p-4 border-l-2 border-ethereal-gold mt-2">
        <Text size="md" color="graphite" className="italic mt-2">
          Wszelkie nuty (PDF), nagrania próbne (MP3) i materiały edukacyjne
          udostępnione w systemie stanowią własność Fundacji lub podmiotów
          współpracujących. Pobieranie materiałów jest dozwolone wyłącznie w
          celu przygotowania do koncertów VoctEnsemble. Kopiowanie i
          rozpowszechnianie ich bez zgody jest zabronione.
        </Text>
      </div>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        3. Poufność i NDA
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        Informacje o stawkach, planach produkcyjnych, lokalizacjach prób oraz
        obsadach są objęte tajemnicą zawodową. Zabrania się publikowania zrzutów
        ekranu z wnętrza aplikacji w mediach społecznościowych bez zgody
        Zarządu.
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        4. Zgłaszanie Problemów i Wsparcie
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        Wszelkie błędy w działaniu systemu, nieścisłości w grafikach lub
        problemy z dostępem należy zgłaszać pod adresem:{" "}
        <span className="font-medium text-ethereal-ink">
          voctensemble@gmail.com
        </span>
        .
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        5. Odpowiedzialność i Blokowanie Konta
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        Fundacja zastrzega sobie prawo do czasowego zawieszenia lub trwałego
        usunięcia konta Użytkownika w przypadku naruszenia zasad poufności lub
        rażącego naruszenia regulaminu pracy zespołu. Fundacja nie odpowiada za
        przerwy techniczne wynikające z winy dostawców zewnętrznych.
      </Text>
    </div>
  </div>
);
