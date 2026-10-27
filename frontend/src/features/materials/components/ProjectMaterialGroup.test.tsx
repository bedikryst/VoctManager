/**
 * @file ProjectMaterialGroup.test.tsx
 * @description Who may tell a project's choir about new marks from the songbook.
 *
 * A member preview is the manager's session wearing the member's screen, so a
 * working "Powiadom chór" there paged the real choir from a screen that promises
 * only to look — and the concert book opened from it was the manager's stand,
 * with their pencil and the choir's set-aside. And a project that is over or
 * called off has no cast left to tell.
 * @module features/materials/components/ProjectMaterialGroup.test
 */

import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";

import { ArtistPreviewProvider } from "@/app/providers/ArtistPreviewProvider";
import { renderWithPanel } from "@/test/harness";
import { server } from "@/test/server";

import { ProjectMaterialGroup } from "./ProjectMaterialGroup";
import type {
  MaterialsDashboardGroup,
  MaterialsPiece,
} from "../types/materials.dto";

// The annotations module reaches the viewer, which loads pdf.js, and pdf.js
// needs a DOMMatrix that jsdom does not have. Nothing here renders a page.
vi.mock("react-pdf", () => ({
  Document: () => null,
  Page: () => null,
  pdfjs: { GlobalWorkerOptions: {} },
}));

const { scoreBook } = vi.hoisted(() => ({ scoreBook: vi.fn() }));
vi.mock("@/features/projects/components/ProjectScoreBook", () => ({
  ProjectScoreBook: (props: unknown) => {
    scoreBook(props);
    return null;
  },
}));
vi.mock("./PieceRow", () => ({ PieceRow: () => null }));
vi.mock("./OfflineDownloadControl", () => ({ OfflineDownloadControl: () => null }));

const group = (status = "ACTIVE"): MaterialsDashboardGroup => ({
  project: {
    id: "project-1",
    title: "Pochwała stworzenia",
    date_time: "2026-11-15T18:00:00Z",
    status,
    status_display: status,
    location: null,
    has_score_pdf: true,
  },
  participationId: null,
  participationStatus: null,
  isConducting: false,
  isLeading: false,
  isManaging: true,
  program: [
    {
      order: 1,
      is_encore: false,
      piece: {
        id: "piece-1",
        title: "Ave verum",
        my_readiness: null,
        materials_withheld: false,
        may_mark_for_choir: false,
      } as unknown as MaterialsPiece,
    },
  ],
});

const arrangeNews = (): void => {
  server.use(
    http.get("*/api/projects/:projectId/marks_news/", () =>
      HttpResponse.json({
        since: "2026-10-01T10:00:00Z",
        notified_at: null,
        next_allowed_at: null,
        recipients: 12,
        pieces: [{ piece_id: "piece-1", title: "Ave verum", composer_name: "", count: 3 }],
      }),
    ),
  );
};

const KASIA = {
  id: "artist-7",
  firstName: "Kasia",
  lastName: "Testowa",
  fullName: "Kasia Testowa",
  avatarUrl: null,
  voiceLabel: null,
};

describe("Powiadom chór in the songbook", () => {
  it("is offered to a manager on a live project", async () => {
    arrangeNews();
    renderWithPanel(<ProjectMaterialGroup group={group()} />);

    expect(
      await screen.findByRole("button", { name: /Powiadom chór/ }),
    ).toBeTruthy();
  });

  it("is never offered inside a member preview, and the book does not open there", async () => {
    arrangeNews();
    scoreBook.mockClear();
    renderWithPanel(
      <ArtistPreviewProvider artist={KASIA}>
        <ProjectMaterialGroup group={group()} />
      </ArtistPreviewProvider>,
    );

    const open = await screen.findByRole("button", { name: "Otwórz książkę koncertu" });
    expect(open.closest("[inert]")).not.toBeNull();
    expect(scoreBook).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Powiadom chór/ })).toBeNull();
  });

  it("is not offered once the project is over or called off", () => {
    arrangeNews();
    for (const status of ["DONE", "CANC"]) {
      const { unmount } = renderWithPanel(<ProjectMaterialGroup group={group(status)} />);
      expect(screen.queryByRole("button", { name: /Powiadom chór/ })).toBeNull();
      expect(scoreBook).toHaveBeenLastCalledWith(
        expect.objectContaining({ canNotifyChoir: false }),
      );
      unmount();
    }
  });
});
