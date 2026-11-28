/**
 * @file accountState.ts
 * @description What the roster says about a member's platform account. One
 * predicate per state, shared by the roster's rows, quick filters and dossier, the
 * pending-invitation count and the project's cast, so none of them can
 * disagree about who is waiting on an invitation or who the app cannot reach.
 * @module features/artists/lib/accountState
 */

import type { Artist } from "@/shared/types";

/**
 * Added deliberately without an address: there is no invitation to answer,
 * nothing the app sends reaches them, and everything they need is passed on by
 * people. Not an alarm — the manager chose it when adding them. Strictly the
 * empty string: an address missing from a partial DTO is unknown, not absent.
 */
export const isWithoutEmail = (artist: Artist): boolean =>
  Boolean(artist.user) && artist.email === "";

/**
 * Invited and not answered yet. `account_activated` is manager-only (undefined
 * otherwise), so unknown counts as neither state. The serializer also reports
 * `false` for a row with no account ({@link isDetached}), which is the crimson
 * "detached" state rather than a pending invite — hence the linked-account
 * check — and for a member without an address, who was never invited.
 */
export const isAwaitingActivation = (artist: Artist): boolean =>
  Boolean(artist.user) &&
  artist.account_activated === false &&
  !isWithoutEmail(artist);

/**
 * Signed in, and no device of theirs takes a push. Push is account-wide — one
 * working phone is the whole answer — so this is the list of people worth asking
 * in person; until then the server mails them reminders and answers to their
 * requests, while new material waits in the app. Only for an activated account:
 * a member out of reach altogether belongs to {@link outOfReachReason}.
 * `has_push` is manager-only, so an unknown value is never marked.
 */
export const isWithoutPush = (artist: Artist): boolean =>
  artist.has_push === false && artist.account_activated === true;

/**
 * On the roster with no account behind the row: the auth row it pointed at was
 * deleted, and `Artist.user` nulled with it. The app's own erasure anonymizes an
 * account rather than deleting it, and archives the row, so this is left by a
 * deletion outside the app's flows (the Django admin). Nothing reaches the
 * member, and an address typed into the profile is a label that sends no
 * invitation. Only an active row is flagged: an archived one asks nothing of
 * the manager.
 */
export const isDetached = (artist: Artist): boolean => artist.is_active && !artist.user;

/**
 * A thread is addressed to the member's linked account. Without one
 * ({@link isDetached}) there is nowhere to deliver it and the server refuses
 * the thread, so no "write" action is offered for them.
 */
export const canReceiveMessages = (artist: Artist): boolean => Boolean(artist.user);

export type OutOfReachReason = "no_email" | "not_activated";

/**
 * Why nothing the app sends reaches this member, or null when it does (or when
 * the manager-only fields are absent and it is unknown). An unactivated account
 * is as far out of reach as one without an address: notification e-mail is
 * suppressed until activation, and a member who never signed in has no push
 * device and never opens the app. A member who activated and switched e-mail
 * off is deliberately not here — they read the app, and their notification
 * settings are their own business, not the manager's.
 */
export const outOfReachReason = (artist: Artist): OutOfReachReason | null => {
  if (isWithoutEmail(artist)) return "no_email";
  if (isAwaitingActivation(artist)) return "not_activated";
  return null;
};
