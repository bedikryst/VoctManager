/**
 * @file copyContext.tsx
 * @description The vault's words, as seen from inside the island: the locale it is being read in,
 *  the prose that came out of the content files, and the chrome triple for that locale.
 *
 *  THE LOCALE IS A PROP HERE, NOT A READ OF `<html lang>`, and that is the opposite of the rule
 *  every other island on this site follows. The rule exists for `transition:persist` islands, whose
 *  instance survives a page swap and would freeze at whichever language the tab opened on. This
 *  island is server-rendered and remounts per page, and reading the document instead would break it
 *  in a different way: `documentLocale()` has no document during SSR and answers Polish, so the
 *  server would render Polish under an English page and React would find a hydration mismatch —
 *  then throw the server's markup away and re-render, in front of the reader.
 *
 *  THE PROSE ARRIVES AS A PROP AND THE CHROME DOES NOT. Prose is resolved at build by
 *  `lib/vaultCopy` (overlay lookup, link localization, typography) and handed in; chrome carries
 *  FUNCTIONS — a Polish plural, an interpolated amount — and a function cannot be serialized into
 *  an island's props, so it is imported here and all three locales ship in the bundle. They are
 *  short affordances and the file they come from carries no zod, which is why that split exists.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/copyContext
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { Locale } from "../../../i18n/config";
import type { TermsCopy } from "../../../i18n/content/regulaminDarowizn";
import type { VaultCopy } from "../../../i18n/content/skarbiec";
import { VAULT_CHROME, type VaultChrome } from "../../../i18n/content/skarbiecChrome";

/** What `lib/vaultCopy` resolves and `VaultMount.astro` hands over. */
export interface VaultCopyBundle {
  readonly vault: VaultCopy;
  readonly terms: TermsCopy;
}

interface VaultCopyValue extends VaultCopyBundle {
  readonly lang: Locale;
  /** This locale's chrome. Named `t` because that is what every other surface calls it. */
  readonly t: VaultChrome;
}

const VaultCopyContext = createContext<VaultCopyValue | null>(null);

export function VaultCopyProvider({
  lang,
  copy,
  children,
}: {
  readonly lang: Locale;
  readonly copy: VaultCopyBundle;
  readonly children: ReactNode;
}): React.JSX.Element {
  const value = useMemo<VaultCopyValue>(
    () => ({ lang, vault: copy.vault, terms: copy.terms, t: VAULT_CHROME[lang] }),
    [lang, copy],
  );
  return <VaultCopyContext.Provider value={value}>{children}</VaultCopyContext.Provider>;
}

export function useVaultCopy(): VaultCopyValue {
  const ctx = useContext(VaultCopyContext);
  if (!ctx) throw new Error("useVaultCopy must be used within a VaultCopyProvider");
  return ctx;
}
