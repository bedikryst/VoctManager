/**
 * @file dom.ts
 * @description Element construction for the comment mode's chrome. The tool renders a handful of
 *  small panels into its own shadow root, so it builds them with plain DOM calls instead of
 *  bringing a framework into the chunk. Text always goes in as text nodes, never as markup: field
 *  values and labels come from the desk and are shown, not interpreted.
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
  fill(element, ...children);
  return element;
}

/** Replace `parent`'s children; falsy children are skipped. */
export function fill(parent: ParentNode, ...children: Child[]): void {
  parent.replaceChildren(
    ...children.filter((child): child is Node | string => child !== null && child !== undefined && child !== false),
  );
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
