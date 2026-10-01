/**
 * @file reservations.ts
 * @description Client for a guest's reply on /rsvp: one POST to our own Django backend
 *  (`outreach` app) carrying the evening, a name and a seat count — zero for a guest who cannot
 *  come, which is how the backend records a decline. Cookie-less and
 *  unauthenticated, like the notice and patronage clients — there is no session to send.
 *
 *  THE ANSWER CARRIES NO DETAIL ON PURPOSE. 201 means the reply is on the list, whether or not
 *  that name had written before; the endpoint will not say which, so a public form cannot be
 *  asked who is coming. 410 is the one refusal with a sentence of its own: the concert has begun.
 * @architecture Astro islands 2026
 * @module islands/landing/api/reservations
 */

const RESERVATION_API = "/api/outreach/reservations/";

export type ReservationOutcome = "received" | "closed";

export class ReservationError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ReservationError";
  }
}

export async function submitReservation(payload: {
  readonly concert: string;
  readonly fullName: string;
  readonly seats: number;
}): Promise<ReservationOutcome> {
  let response: Response;
  try {
    response = await fetch(RESERVATION_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "omit",
      body: JSON.stringify({
        concert: payload.concert,
        full_name: payload.fullName,
        seats: payload.seats,
      }),
    });
  } catch (cause) {
    throw new ReservationError(`Network error contacting ${RESERVATION_API}`, cause);
  }

  if (response.status === 410) return "closed";
  if (!response.ok) {
    throw new ReservationError(`Reservation failed: HTTP ${response.status}`);
  }
  return "received";
}
