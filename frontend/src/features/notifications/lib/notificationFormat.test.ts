/**
 * @file notificationFormat.test.ts
 * @description The moment inside a bell sentence ("spóźni się na próbę w środę
 * o 18:15"). A bare weekday is only safe while it can name one date, so the
 * cases pin where it stops: the sixth day ahead, the seventh, anything already
 * past. The weekday is read from the event's own calendar day, never from the
 * UTC one, and the preposition inflects with it ("we wtorek"). The change chips
 * name stored codes (a status, an event kind, a minute count) in words.
 * @architecture Enterprise SaaS 2026
 * @module features/notifications/lib/notificationFormat.test
 */

import i18next from "i18next";
import { describe, expect, it } from "vitest";

import en from "@/shared/config/locales/en/translation.json";
import fr from "@/shared/config/locales/fr/translation.json";
import pl from "@/shared/config/locales/pl/translation.json";

import {
  formatEventPhrase,
  formatEventSpan,
  renderChange,
  type TFunc,
} from "./notificationFormat";

const i18n = i18next.createInstance();
void i18n.init({
  lng: "pl",
  resources: {
    pl: { translation: pl },
    en: { translation: en },
    fr: { translation: fr },
  },
  interpolation: { escapeValue: false },
  initAsync: false,
});

const tIn = (lang: string): TFunc => i18n.getFixedT(lang);

// Wednesday 7 October 2026, noon in Warsaw (CEST, UTC+2).
const NOW = new Date("2026-10-07T10:00:00Z");
const WARSAW = "Europe/Warsaw";

const phrase = (startsAt: string, lang = "pl", now = NOW): string | undefined =>
  formatEventPhrase({ starts_at: startsAt, timezone: WARSAW }, lang, tIn(lang), now);

describe("formatEventPhrase", () => {
  it("names today, tomorrow and yesterday by the word", () => {
    expect(phrase("2026-10-07T16:15:00Z")).toBe("dziś o 18:15");
    expect(phrase("2026-10-08T16:15:00Z")).toBe("jutro o 18:15");
    expect(phrase("2026-10-06T16:15:00Z")).toBe("wczoraj o 18:15");
  });

  it("uses a bare weekday two to six days ahead, with the preposition inflected", () => {
    expect(phrase("2026-10-09T16:15:00Z")).toBe("w piątek o 18:15");
    expect(phrase("2026-10-13T16:15:00Z")).toBe("we wtorek o 18:15");
  });

  it("dates the seventh day ahead, where the weekday would repeat today's", () => {
    expect(phrase("2026-10-14T16:15:00Z")).toBe("w środę 14 października o 18:15");
  });

  it("dates a past evening rather than letting its weekday read as the next one", () => {
    expect(phrase("2026-10-04T16:15:00Z")).toBe("w niedzielę 4 października o 18:15");
  });

  it("states the year only when it is not this one", () => {
    expect(phrase("2027-01-13T17:15:00Z")).toBe("w środę 13 stycznia 2027 o 18:15");
  });

  it("reads the weekday from the event's own day, not from the UTC one", () => {
    // 00:30 on Thursday in Warsaw is still Wednesday in UTC.
    const monday = new Date("2026-10-05T10:00:00Z");
    expect(phrase("2026-10-07T22:30:00Z", "pl", monday)).toBe("w czwartek o 00:30");
  });

  it("speaks the viewer's language", () => {
    expect(phrase("2026-10-09T16:15:00Z", "en")).toBe("on Friday at 18:15");
    expect(phrase("2026-10-09T16:15:00Z", "fr")).toBe("vendredi à 18:15");
    expect(phrase("2026-10-14T16:15:00Z", "fr")).toBe("mercredi 14 octobre à 18:15");
  });

  it("gives nothing for a legacy row without an ISO moment", () => {
    expect(
      formatEventPhrase({ starts_at_display: "07.10.2026, 18:15" }, "pl", tIn("pl"), NOW),
    ).toBeUndefined();
  });
});

describe("formatEventSpan", () => {
  it("names the edges of a run of days in the event's zone", () => {
    expect(
      formatEventSpan(
        {
          starts_at: "2026-10-07T16:15:00Z",
          ends_at: "2026-10-18T16:15:00Z",
          timezone: WARSAW,
        },
        "pl",
        NOW,
      ),
    ).toBe("7–18 października");
  });

  it("gives nothing without the closing moment", () => {
    expect(
      formatEventSpan({ starts_at: "2026-10-07T16:15:00Z", timezone: WARSAW }, "pl", NOW),
    ).toBeUndefined();
  });
});

describe("renderChange", () => {
  const chip = (field: string, old: string, next: string, lang = "pl"): string =>
    renderChange(tIn(lang), { field, old, new: next });

  it("names a status and an event kind as the rest of the app does", () => {
    expect(chip("status", "ACTIVE", "DONE")).toBe("Status: W przygotowaniu → Zrealizowano");
    expect(chip("event_kind", "CONCERT", "MASS")).toBe("Rodzaj wydarzenia: Koncert → Msza");
  });

  it("spells a rehearsal length out, dropping a zero part", () => {
    expect(chip("duration", "90", "120")).toBe("Czas trwania: 1 h 30 min → 2 h");
    expect(chip("duration", "45", "150", "en")).toBe("Duration: 45 min → 2 h 30 min");
  });

  it("passes a code it does not know through unchanged", () => {
    expect(chip("status", "ARCHIVED", "DONE")).toBe("Status: ARCHIVED → Zrealizowano");
  });
});
