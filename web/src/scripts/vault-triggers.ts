/**
 * @file vault-triggers.ts
 * @description Subpage glue: a click on any `[data-vault-open]` element opens the donation vault
 *  in place by dispatching `voct:open-vault` (consumed by the page's VaultIsland) instead of
 *  following the `/?donate` fallback href. Progressive enhancement — with JS off, the href still
 *  navigates to the homepage where `?donate` auto-opens the vault. One delegated listener on the
 *  document in the CAPTURE phase: ClientRouter's own click handler also lives on the document
 *  (bubbling, registered earlier in <head>), so a bubbling listener here would lose the race and
 *  let the router navigate to /?donate first. Capturing runs before any bubbling document
 *  listener, so our preventDefault lands before the router sees the event.
 * @architecture Astro islands 2026
 * @module scripts/vault-triggers
 */

function onClick(event: MouseEvent): void {
  if (event.defaultPrevented) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const trigger = target.closest<HTMLElement>("[data-vault-open]");
  if (!trigger) return;
  event.preventDefault();
  const amount = Number(trigger.dataset.vaultOpen);
  window.dispatchEvent(
    new CustomEvent("voct:open-vault", {
      detail: { amount: Number.isFinite(amount) ? amount : undefined },
    }),
  );
}

document.addEventListener("click", onClick, true);
