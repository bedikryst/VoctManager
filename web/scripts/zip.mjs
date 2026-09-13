/**
 * @file zip.mjs
 * @description A minimal ZIP writer — enough of the format to hand an organiser one file.
 *
 *  WHY NOT A LIBRARY. The press pack is the only thing on this site that needs an archive, and
 *  `archiver` / `jszip` would be the first runtime-shaped dependency added to `web/` in a year
 *  for one build script. The part of the format we need is small and frozen: local headers, a
 *  central directory, an end record. No ZIP64 (the pack is capped at 50 MB by its own spec, four
 *  orders below the 4 GB line), no encryption, no data descriptors, no multi-disk.
 *
 *  STORE FOR MEDIA, DEFLATE FOR TEXT. JPEG, PNG and PDF are already compressed and deflating them
 *  costs time to save nothing — sometimes to lose. The caller says which by passing `store`.
 *
 *  NAMES ARE UTF-8 and the language-encoding flag is set, so a Polish filename would survive; the
 *  pack keeps them ASCII anyway, because the reader on the other end may be unzipping on anything.
 * @architecture Astro islands 2026
 * @module scripts/zip
 */
import { crc32, deflateRawSync } from "node:zlib";

/** Bit 11 — "the name and comment are UTF-8". Harmless on ASCII, required beyond it. */
const FLAG_UTF8 = 0x0800;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;
/** 2.0 — the floor for a deflated entry, which is all we emit. */
const VERSION = 20;

/**
 * A timestamp in the 1980-epoch MS-DOS form the format was born with. Seconds have one bit less
 * than they need, so odd seconds round down; nothing reads this but a file listing.
 */
function dosDateTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * Build a ZIP archive in memory.
 *
 * @param {readonly {name: string, data: Buffer, store?: boolean}[]} entries
 *   `name` is the path inside the archive, with `/` separators and no leading slash.
 * @param {Date} [modified] One timestamp for every entry — the pack is cut in one act.
 * @returns {Buffer}
 */
export function makeZip(entries, modified = new Date()) {
  const { time, date } = dosDateTime(modified);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const method = entry.store ? METHOD_STORE : METHOD_DEFLATE;
    const body = entry.store ? entry.data : deflateRawSync(entry.data);
    const sum = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(FLAG_UTF8, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(VERSION, 4);
    central.writeUInt16LE(VERSION, 6);
    central.writeUInt16LE(FLAG_UTF8, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(sum, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, directory, end]);
}
