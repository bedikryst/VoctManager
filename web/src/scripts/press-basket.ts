/**
 * @file press-basket.ts
 * @description The /press composer: the checkboxes beside the page's files, the bar that counts
 *  what is ticked, and one archive of the ticked files built in the browser (lib/zipStore).
 *  Imported for its side effect by PressPage.
 *
 *  PROGRESSIVE. The boxes, the "select all" toggles and the bar are in the markup but hidden; this
 *  script shows them (`has-basket` on `[data-basket-root]`) only once it has read the manifest in
 *  a browser that can save a Blob. Without it the page keeps what it always had: a link per file
 *  and the two prebuilt ZIPs. While at least one box is ticked the root also carries
 *  `is-picking`, which the page's CSS reads to show every tile's box at once.
 *
 *  THE BOXES CARRY KEYS, THE MANIFEST CARRIES FILES. `#press-basket-data` is the JSON
 *  `lib/pressPack#basketManifest` wrote at build from `index.json`, and a box's
 *  `data-basket-item` is its key there. Paths, sizes and URLs are never read off the markup.
 *
 *  THE ARCHIVE MIRRORS KOMPLET. Each file keeps its path from the index, which is its path inside
 *  komplet, and PRZECZYTAJ.txt always goes first: the usage terms and every credit travel with any
 *  photograph that leaves this page. When every box is ticked, the prebuilt komplet is served
 *  instead. It is the same selection already cut, plus the few files that have no box of their
 *  own (the post, the hashtags, the invoicing sheet).
 *
 *  ONE FILE AT A TIME. Parallel fetches finish sooner on a good line and fail together on a bad
 *  one; in sequence, the progress the bar shows is the progress there is.
 *
 *  DOCUMENT-DELEGATED and installed once per document, behind the guard `copy-fields.ts` uses.
 *  The per-page part (reading the manifest, showing the controls) reruns on every
 *  `astro:page-load`, so a ClientRouter navigation back to /press finds it live.
 * @architecture Astro islands 2026
 * @module scripts/press-basket
 */
import { formatBytes } from "../lib/fileSize";
import type { BasketFile, BasketManifest } from "../lib/pressPack";
import { zipStore, type ZipStoreEntry } from "../lib/zipStore";

/** Named as the prebuilt pair is (`voctensemble-press-komplet.zip`, `-zdjecia.zip`). */
const ARCHIVE_NAME = "voctensemble-press-wybrane.zip";
/** Long enough for the slowest browser to hand the Blob to its download manager. */
const REVOKE_MS = 60_000;

interface Basket {
  readonly root: HTMLElement;
  readonly manifest: BasketManifest;
  readonly bar: HTMLElement;
  readonly count: HTMLElement;
  readonly size: HTMLElement;
  readonly get: HTMLButtonElement;
  readonly clear: HTMLButtonElement;
  busy: boolean;
}

interface BasketGuard {
  __voctBasket?: boolean;
}

let basket: Basket | null = null;

/** The boxes the manifest knows, in page order. A box it does not know is never counted. */
function boxes(b: Basket): HTMLInputElement[] {
  return [...b.root.querySelectorAll<HTMLInputElement>("input[data-basket-item]")].filter((box) => {
    const key = box.dataset.basketItem;
    return key !== undefined && Object.hasOwn(b.manifest.items, key);
  });
}

/** The readme, then every ticked box's files in page order, each path once. */
function chosenFiles(b: Basket, ticked: readonly HTMLInputElement[]): BasketFile[] {
  const files: BasketFile[] = [b.manifest.readme];
  const seen = new Set([b.manifest.readme.path]);
  for (const box of ticked) {
    for (const file of b.manifest.items[box.dataset.basketItem ?? ""] ?? []) {
      if (seen.has(file.path)) continue;
      seen.add(file.path);
      files.push(file);
    }
  }
  return files;
}

const totalBytes = (files: readonly BasketFile[]): number =>
  files.reduce((total, file) => total + file.bytes, 0);

/** The toggles, the bar's visibility and its line, from the boxes as they stand. */
function sync(b: Basket): void {
  const all = boxes(b);
  const ticked = all.filter((box) => box.checked);

  for (const toggle of b.root.querySelectorAll<HTMLInputElement>("input[data-basket-all]")) {
    const members = all.filter((box) => box.dataset.basketGroup === toggle.dataset.basketAll);
    const on = members.filter((box) => box.checked).length;
    toggle.checked = members.length > 0 && on === members.length;
    toggle.indeterminate = on > 0 && on < members.length;
  }

  b.bar.hidden = ticked.length === 0;
  // The tiles' boxes rest hidden until a hover or a focus asks for one; once anything is ticked
  // every tile shows its box, because the reader is now choosing, not browsing.
  b.root.classList.toggle("is-picking", ticked.length > 0);
  // While an archive is being fetched the line reports progress; the next sync after it restores
  // the count.
  if (b.busy || ticked.length === 0) return;
  const bytes =
    ticked.length === all.length ? b.manifest.komplet.bytes : totalBytes(chosenFiles(b, ticked));
  const { text } = b.manifest;
  b.count.textContent = text.counts[ticked.length - 1] ?? "";
  b.size.textContent = formatBytes(bytes, text.htmlLang, text.units);
}

/** Hand a URL to the browser's download manager under `name`. */
function save(href: string, name: string): void {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
}

/** One file's bytes, reporting each chunk as it arrives. */
async function fetchFile(
  file: BasketFile,
  onChunk: (received: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(file.href);
  if (!response.ok) throw new Error(`${file.path}: HTTP ${response.status}`);
  if (!response.body) {
    const data = new Uint8Array(await response.arrayBuffer());
    onChunk(data.length);
    return data;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.length;
    onChunk(value.length);
  }
  const data = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    data.set(chunk, at);
    at += chunk.length;
  }
  return data;
}

async function download(b: Basket): Promise<void> {
  if (b.busy) return;
  const all = boxes(b);
  const ticked = all.filter((box) => box.checked);
  if (ticked.length === 0) return;

  if (ticked.length === all.length) {
    save(b.manifest.komplet.href, b.manifest.komplet.path.split("/").pop() ?? ARCHIVE_NAME);
    return;
  }

  const files = chosenFiles(b, ticked);
  const { text } = b.manifest;
  const percent = new Intl.NumberFormat(text.htmlLang, { style: "percent", maximumFractionDigits: 0 });
  const expected = totalBytes(files);
  let received = 0;
  const progress = (): void => {
    b.count.textContent = text.preparing.replace(
      "{percent}",
      percent.format(Math.min(received / expected, 1)),
    );
  };

  b.busy = true;
  b.get.disabled = true;
  b.clear.disabled = true;
  b.bar.setAttribute("aria-busy", "true");
  b.size.textContent = "";
  progress();

  let failed = false;
  try {
    const entries: ZipStoreEntry[] = [];
    for (const file of files) {
      const data = await fetchFile(file, (bytes) => {
        received += bytes;
        progress();
      });
      entries.push({ name: file.path, data });
    }
    // The reader navigated away while the files were arriving: nothing is left to hand them to.
    if (b.bar.isConnected) {
      const archive = new Blob(zipStore(entries, new Date(b.manifest.cutAt)), {
        type: "application/zip",
      });
      const url = URL.createObjectURL(archive);
      save(url, ARCHIVE_NAME);
      window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_MS);
    }
  } catch {
    failed = true;
  } finally {
    b.busy = false;
    b.get.disabled = false;
    b.clear.disabled = false;
    b.bar.removeAttribute("aria-busy");
  }

  if (failed) {
    // Stays until the selection changes or the reader tries again.
    b.count.textContent = text.failed;
    b.size.textContent = "";
  } else {
    sync(b);
  }
}

function setup(): void {
  basket = null;
  const root = document.querySelector<HTMLElement>("[data-basket-root]");
  const data = document.getElementById("press-basket-data");
  const bar = document.querySelector<HTMLElement>("[data-basket-bar]");
  const count = bar?.querySelector<HTMLElement>("[data-basket-count]");
  const size = bar?.querySelector<HTMLElement>("[data-basket-size]");
  const get = bar?.querySelector<HTMLButtonElement>("button[data-basket-get]");
  const clear = bar?.querySelector<HTMLButtonElement>("button[data-basket-clear]");
  if (!root || !data || !bar || !count || !size || !get || !clear) return;
  // A browser that cannot save a Blob under a name keeps the per-file links and the two ZIPs.
  if (!("download" in HTMLAnchorElement.prototype) || typeof URL.createObjectURL !== "function") {
    return;
  }

  let manifest: BasketManifest;
  try {
    manifest = JSON.parse(data.textContent ?? "") as BasketManifest;
  } catch {
    return;
  }

  basket = { root, manifest, bar, count, size, get, clear, busy: false };
  root.classList.add("has-basket");
  // A reload can restore ticked boxes before this runs; the bar starts from what is there.
  sync(basket);
}

if (!(window as unknown as BasketGuard).__voctBasket) {
  (window as unknown as BasketGuard).__voctBasket = true;

  document.addEventListener("change", (event) => {
    const b = basket;
    const target = event.target;
    if (!b || !(target instanceof HTMLInputElement) || !b.root.contains(target)) return;
    const group = target.dataset.basketAll;
    if (group !== undefined) {
      for (const box of boxes(b)) {
        if (box.dataset.basketGroup === group) box.checked = target.checked;
      }
    } else if (target.dataset.basketItem === undefined) {
      return;
    }
    sync(b);
  });

  document.addEventListener("click", (event) => {
    const b = basket;
    const target = event.target;
    if (!b || !(target instanceof Element)) return;
    if (target.closest("[data-basket-get]")) {
      void download(b);
    } else if (target.closest("[data-basket-clear]")) {
      for (const box of boxes(b)) box.checked = false;
      sync(b);
    }
  });

  document.addEventListener("astro:page-load", setup);
}
