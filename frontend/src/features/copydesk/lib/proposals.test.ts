/**
 * @file proposals.test.ts
 * @description What the cell is allowed to claim. The chips are the desk's only
 * unprompted statements about a field, so a verdict that outlives the words it
 * was passed on tells an editor their unreviewed sentence has been accepted.
 * @module features/copydesk/lib/proposals.test
 */

import { describe, expect, it } from "vitest";

import { readCell } from "./proposals";
import type {
  CopyDeskProposal,
  CopyDeskSegment,
  CopyProposalStatus,
} from "../types/copydesk.dto";

const proposal = (
  id: string,
  status: CopyProposalStatus,
  extra: Partial<CopyDeskProposal> = {},
): CopyDeskProposal => ({
  id,
  value: "Proponowane zdanie.",
  status,
  comment: "",
  author_id: 1,
  author_name: "Krzysztof",
  is_mine: true,
  is_stale: false,
  source_known: true,
  updated_at: "2026-09-03T10:00:00Z",
  reviewed_at: null,
  applied_at: null,
  ...extra,
});

/** Newest first, as the payload arrives. */
const segment = (proposals: readonly CopyDeskProposal[]): CopyDeskSegment => ({
  id: "seg-1",
  key: "concert.wcielenie.hero.lede",
  locale: "pl",
  kind: "TEXT",
  scope: "concert.wcielenie",
  scope_label: "Wcielenie",
  label: "Zajawka",
  order: 1,
  value: "Zdanie, które trzyma repozytorium.",
  source_value: "Zdanie, które trzyma repozytorium.",
  is_stale: false,
  source_known: true,
  is_new: false,
  is_changed: false,
  proposals,
});

describe("readCell", () => {
  it("drops an accepted verdict the repository has already received", () => {
    // The bulk translation import's shape: one accepted, applied proposal per
    // cell, authored by the account that ran it and now indistinguishable from
    // the text the field is showing.
    const cell = readCell(
      segment([
        proposal("p1", "ACCEPTED", {
          value: "Zdanie, które trzyma repozytorium.",
          reviewed_at: "2026-09-02T09:00:00Z",
          applied_at: "2026-09-02T09:30:00Z",
        }),
      ]),
    );

    expect(cell.settled).toBeNull();
    expect(cell.awaiting).toBeNull();
  });

  it("drops an accepted verdict once the editor has written again", () => {
    const cell = readCell(
      segment([
        proposal("p2", "PROPOSED", { value: "Nowe zdanie, jeszcze nieczytane." }),
        proposal("p1", "ACCEPTED", {
          value: "Zdanie, które trzyma repozytorium.",
          reviewed_at: "2026-09-02T09:00:00Z",
          applied_at: "2026-09-02T09:30:00Z",
        }),
      ]),
    );

    expect(cell.mine?.id).toBe("p2");
    expect(cell.settled).toBeNull();
  });

  it("leaves a decided sentence to the panel that carries its text", () => {
    const cell = readCell(
      segment([
        proposal("p1", "ACCEPTED", {
          value: "Zdanie przyjęte, jeszcze niezapisane.",
          reviewed_at: "2026-09-03T11:00:00Z",
        }),
      ]),
    );

    expect(cell.awaiting?.id).toBe("p1");
    expect(cell.settled).toBeNull();
  });

  it("keeps a rejection standing while the editor answers it", () => {
    const cell = readCell(
      segment([
        proposal("p2", "PROPOSED", { value: "Druga próba." }),
        proposal("p1", "REJECTED", {
          value: "Pierwsza próba.",
          reviewed_at: "2026-09-02T09:00:00Z",
        }),
      ]),
    );

    expect(cell.settled?.id).toBe("p1");
  });

  it("reports the newest verdict, not the newest one still worth a chip", () => {
    // A rejection followed by an accepted rewrite: skipping the applied row
    // during the scan would resurrect the rejection the editor answered.
    const cell = readCell(
      segment([
        proposal("p2", "ACCEPTED", {
          value: "Zdanie, które trzyma repozytorium.",
          reviewed_at: "2026-09-02T09:00:00Z",
          applied_at: "2026-09-02T09:30:00Z",
        }),
        proposal("p1", "REJECTED", {
          value: "Pierwsza próba.",
          reviewed_at: "2026-09-01T09:00:00Z",
        }),
      ]),
    );

    expect(cell.settled).toBeNull();
  });

  it("keeps somebody else's decision off the cell", () => {
    const cell = readCell(
      segment([
        proposal("p1", "ACCEPTED", {
          is_mine: false,
          author_name: "Ania",
          value: "Zdanie, które trzyma repozytorium.",
          reviewed_at: "2026-09-02T09:00:00Z",
          applied_at: "2026-09-02T09:30:00Z",
        }),
      ]),
    );

    expect(cell.settled).toBeNull();
  });
});
