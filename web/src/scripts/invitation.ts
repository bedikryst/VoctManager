/**
 * @file invitation.ts
 * @description Gives the invitation cover's artwork a bounded decoding window and pauses its
 *  atmosphere outside the viewport, in a hidden tab and while a guest writes. The cover is composed once;
 *  delayed artwork, reduced motion and Astro navigation cannot replay it after the reader leaves.
 *  Sharing uses the device's native sheet when available and an addressed email draft otherwise.
 *  Acceptance is a session-local gesture measured anonymously in Plausible, not a reservation.
 * @module scripts/invitation
 */

import { GOALS, track, type Goal } from "../lib/plausible";

const invitationLinkGoals: Readonly<Record<string, Goal>> = {
  calendar: GOALS.invitationCalendar,
  programme: GOALS.invitationProgramme,
  facebook: GOALS.invitationFacebook,
  social: GOALS.invitationSocial,
  share: GOALS.invitationShare,
};

/** The cover's entrance, `zap-dawn` in styles/zaproszenie.css. */
const ENTRANCE_MS = 2400;

export function setupInvitation(): (() => void) | undefined {
  const sheet = document.querySelector<HTMLElement>(".zap");
  const cover = sheet?.querySelector<HTMLElement>(".zap-cover");
  if (!sheet || !cover) return;

  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const listeners = new AbortController();
  let active = true;
  let finishTimer: number | undefined;
  let readinessTimer: number | undefined;

  const compose = (): void => {
    cover.dataset.entrance = "composed";
    window.clearTimeout(finishTimer);
    window.clearTimeout(readinessTimer);
  };

  document.addEventListener(
    "click",
    (event) => {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[data-invitation-goal]")
          : null;
      if (!link) return;
      const goal = invitationLinkGoals[link.dataset.invitationGoal ?? ""];
      if (goal) track(goal);
    },
    { capture: true, signal: listeners.signal },
  );

  const accept = sheet.querySelector<HTMLButtonElement>("[data-invitation-accept]");
  if (accept?.dataset.acceptedLabel && accept.dataset.acceptKey) {
    const acceptedLabel = accept.dataset.acceptedLabel;
    const storageKey = "voct.invitation.accepted." + accept.dataset.acceptKey;
    const acknowledge = (): void => {
      accept.dataset.accepted = "";
      accept.disabled = true;
      accept.setAttribute("aria-disabled", "true");
      accept.textContent = acceptedLabel;
    };
    accept.hidden = false;
    try {
      if (window.sessionStorage.getItem(storageKey) === "1") acknowledge();
    } catch {
      // The gesture remains available when browser storage is restricted.
    }
    accept.addEventListener(
      "click",
      () => {
        if (accept.hasAttribute("data-accepted")) return;
        acknowledge();
        try {
          window.sessionStorage.setItem(storageKey, "1");
        } catch {
          // The composed button itself prevents repeat counting on this page.
        }
        track(GOALS.invitationAccepted);
      },
      { signal: listeners.signal },
    );
  }

  const hideFailedArtwork = (image: HTMLImageElement): void => {
    if (!image.complete || image.naturalWidth > 0) return;
    image.hidden = true;
    if (image.classList.contains("zap-art")) {
      const figure = cover.querySelector(".zap-figure");
      figure?.removeAttribute("role");
      figure?.removeAttribute("aria-label");
      figure?.setAttribute("aria-hidden", "true");
      compose();
    }
  };
  sheet.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    image.addEventListener("error", () => hideFailedArtwork(image), { signal: listeners.signal });
    hideFailedArtwork(image);
  });

  const share = sheet.querySelector<HTMLAnchorElement>("[data-invitation-share]");
  if (share && typeof navigator.share === "function") {
    share.addEventListener(
      "click",
      (event) => {
        const { shareTitle: title, shareText: text, shareUrl: url } = share.dataset;
        if (!title || !text || !url) return;
        event.preventDefault();
        void navigator.share({ title, text, url }).catch((error: unknown) => {
          if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
          window.location.assign(share.href);
        });
      },
      { signal: listeners.signal },
    );
  }

  const syncPreference = (): void => {
    sheet.toggleAttribute("data-motion-paused", media.matches || document.hidden);
    if (media.matches) compose();
  };
  const syncWriting = (): void => {
    const field = document.activeElement;
    sheet.toggleAttribute(
      "data-writing",
      field instanceof HTMLElement &&
        sheet.contains(field) &&
        field.matches("input, textarea, select"),
    );
  };

  // The cover carries the state of everything that breathes inside it.
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      cover.dataset.atmosphere = entry.isIntersecting ? "running" : "paused";
      if (!entry.isIntersecting) compose();
    }
  });
  cover.dataset.atmosphere = "paused";
  observer.observe(cover);

  sheet.addEventListener("focusin", syncWriting, { signal: listeners.signal });
  sheet.addEventListener(
    "focusout",
    () =>
      queueMicrotask(() => {
        if (active) syncWriting();
      }),
    { signal: listeners.signal },
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) compose();
      syncPreference();
    },
    { signal: listeners.signal },
  );
  media.addEventListener("change", syncPreference, { signal: listeners.signal });
  syncPreference();
  syncWriting();

  const box = cover.getBoundingClientRect();
  if (
    box.bottom <= 0 ||
    box.top >= window.innerHeight ||
    document.hidden ||
    !document.documentElement.classList.contains("voct-motion")
  ) {
    compose();
  }

  const artwork = Array.from(cover.querySelectorAll<HTMLImageElement>(".zap-art"));
  if (artwork.length === 0) compose();
  if (cover.dataset.entrance === "waiting") {
    const decoded = Promise.all(
      artwork.map(async (image) => {
        try {
          await image.decode();
        } catch {
          if (active) hideFailedArtwork(image);
        }
        return image.naturalWidth > 0;
      }),
    ).then((results) => results.every(Boolean));
    const deadline = new Promise<boolean>((resolve) => {
      readinessTimer = window.setTimeout(() => resolve(false), 500);
    });
    void Promise.race([decoded, deadline]).then((ready) => {
      window.clearTimeout(readinessTimer);
      if (!active || cover.dataset.entrance !== "waiting") return;
      const position = cover.getBoundingClientRect();
      if (
        !ready ||
        media.matches ||
        document.hidden ||
        position.bottom <= 0 ||
        position.top >= window.innerHeight
      ) {
        compose();
        return;
      }
      cover.dataset.entrance = "play";
      finishTimer = window.setTimeout(compose, ENTRANCE_MS);
    });
  }

  return () => {
    active = false;
    compose();
    observer.disconnect();
    listeners.abort();
  };
}
