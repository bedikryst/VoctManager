/**
 * @file PublishProjectModal.test.tsx
 * @description The publication confirmation, tested as the last door in front of
 * an irreversible act: one POST to `publish/` mails every awaiting member of the
 * cast, and nothing recalls it. So the assertions are about the door, not the
 * decoration — that the conductor is shown who will be written to, that
 * confirming sends exactly one request, that an unpublishable project cannot be
 * sent at all, and that the dialog cannot be dismissed out from under a write
 * already in flight.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components
 */

import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";

import { renderWithPanel } from "@/test/harness";
import { server } from "@/test/server";
import type { Project } from "@/shared/types";

import type { ProjectPublicationPreview } from "../api/project.service";
import { PublishProjectModal } from "./PublishProjectModal";

const PROJECT_ID = "proj-1";
const PREVIEW_URL = "*/api/projects/:projectId/publish/";

/** What the endpoint answers with: the draft, now live. */
const publishedProject: Project = {
  id: PROJECT_ID,
  title: "Nieszpory Rachmaninowa",
  date_time: "2026-12-19T19:00:00Z",
  timezone: "Europe/Warsaw",
  status: "ACTIVE",
};

const preview = (
  overrides: Partial<ProjectPublicationPreview> = {},
): ProjectPublicationPreview => ({
  project_id: PROJECT_ID,
  status: "DRAFT",
  is_publishable: true,
  recipient_count: 12,
  recipients: [
    {
      participation_id: "part-1",
      artist_name: "Halina Testowa",
      is_reachable: true,
    },
    {
      participation_id: "part-2",
      artist_name: "Bogumił Bezkonta",
      is_reachable: false,
    },
  ],
  skipped_count: 3,
  warnings: ["no_program", "unreachable_artists"],
  ...overrides,
});

/** Stubs the preview read and counts what reaches the publish endpoint. */
const arrangePublication = (
  previewBody: ProjectPublicationPreview,
  onPublishRequest?: () => Promise<void>,
): { readonly count: () => number } => {
  let posts = 0;
  server.use(
    http.get(PREVIEW_URL, () => HttpResponse.json(previewBody)),
    http.post(PREVIEW_URL, async () => {
      posts += 1;
      await onPublishRequest?.();
      return HttpResponse.json(publishedProject);
    }),
  );
  return { count: () => posts };
};

/** The modal always mounts open — its closed state is the caller's business. */
const openModal = (
  handlers: {
    readonly onClose?: () => void;
    readonly onPublished?: () => void;
  } = {},
) =>
  renderWithPanel(
    <PublishProjectModal
      isOpen
      projectId={PROJECT_ID}
      projectTitle={publishedProject.title}
      onClose={handlers.onClose ?? (() => {})}
      onPublished={handlers.onPublished}
    />,
  );

describe("PublishProjectModal", () => {
  it("states how many people the message reaches, and names the gaps it will carry", async () => {
    arrangePublication(preview());
    openModal();

    expect(
      await screen.findByText(
        "osób otrzyma pełne zaproszenie: termin, próby, program i swoją partię.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();

    // Both warnings the preview returned, in the conductor's language.
    expect(
      screen.getByText("Program jest pusty — zaproszenie nie poda repertuaru."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Część obsady nie ma jeszcze konta — do nich zaproszenie nie dotrze.",
      ),
    ).toBeTruthy();
    // The unreachable member is named, so the conductor can chase them by hand.
    expect(screen.getByText("Bogumił Bezkonta")).toBeTruthy();
  });

  it("sends exactly one publish request and reports back once the server answers", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onPublished = vi.fn();
    const publish = arrangePublication(preview());
    openModal({ onClose, onPublished });

    const confirm = await screen.findByRole("button", {
      name: "Opublikuj i wyślij",
    });
    await user.click(confirm);

    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));
    expect(publish.count()).toBe(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("refuses to send a project the server says is not publishable", async () => {
    const user = userEvent.setup();
    const publish = arrangePublication(
      preview({ is_publishable: false, recipient_count: 0, warnings: ["no_cast"] }),
    );
    openModal();

    const confirm = await screen.findByRole("button", {
      name: "Opublikuj i wyślij",
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    await user.click(confirm);
    expect(publish.count()).toBe(0);
  });

  it("cannot be dismissed while the invitations are being sent", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    // Hold the server open so the pending state is observable rather than raced.
    let release: () => void = () => {};
    const inFlight = new Promise<void>((resolve) => {
      release = resolve;
    });
    arrangePublication(preview(), () => inFlight);
    openModal({ onClose });

    await user.click(
      await screen.findByRole("button", { name: "Opublikuj i wyślij" }),
    );

    const cancel = screen.getByRole("button", { name: "Anuluj" });
    await waitFor(() => expect((cancel as HTMLButtonElement).disabled).toBe(true));
    expect(
      (screen.getByRole("button", { name: "Zamknij" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();

    release();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
