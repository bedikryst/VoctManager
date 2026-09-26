/**
 * @file zipStore.ts
 * @description The ZIP writer the /press composer runs in the browser: it packs the files a reader
 *  ticked into one archive, with no server between the page and the files.
 *
 *  A MIRROR OF `scripts/zip.mjs`, FIELD FOR FIELD, WITH ONE CUT: every entry is STORED. The
 *  generator deflates the pack's text files, but a browser has no synchronous deflate, and the
 *  texts a reader can tick weigh a few kilobytes beside megabytes of JPEG and PDF that deflate
 *  would not shrink anyway. Everything else is the same frozen subset: local headers, a central
 *  directory, an end record, UTF-8 names with the language-encoding flag, one timestamp for every
 *  entry. No ZIP64, no encryption, no data descriptors. For the same entries and the same date,
 *  the bytes equal `makeZip` with `store: true` on each; `scripts/zip.test.mjs` holds the two to
 *  that.
 *
 *  PURE: no DOM, no Node. The composer turns the result into a Blob; the test concatenates it
 *  under bare Node, which is also why this file keeps to syntax type-stripping can erase.
 *
 *  THE RESULT IS A LIST OF PARTS, not one buffer. `new Blob(parts)` takes them as they are, so a
 *  forty-megabyte selection is never copied into a second forty-megabyte array to be handed over.
 * @architecture Astro islands 2026
 * @module lib/zipStore
 */

/** Bit 11 — "the name and comment are UTF-8". Harmless on ASCII, required beyond it. */
const FLAG_UTF8 = 0x0800;
const METHOD_STORE = 0;
/** 2.0, as `scripts/zip.mjs` writes it, so the two agree to the byte. */
const VERSION = 20;
/** Offsets and sizes are 32-bit and the entry count 16-bit: past either, ZIP64 would be needed. */
const MAX_BYTES = 0xffffffff;
const MAX_ENTRIES = 0xffff;

const LOCAL_HEADER = 30;
const CENTRAL_HEADER = 46;
const END_RECORD = 22;

export interface ZipStoreEntry {
  /** The path inside the archive, with `/` separators and no leading slash. */
  readonly name: string;
  readonly data: Uint8Array<ArrayBuffer>;
}

let crcTable: Uint32Array | undefined;

/** The reflected CRC-32 (polynomial 0xEDB88320) every ZIP reader checks each entry against. */
export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  const table = crcTable;
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (table[(crc ^ (data[i] as number)) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * A timestamp in the 1980-epoch MS-DOS form the format was born with. Seconds have one bit less
 * than they need, so odd seconds round down; nothing reads this but a file listing.
 */
function dosDateTime(date: Date): { readonly time: number; readonly date: number } {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * Build a store-only ZIP archive, returned as the parts that concatenate to it.
 *
 * @param modified One timestamp for every entry. The composer passes the moment the pack was
 *  cut, which is what the files inside it date from.
 * @throws RangeError past the 4 GB or 65 535-entry line, where the archive would need ZIP64.
 */
export function zipStore(
  entries: readonly ZipStoreEntry[],
  modified: Date = new Date(),
): Uint8Array<ArrayBuffer>[] {
  if (entries.length > MAX_ENTRIES) {
    throw new RangeError(`zipStore: ${entries.length} entries is past the 16-bit count.`);
  }
  const { time, date } = dosDateTime(modified);
  const encoder = new TextEncoder();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const centrals: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const size = entry.data.length;
    const sum = crc32(entry.data);

    const local = new Uint8Array(LOCAL_HEADER + name.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, VERSION, true);
    l.setUint16(6, FLAG_UTF8, true);
    l.setUint16(8, METHOD_STORE, true);
    l.setUint16(10, time, true);
    l.setUint16(12, date, true);
    l.setUint32(14, sum, true);
    l.setUint32(18, size, true);
    l.setUint32(22, size, true);
    l.setUint16(26, name.length, true);
    l.setUint16(28, 0, true);
    local.set(name, LOCAL_HEADER);
    parts.push(local, entry.data);

    const central = new Uint8Array(CENTRAL_HEADER + name.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, VERSION, true);
    c.setUint16(6, VERSION, true);
    c.setUint16(8, FLAG_UTF8, true);
    c.setUint16(10, METHOD_STORE, true);
    c.setUint16(12, time, true);
    c.setUint16(14, date, true);
    c.setUint32(16, sum, true);
    c.setUint32(20, size, true);
    c.setUint32(24, size, true);
    c.setUint16(28, name.length, true);
    // Extra field, comment, disk number, internal and external attributes: all zero.
    c.setUint32(42, offset, true);
    central.set(name, CENTRAL_HEADER);
    centrals.push(central);

    offset += local.length + size;
    if (offset > MAX_BYTES) {
      throw new RangeError("zipStore: the archive is past 4 GB, which needs ZIP64.");
    }
  }

  const directorySize = centrals.reduce((total, part) => total + part.length, 0);
  if (offset + directorySize > MAX_BYTES) {
    throw new RangeError("zipStore: the archive is past 4 GB, which needs ZIP64.");
  }
  const end = new Uint8Array(END_RECORD);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, directorySize, true);
  e.setUint32(16, offset, true);

  return [...parts, ...centrals, end];
}
