/**
 * @file planText.test.ts
 * @description The typed-plan reader against the lines conductors actually
 * wrote into the topic field on production, and the variants a numbered list
 * comes in.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/lib/planText.test
 */

import { describe, expect, it } from "vitest";

import { parsePlanLine, parsePlanText, planTextOfFocus, type PlanTextPiece } from "./planText";

const PROGRAM: readonly PlanTextPiece[] = [
  { id: "lark", title: "Lark" },
  { id: "laudes", title: "Laudes creaturarum" },
  { id: "wonderful", title: "What a Wonderful World" },
  { id: "pochwala", title: "Pochwała Stworzenia" },
  { id: "biebl", title: "Ave Maria (Biebl)" },
  { id: "caccini", title: "Ave Maria (Caccini)" },
];

describe("parsePlanLine", () => {
  it("strips numbering and turns parentheses into the note", () => {
    expect(parsePlanLine("1. Lark (fragm.)", PROGRAM)).toEqual({
      piece: "lark",
      title: "Lark",
      label: "Lark",
      note: "fragm.",
      startsAt: null,
      minutes: null,
      isBreak: false,
    });
    expect(parsePlanLine("2) Laudes creaturarum (rozcz.)", PROGRAM)).toMatchObject({
      piece: "laudes",
      note: "rozcz.",
    });
  });

  it("matches a title with its trailing ellipsis", () => {
    expect(parsePlanLine("3. What a Wonderful World…", PROGRAM)?.piece).toBe("wonderful");
  });

  it("keeps the clock as typed, the conductor's odd minute included", () => {
    expect(parsePlanLine("8:59 Rozśpiewanie", PROGRAM)).toMatchObject({
      piece: null,
      label: "Rozśpiewanie",
      startsAt: "08:59",
    });
    expect(parsePlanLine("18.30 – Lark", PROGRAM)).toMatchObject({
      piece: "lark",
      startsAt: "18:30",
      note: "",
    });
    expect(parsePlanLine("1. 18:14 Lark", PROGRAM)?.startsAt).toBe("18:14");
    expect(parsePlanLine("18h30 Lark 10 mn", PROGRAM)).toMatchObject({
      piece: "lark",
      startsAt: "18:30",
      minutes: 10,
    });
  });

  it("reads minutes written with an apostrophe or a unit", () => {
    expect(parsePlanLine("Lark 10'", PROGRAM)).toMatchObject({ piece: "lark", minutes: 10 });
    expect(parsePlanLine("Lark 15 min", PROGRAM)?.minutes).toBe(15);
    expect(parsePlanLine("Lark (20 minut)", PROGRAM)).toMatchObject({ minutes: 20, note: "" });
  });

  it("gives a clock range its minutes, unless the line states them", () => {
    expect(parsePlanLine("18:30–18:45 Lark", PROGRAM)).toMatchObject({
      startsAt: "18:30",
      minutes: 15,
    });
    expect(parsePlanLine("18:30-18:45 Lark 10'", PROGRAM)?.minutes).toBe(10);
  });

  it("takes the words after a spaced dash as the note, hyphens inside a title stay", () => {
    expect(parsePlanLine("Laudes creaturarum – od t. 40 (pierwsze czytanie)", PROGRAM)).toMatchObject({
      piece: "laudes",
      note: "od t. 40, pierwsze czytanie",
    });
    expect(parsePlanLine("Ćwiczenia oddechowo-głosowe", PROGRAM)).toMatchObject({
      piece: null,
      label: "Ćwiczenia oddechowo-głosowe",
      note: "",
    });
  });

  it("matches across diacritics and case", () => {
    expect(parsePlanLine("pochwala stworzenia", PROGRAM)?.piece).toBe("pochwala");
    expect(parsePlanLine("LARK", PROGRAM)?.piece).toBe("lark");
  });

  it("matches an abbreviated title only when one piece answers to it", () => {
    expect(parsePlanLine("Laudes", PROGRAM)?.piece).toBe("laudes");
    expect(parsePlanLine("Wonderful World", PROGRAM)?.piece).toBe("wonderful");
    expect(parsePlanLine("Ave Maria", PROGRAM)?.piece).toBeNull();
  });

  it("keeps words typed past a matched title in the note", () => {
    expect(parsePlanLine("LARK (całość) z Radu", PROGRAM)).toMatchObject({
      piece: "lark",
      note: "z Radu, całość",
    });
  });

  it("makes a break of the break word, keeping what follows it", () => {
    expect(parsePlanLine("przerwa 10'", PROGRAM)).toMatchObject({
      piece: null,
      label: "Przerwa",
      minutes: 10,
      isBreak: true,
    });
    expect(parsePlanLine("19:30 Przerwa na kawę", PROGRAM)).toMatchObject({
      label: "Przerwa na kawę",
      startsAt: "19:30",
      isBreak: true,
    });
  });

  it("turns an unmatched title into a free row with its first letter raised", () => {
    expect(parsePlanLine("- ogłoszenia", PROGRAM)).toMatchObject({
      piece: null,
      title: "Ogłoszenia",
      label: "Ogłoszenia",
    });
  });

  it("reads nothing from a line with no title left", () => {
    expect(parsePlanLine("18:30 10'", PROGRAM)).toBeNull();
  });
});

describe("parsePlanText", () => {
  it("reads every non-empty line in order", () => {
    const lines = parsePlanText("1. Lark\n\n2. Laudes creaturarum\r\n18:30 10'", PROGRAM);
    expect(lines.map((line) => line.row?.piece ?? null)).toEqual(["lark", "laudes", null]);
    expect(lines[2]?.row).toBeNull();
    expect(lines[2]?.source).toBe("18:30 10'");
  });
});

describe("planTextOfFocus", () => {
  it("offers a topic of two lines or more", () => {
    expect(planTextOfFocus("1. Lark (fragm.)\n2. Laudes creaturarum (rozcz.)\n")).toBe(
      "1. Lark (fragm.)\n2. Laudes creaturarum (rozcz.)",
    );
  });

  it("splits a numbered list kept on one line", () => {
    expect(
      planTextOfFocus("1. Lark (fragm.) / 2. Laudes creaturarum (rozcz.) / 3. What a Wonderful World"),
    ).toBe("1. Lark (fragm.)\n2. Laudes creaturarum (rozcz.)\n3. What a Wonderful World");
    expect(planTextOfFocus("1. Lark 2. Laudes")).toBe("1. Lark\n2. Laudes");
  });

  it("leaves a headline alone", () => {
    expect(planTextOfFocus("LARK (całość) z Radu")).toBeNull();
    expect(planTextOfFocus("Antegenerale")).toBeNull();
    expect(planTextOfFocus("Requiem cz. 1–3, pierwsze czytanie")).toBeNull();
    expect(planTextOfFocus("")).toBeNull();
  });
});
