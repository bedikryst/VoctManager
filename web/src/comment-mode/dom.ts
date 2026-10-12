/**
 * @file dom.ts
 * @description Element construction for the comment mode's chrome. The tool renders a handful of
 *  small panels into its own shadow root, so it builds them with plain DOM calls instead of
 *  bringing a framework into the chunk. Text always goes in as text nodes, never as markup: field
 *  values and labels come from the desk and are shown, not interpreted.
 * @architecture Astro islands 2026
 * @module comment-mode/dom
 */

export type Child = Node | string | null | undefined | false;

/** `<tag class="…">children</tag>`; falsy children are skipped. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child);
  }
  return element;
}

/** A `type="button"` button that runs `onPress`. */
export function button(label: string, onPress: () => void, className = "btn"): HTMLButtonElement {
  const element = el("button", className, label);
  element.type = "button";
  element.addEventListener("click", (event) => {
    event.preventDefault();
    onPress();
  });
  return element;
}
