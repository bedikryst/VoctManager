/**
 * @file ActivatePage.test.tsx
 * @description Account activation, tested as the one-shot it is. The signed link
 * arrives once, the server consumes it on the first successful POST, and the
 * request carries the version of the legal documents the member was shown — so a
 * submission that leaves without consent, or with a version the screen did not
 * display, is a consent record that does not describe what happened. Both
 * assertions are about what reaches `users/activate/`, or does not.
 * @architecture Enterprise SaaS 2026
 * @module pages/auth
 */

import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";

import { renderWithPanel } from "@/test/harness";
import { server } from "@/test/server";
import { LEGAL_DOCS_VERSION } from "@features/auth/components/LegalContent";

import ActivatePage from "./ActivatePage";

const UID = "MQ";
const TOKEN = "abc-def";
const ACTIVATION_ROUTE = `/activate?uid=${UID}&token=${TOKEN}&lang=pl`;

const PREVIEW_URL = "*/api/users/activate/preview/";
const ACTIVATE_URL = "*/api/users/activate/";

/** Stubs the signed preview and records what the activation POST carries. */
const arrangeActivation = (): { readonly submissions: unknown[] } => {
  const submissions: unknown[] = [];
  server.use(
    http.get(PREVIEW_URL, () =>
      HttpResponse.json({
        first_name: "Halina",
        first_name_vocative: "Halino",
        email: "sopran@voctfoundation.test",
        language: "pl",
      }),
    ),
    http.post(ACTIVATE_URL, async ({ request }) => {
      submissions.push(await request.clone().json());
      return HttpResponse.json({ email: "sopran@voctfoundation.test" });
    }),
  );
  return { submissions };
};

/** Waits out the `checking` state so the form is on screen before we drive it. */
const openLiveInvitation = async () => {
  const harness = renderWithPanel(<ActivatePage />, {
    route: ACTIVATION_ROUTE,
    user: null,
  });
  expect(await screen.findByLabelText("Nowe hasło")).toBeTruthy();
  return harness;
};

describe("ActivatePage", () => {
  it("will not spend the invitation on a submission without consent", async () => {
    const user = userEvent.setup();
    const { submissions } = arrangeActivation();
    await openLiveInvitation();

    await user.type(screen.getByLabelText("Nowe hasło"), "sopran-forte-2026");
    await user.type(screen.getByLabelText("Potwierdź hasło"), "sopran-forte-2026");
    await user.click(screen.getByRole("button", { name: "Aktywuj konto" }));

    // The consent box is unticked, so the link must stay unspent — and the form
    // has to say which rule it is holding on.
    await waitFor(() =>
      expect(
        screen.getByText(
          "Zaznacz akceptację regulaminu i polityki prywatności.",
        ),
      ).toBeTruthy(),
    );
    expect(submissions).toHaveLength(0);
  });

  it("activates with the legal version the member was actually shown", async () => {
    const user = userEvent.setup();
    const { submissions } = arrangeActivation();
    await openLiveInvitation();

    await user.type(screen.getByLabelText("Nowe hasło"), "sopran-forte-2026");
    await user.type(screen.getByLabelText("Potwierdź hasło"), "sopran-forte-2026");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Aktywuj konto" }));

    await waitFor(() => expect(submissions).toHaveLength(1));
    expect(submissions[0]).toEqual({
      uidb64: UID,
      token: TOKEN,
      new_password: "sopran-forte-2026",
      terms_version: LEGAL_DOCS_VERSION,
    });
  });
});
