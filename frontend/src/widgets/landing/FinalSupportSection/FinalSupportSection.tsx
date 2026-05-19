/**
 * @file FinalSupportSection.tsx
 * @description Closing patronage section over the krzyż-światło backdrop. Holds the
 * direct-contact card (Florent's email), the donation tier rows, and the bank-card
 * with copyable IBANs (PLN + EUR) and foundation address.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/FinalSupportSection
 */

import { forwardRef } from "react";

import { useCopyToClipboard } from "@/features/landing/hooks/useCopyToClipboard";
import { useVault } from "@/features/landing/providers/VaultContext";

interface DonationRow {
  readonly amount: string;
  readonly text: string;
}

const ROWS: readonly DonationRow[] = [
  { amount: "100 zł", text: "wsparcie najbliższego wydarzenia" },
  { amount: "500 zł", text: "wsparcie pracy zespołu i procesu twórczego" },
  { amount: "2 500 zł", text: "współtworzenie kolejnej odsłony cyklu" },
];

function BankCopyButton({
  value,
  eventName,
}: {
  readonly value: string;
  readonly eventName: string;
}): React.JSX.Element {
  const { copied, copy } = useCopyToClipboard();
  return (
    <button
      type="button"
      className={`copy-account plausible-event-name=${eventName}`}
      onClick={() => void copy(value)}
    >
      {copied ? "Skopiowano" : "Kopiuj"}
    </button>
  );
}

export const FinalSupportSection = forwardRef<HTMLElement>(function FinalSupportSection(
  _props,
  ref,
) {
  const { open } = useVault();
  return (
    <section className="final-support" id="wesprzyj" aria-label="Wesprzyj VoctEnsemble" ref={ref}>
      <div className="section">
        <div className="final-grid">
          <div className="final-copy reveal">
            <div className="micro">Patronat · darowizna · partnerstwo</div>
            <h2>Niech muzyka ma swoje miejsce.</h2>
            <p>
              Koncerty Duchowe powstają dzięki tym, którzy wierzą w muzykę docierającą
              do głębi — zdolną poruszać, rezonować i przemieniać. Dołącz jako darczyńca,
              mecenas lub zaproś VoctEnsemble do swojej przestrzeni.
            </p>
            <div className="final-contact">
              <span className="micro">Kontakt do kierownictwa artystycznego</span>
              <a
                className="final-contact-name plausible-event-name=florent+mail"
                href="mailto:florent.de.bazelaire@voctensemble.com?subject=Patronat%20VoctEnsemble"
              >
                Florent de Bazelaire
              </a>
              <span className="final-contact-mail">florent.de.bazelaire@voctensemble.com</span>
            </div>
            <div className="final-actions">
              <a
                className="primary-link plausible-event-name=napisz+do+nas+dol"
                href="mailto:patronat@voctensemble.com?subject=Patronat%20VoctEnsemble"
              >
                Napisz do nas
              </a>
              <a
                className="secondary-link plausible-event-name=wesprzyj+dol"
                href="#wesprzyj"
                data-no-lenis
                onClick={(event) => {
                  event.preventDefault();
                  open(100);
                }}
              >
                Wesprzyj
              </a>
            </div>
          </div>

          <div className="donation-list reveal">
            {ROWS.map((row) => (
              <div className="donation-row" key={row.amount}>
                <strong>{row.amount}</strong>
                <span>{row.text}</span>
              </div>
            ))}

            <div className="bank-card" id="przelew" aria-label="Dane do przelewu">
              <div className="bank-row">
                <span className="currency">PLN</span>
                <span className="iban">PL26 1600 1013 1724 4184 1000 0001</span>
                <BankCopyButton
                  value="PL26160010131724418410000001"
                  eventName="przelew+copy+PLN"
                />
              </div>
              <div className="bank-row">
                <span className="currency">EUR</span>
                <span className="iban">PL96 1600 1013 1724 4184 1000 0002</span>
                <BankCopyButton
                  value="PL96160010131724418410000002"
                  eventName="przelew+copy+EUR"
                />
              </div>
              <div className="foundation-data">
                Fundacja VoctFoundation · KRS 0001237252 · NIP 6762718992 · REGON 544621525
                <br />
                Tytuł przelewu: Darowizna na cele statutowe VoctFoundation
                <br />
                Św. Filipa 23 / 3, 31-150 Kraków, Polska
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
