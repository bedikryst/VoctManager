/**
 * @file styles.ts
 * @description The comment mode's stylesheet, mounted inside its shadow root, where the site's
 *  global CSS cannot reach it and from where it cannot leak onto the page.
 *
 *  The tool wears its own dark surface on every page rather than the page's palette: it has to
 *  read as a tool laid over the site, on parchment and night pages alike, and never as part of the
 *  page being corrected. No full-viewport layer anywhere, not even a scrim behind the sheet: a
 *  fixed layer over the whole viewport changes what iOS samples for its edge bands
 *  (docs/web-landing-guardrails.md §3a). Every field is 16px or more, or iOS zooms on focus.
 * @module comment-mode/styles
 */

export const STYLES = `
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }

.panel {
  --cm-bg: #1c1b18;
  --cm-raised: #27251f;
  --cm-fg: #f3efe6;
  --cm-muted: rgba(243, 239, 230, 0.7);
  --cm-line: rgba(243, 239, 230, 0.16);
  --cm-gold: #d6b66c;
  --cm-alert: #f2ab9e;
  font-family: var(--sans, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.45;
  letter-spacing: normal;
  text-align: left;
  color: var(--cm-fg);
  background: var(--cm-bg);
  box-shadow: 0 0 0 1px rgba(243, 239, 230, 0.08), 0 14px 36px -14px rgba(0, 0, 0, 0.65);
  -webkit-font-smoothing: antialiased;
  animation: cm-fade 0.16s ease-out;
}
@keyframes cm-fade { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .panel { animation: none; } }

p { margin: 0; }
a { color: var(--cm-gold); text-underline-offset: 3px; }

.btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 5px 14px;
  font: inherit;
  color: var(--cm-fg);
  background: transparent;
  border: 1px solid var(--cm-line);
  border-radius: 999px;
  cursor: pointer;
}
.btn:hover { border-color: rgba(243, 239, 230, 0.42); }
.btn:disabled { opacity: 0.45; cursor: default; }
.btn-primary { color: #1c1b18; background: var(--cm-gold); border-color: var(--cm-gold); font-weight: 600; }
.btn-primary:hover { background: #e3c57f; border-color: #e3c57f; }
.btn-quiet { border-color: transparent; padding-inline: 8px; color: var(--cm-muted); text-decoration: underline; text-underline-offset: 3px; }
.btn-quiet:hover { border-color: transparent; color: var(--cm-fg); }
.btn:focus-visible, a:focus-visible, textarea:focus-visible, summary:focus-visible {
  outline: 2px solid var(--cm-gold);
  outline-offset: 2px;
}
@media (pointer: coarse) { .btn { min-height: 44px; } }

/* The bar: bottom LEFT, because the bottom-right corner is ScrollTopButton's. The menu follows
   the pill in the DOM and opens above it. */
.bar {
  position: fixed;
  left: 16px;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  max-width: calc(100vw - 96px);
  display: flex;
  flex-direction: column-reverse;
  border-radius: 22px;
}
.bar.is-open { border-radius: 16px; }
.bar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  padding: 6px 6px 6px 14px;
}
.bar-name { font-weight: 600; }
.bar-status { color: var(--cm-muted); }
.bar-status.is-notice { color: var(--cm-gold); }
.bar-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.btn[aria-expanded="true"] { border-color: var(--cm-gold); }

.menu {
  display: grid;
  gap: 2px;
  min-width: min(300px, calc(100vw - 96px));
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px 6px;
  border-bottom: 1px solid var(--cm-line);
}
.menu-item {
  width: 100%;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  border-color: transparent;
  border-radius: 10px;
}
.menu-item:hover { border-color: var(--cm-line); }
.menu-label { flex: 1 1 auto; color: var(--cm-muted); }
.count { flex: none; min-width: 24px; color: var(--cm-muted); font-variant-numeric: tabular-nums; text-align: right; }
.menu-note { padding: 0 14px 6px; font-size: 12.5px; color: var(--cm-muted); }
.langs { display: flex; align-items: center; gap: 6px; padding: 4px 6px 6px 14px; }
.lang { min-width: 44px; padding-inline: 10px; }
.lang[aria-current="page"] { color: #1c1b18; background: var(--cm-gold); border-color: var(--cm-gold); font-weight: 600; }
.switch {
  position: relative;
  flex: none;
  width: 30px;
  height: 18px;
  border-radius: 9px;
  background: var(--cm-line);
}
.switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--cm-muted);
  transition: transform 0.15s ease-out;
}
[aria-pressed="true"] > .switch { background: var(--cm-gold); }
[aria-pressed="true"] > .switch::after { transform: translateX(12px); background: #1c1b18; }
@media (prefers-reduced-motion: reduce) { .switch::after { transition: none; } }

.popover {
  position: fixed;
  top: 0;
  left: 0;
  width: max-content;
  max-width: min(380px, calc(100vw - 32px));
  padding: 14px 16px;
  border-radius: 12px;
}
.popover-title { font-weight: 600; margin-bottom: 6px; }
.popover-text { color: var(--cm-muted); margin-bottom: 10px; }
.popover-label { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.choices { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 6px; }
.choice {
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  border-radius: 10px;
  padding: 8px 12px;
}
.choice-scope, .field-scope { color: var(--cm-muted); font-size: 12.5px; }
.fields { list-style: none; margin: 0 0 10px; padding: 0; }
.fields li { padding: 7px 0; border-top: 1px solid var(--cm-line); display: grid; gap: 2px; }
.popover-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }

/* A proposal laid out by the tool (preview.ts proposalNodes): one paragraph per block, links as
   underlined text that goes nowhere, the build's slots as marked tokens. */
.proposal {
  display: grid;
  gap: 8px;
  max-height: min(40vh, 320px);
  overflow-y: auto;
  overscroll-behavior: contain;
  margin-bottom: 10px;
  padding: 10px 12px;
  font-size: 15px;
  background: var(--cm-raised);
  border-left: 2px solid var(--cm-gold);
  border-radius: 4px;
  overflow-wrap: anywhere;
}
.proposal em { font-style: italic; }
.proposal strong { font-weight: 600; }
.proposal code { font-family: ui-monospace, monospace; font-size: 0.92em; }
.as-link { text-decoration: underline; text-underline-offset: 3px; }
.slot {
  padding: 0 4px;
  font-family: ui-monospace, monospace;
  font-size: 0.88em;
  color: var(--cm-gold);
  border: 1px solid var(--cm-line);
  border-radius: 4px;
}
.popover .note { margin-bottom: 10px; }

/* The sheet: a side panel on desktop. --cm-keyboard is what an on-screen keyboard covers of the
   layout viewport and --cm-visible the visual viewport's height (sheet.ts): iOS keeps fixed
   elements on the layout viewport, under the keyboard, unless they are lifted. */
.sheet {
  position: fixed;
  top: 0;
  right: 0;
  bottom: var(--cm-keyboard, 0px);
  width: min(440px, 100vw);
  display: flex;
  flex-direction: column;
}
.sheet:focus { outline: none; }
.sheet-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 20px 12px;
  border-bottom: 1px solid var(--cm-line);
}
.sheet-heading { flex: 1 1 auto; min-width: 0; }
.back { min-height: 28px; margin: -4px 0 6px -8px; text-decoration: none; }
.sheet-title { font-size: 16px; font-weight: 600; overflow-wrap: anywhere; }
.sheet-scope { margin-top: 2px; font-size: 13px; color: var(--cm-muted); }
.sheet-body {
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px 20px 20px;
  display: grid;
  align-content: start;
  gap: 14px;
}
.sheet-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 20px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--cm-line);
}
.grow { flex: 1 1 auto; }
.notes { display: grid; gap: 6px; }
.note { font-size: 13px; color: var(--cm-muted); }
.note-warn { color: var(--cm-gold); }
.note-error { color: var(--cm-alert); }
.draft { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
.field { display: grid; gap: 6px; }
.field-label { font-size: 13px; font-weight: 600; }
textarea {
  width: 100%;
  padding: 10px 12px;
  font: inherit;
  font-size: 16px;
  line-height: 1.5;
  color: var(--cm-fg);
  background: var(--cm-raised);
  border: 1px solid var(--cm-line);
  border-radius: 8px;
  resize: vertical;
}
details { border-top: 1px solid var(--cm-line); padding-top: 10px; }
summary { cursor: pointer; font-size: 13px; font-weight: 600; }
.reference { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 10px; }
.reference-head { font-size: 12px; color: var(--cm-muted); }
.reference-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.reference-empty { font-style: italic; color: var(--cm-muted); }

/* Another language in the sheet: its text and "Popraw", or an editor of its own. */
.side { display: grid; gap: 8px; padding-top: 10px; border-top: 1px solid var(--cm-line); }
.side:first-child { padding-top: 0; border-top: 0; }
.side-actions { display: flex; flex-wrap: wrap; gap: 8px; }

/* The lists in the sheet: one card per field, the whole card the button. */
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.list-item {
  width: 100%;
  display: grid;
  justify-items: start;
  gap: 3px;
  padding: 10px 12px;
  text-align: left;
  border-radius: 10px;
}
.list-label { font-weight: 600; overflow-wrap: anywhere; }
.list-scope { font-size: 12.5px; color: var(--cm-muted); }
.list-state { font-size: 12.5px; color: var(--cm-gold); }
.list-text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  white-space: pre-line;
  overflow-wrap: anywhere;
  color: var(--cm-muted);
}

/* On a phone a bottom sheet that sits on the keyboard and never grows past what is visible. */
@media (max-width: 720px) {
  .sheet {
    top: auto;
    left: 0;
    width: auto;
    max-height: min(85vh, calc(var(--cm-visible, 100vh) - 12px));
    border-radius: 16px 16px 0 0;
  }
  .sheet-head { padding: 14px 16px 10px; }
  .sheet-body { padding: 14px 16px 16px; }
  .sheet-foot { padding-inline: 16px; }
  .sheet.has-keyboard .sheet-foot { padding-bottom: 10px; }
  .bar.is-under-sheet { display: none; }
}
`;
