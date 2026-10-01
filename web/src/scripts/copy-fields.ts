/**
 * @file copy-fields.ts
 * @description Copy-to-clipboard for any `[data-copy]` control on the page. Imported for its
 *  side effect by the pages that have such controls — /kontakt (addresses), /press (biograms,
 *  the registry numbers, the accounts), /fundacja (the transfer details, the address) and
 *  /mecenat (the patron's contact).
 *
 *  IT WAS ALWAYS ONE THING, WRITTEN TWICE. The guard below is a flag on `window`, which is a
 *  statement that the listener is global and must be installed once per document; two pages each
 *  declaring their own copy of it was the same claim made twice, kept in step by hand. Now the
 *  flag guards one module.
 *
 *  DOCUMENT-DELEGATED, AND THAT IS WHAT MAKES IT ClientRouter-SAFE. Astro's view transitions swap
 *  the body; a listener bound to a button dies with it, and a listener bound to `document`
 *  survives and simply finds nothing to do on pages without the attribute.
 *
 *  THE CONFIRMATION IS READ OFF THE BUTTON, never written here: `data-copied` carries the word in
 *  the page's own locale, so one script serves all three. Same reason the accessible name is an
 *  `aria-label` on the button rather than a string in this file.
 *
 *  A COPY THAT LANDED is announced as a bubbling `voct:copied` on the button, for a page that
 *  counts it (scripts/press-goals). A click the clipboard refused announces nothing.
 *
 *  THE CONFIRMATION IS ALSO SPOKEN. The button's accessible name is its `aria-label`, so the word
 *  printed on it is never read out; one visually hidden status region per document says it
 *  instead. It is created on the first click, before the clipboard answers, so it is already in
 *  the tree when its text changes — a region born with its text is often not announced.
 *
 *  WHY A BUTTON EXISTS AT ALL. On /kontakt a bare `mailto:` is a real desktop failure when no
 *  mail client is configured, and this is the escape hatch. On /press the strings are longer than
 *  anybody retypes correctly — an IBAN, a 2000-character biogram — and a mis-typed account number
 *  is the worst outcome on the page.
 * @architecture Astro islands 2026
 * @module scripts/copy-fields
 */

/** How long the button holds its confirmation before returning to its resting label. */
const CONFIRM_MS = 1800;

interface CopyGuard {
  __voctCopy?: boolean;
}

const STATUS_ID = "voct-copy-status";

/** The document's status region; ClientRouter swaps the body, so it is looked up, not kept. */
function statusRegion(): HTMLElement {
  const existing = document.getElementById(STATUS_ID);
  if (existing) return existing;
  const region = document.createElement("p");
  region.id = STATUS_ID;
  region.className = "sr-only";
  region.setAttribute("role", "status");
  document.body.append(region);
  return region;
}

if (!(window as unknown as CopyGuard).__voctCopy) {
  (window as unknown as CopyGuard).__voctCopy = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-copy]");
    if (!button) return;

    const value = button.dataset.copy;
    const done = button.dataset.copied;
    const label = button.querySelector<HTMLElement>(".copy-label");
    // No clipboard at all (an insecure origin, an old browser): leave the button inert rather
    // than flashing a confirmation for something that did not happen.
    if (!value || !done || !label || !navigator.clipboard) return;

    const status = statusRegion();
    status.textContent = "";
    navigator.clipboard
      .writeText(value)
      .then(() => {
        button.dispatchEvent(new CustomEvent("voct:copied", { bubbles: true }));
        const previous = label.textContent;
        button.classList.add("is-copied");
        label.textContent = done;
        status.textContent = done;
        window.setTimeout(() => {
          button.classList.remove("is-copied");
          label.textContent = previous;
        }, CONFIRM_MS);
      })
      .catch(() => {});
  });
}
