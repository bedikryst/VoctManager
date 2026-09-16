# Outreach: independent review and proposed direction

Date: 2026-09-16. Status: proposal, not an accepted implementation specification.
Companion: [original review](web-outreach-review-2026-09.md).

Scope: repository source review of signup, confirmation, consent evidence, sending,
and the proposed relationship to patronage. No production analytics, inbox delivery,
or rendered UI was inspected. Application code was not changed.

## Decisions to reconsider

| Original conclusion | Assessment |
| --- | --- |
| Count evenings instead of concerts | Renaming does not define a sending unit. A programme, an occurrence, and an email campaign are different things. |
| A few letters per year is a countable ceiling | It is an expectation, not an operational limit. Do not promise it without a sending policy that can keep it. |
| The signup cannot be a bottleneck | Unproven. A small initial audience supports a small implementation budget, not a conclusion about conversion. |
| Five percent open the vault, therefore patronage is the bottleneck | The reported number has no inspected denominator, time window, or intent breakdown. Bank transfers also happen outside the measured funnel. |
| Put the clause in details without changing its version | DOM presence is not the same as informed presentation. Version the information actually presented, including material surrounding promises. |
| Add a purpose column before sending or everyone needs to consent again | Schema migration does not change the scope of consent. Preserve the existing concert purpose; obtain separate consent for a genuinely additional purpose. |
| PatronLead is already the patrons' mailing list | It records expressions of interest, including NEW and CONTACTED. Neither a row nor a donation alone establishes permission for every future mailing. |
| A command over confirmed subscribers completes sending | A command is a useful entry point, but needs persistent delivery state and safe recovery. |

## Recommended signup shape

The conservative visual direction in this section is superseded by the developer's
2026-09-16 request for a complete breviary-inspired redesign. Its proposed creative brief
is [A letter between the leaves](web-newsletter-breviary-concept-2026-09.md).
The technical findings below remain applicable.

Preserve the current typefaces, palette, footer alignment, heading and Latin rubric.
Improve the existing composition rather than introduce a new section language.

- Desktop: invitation on the left, form on the right; stack when content no longer fits.
- Form order: email, optional name, consent, submit. Email should lead on mobile too.
- Keep the name available: the intended personal greeting is a reasonable product choice.
- Remove example placeholders; keep permanent labels and an explicit optional marker.
- Keep purpose, controller and withdrawal visible. Put supplementary explanation in a
  separate disclosure outside the checkbox label; do not bury interactive controls in it.
- Add vertical space without breaking the footer's horizontal alignment.
- If retained, the colourless ribbon is decorative and static. It must not indicate a
  completed subscription while confirmation is still pending.
- Submission feedback should show the address just entered locally, allow correcting it,
  and explain the next step. Preserve the API's non-enumerating response for all addresses.
- A resend path needs cooldown feedback and abuse protection; never promise that a mail
  was sent when the backend only accepted a request.

Suggested public copy, subject to the sending-policy decision:

> Damy znać o nadchodzących koncertach.
>
> Zaproszenia, terminy i przypomnienia przed koncertami. Jeśli zmieni się miejsce lub
> godzina, też damy znać.

This is a proposed replacement for an unconditional annual ceiling, not approval to
increase frequency for existing subscribers without reviewing the original promise.

## Sending policy and completion page

Start with one concert-invitation purpose and editorially initiated campaigns.
An initial announcement can collect all known dates for a programme. One collective
reminder can cover the approaching run. Corrections are separate and relevant to the
affected dates. A newly added performance months later requires an editorial decision;
do not generate a message automatically for every city or every database event.

After confirmation, show a plain success statement followed by the nearest published
public performance and a direct programme link. Apply this to already-confirmed links too.
The current source lists Pochwala Stworzenia on 2026-10-11 at 13:30 in Warsaw; derive the
display from concert data instead of embedding that fact in confirmation prose.

Make the programme the primary next action. A patronage link can be secondary, after its
destination exists. Do not add competing actions before the email confirmation step.
For late subscribers, the completion page supplies immediate information without sending
another welcome message or replaying an obsolete campaign.

Reuse the existing concert source. The current `upcomingStation` helper runs at build time
and only considers `date`, not every entry in `dates`; extending it requires deliberate
occurrence selection. The completion page must hide past occurrences at runtime or have
an explicit rebuild policy, including the Europe/Warsaw date boundary.

## Source-confirmed technical findings

1. **Confirmation transport failure has no automatic recovery.**
   `backend/outreach/services.py` catches a send exception, logs it and returns normally.
   The public API returns 202; `notice.sentBody` says the request was sent. The existing
   transport-failure test explicitly preserves this behavior. Add a durable outgoing
   record with bounded retries and visible operator failure state; retain generic public
   responses to avoid disclosing membership.
2. **The clause version describes the server, not necessarily the displayed form.**
   `subscribe()` stamps `NOTICE_CLAUSE_VERSION`; a page left open across deployment can
   display another version. Send a form disclosure identifier, validate it against an
   immutable server-side registry, and store the matching wording/version. Reject retired
   identifiers with a recoverable refresh step. An identifier is not proof that someone
   read the clause; confirmation and the recorded flow provide the supporting evidence.
3. **Confirmation and withdrawal are not serialized together.**
   `confirm()` reads status before its atomic write, without a row lock. A withdrawal can
   commit between those operations and then be overwritten. Lock and re-read inside the
   transaction for all competing transitions, including webhook withdrawal. Add a focused
   concurrency test on PostgreSQL; SQLite alone cannot establish row-lock correctness.
4. **Automatic JavaScript execution is treated as evidence of human action.**
   `NuntiusIsland` posts confirm/unsubscribe from its mount effect. This avoids mutation
   on the initial server GET, but does not establish that a person deliberately activated
   a control. Prefer an explicit confirmation action; browser withdrawal can likewise use
   a clear action while the dedicated RFC 8058 POST remains immediate. No scanner failure
   was reproduced in this review.
5. **The strip has a narrow desktop sizing conflict.**
   At a 900px viewport, 5vw side gutters leave 810px. The desktop grid needs at least
   280 + 520 + 28 = 828px. This follows from `notice.css` and border-box sizing;
   the visible effect still needs the developer's browser check. Fix the breakpoint or
   minimum tracks rather than relying only on extra vertical padding.

Before the first campaign: persistent campaign content and recipient delivery records,
a unique campaign/recipient key, preview and test delivery, resumable sending, a final
subscription-status check, public sender/reply-to, localized content, and unsubscribe links
and headers. Distinguish provider acceptance from inbox delivery. An ambiguous transport
timeout needs provider idempotency or reconciliation, not an unconditional retry that
claims exactly-once delivery. A full editor is unnecessary for the first small list.

## Consent presentation: unresolved legal assumption

The existing clause says an unspecified person leading the ensemble may take over the
list when the foundation closes. Do not treat this as an established transfer permission.
EDPB consent guidance paragraph 65 says other controllers relying on the original consent
should be named. This is a material question for the chosen succession arrangement,
not something a collapsed disclosure resolves. My preferred product direction is to
handle an actual controller change when it exists, with the necessary information and
consent, rather than burden every signup with an undefined future recipient.

Layered information is supported, but its first layer must convey the purpose, controller,
rights and unexpected/high-impact processing. Changing surrounding frequency promises
also deserves review; an unchanged checkbox string does not settle the matter by itself.

Sources checked on 2026-09-16:

- [EDPB consent guidance](https://www.edpb.europa.eu/system/files/documents/files/file1/edpb_guidelines_202005_consent_en.pdf), paragraphs 55-65 and 107-110.
- [Transparency guidance](https://www.edpb.europa.eu/system/files/2023-09/wp260rev01_en.pdf), paragraphs 35-36.

## Patronage and implementation order

A dedicated `/mecenat` page is useful as a destination for a personal request. Start with
the actual project, verified budget, what monthly support enables, the donor's ability
to change or stop their standing order, transfer details and a contact. A multi-year plan
or a public patron list need not block the page. Being a relative is not a reason to hide
a genuine supporter; publication should reflect permission and an honest presentation.
Replace the vault's duplicate patronage content with a route to the page, retaining discovery.

Proposed stages:

1. Set the sending promise and resolve disclosure/succession wording; preserve old consent evidence.
2. Fix signup ordering, spacing, responsive sizing and recovery; add the upcoming programme after confirmation.
3. Complete delivery recovery, consent-version matching and state transitions; add the minimal campaign sender before any campaign.
4. Build the patronage destination around available, verified content as a separate stage.

Verification belongs at the end of each implementation stage: relevant backend tests,
ruff and mypy for changed apps; the web project's declared checks for Astro changes;
PL/EN/FR coverage; visual verification by the developer. This review required no build
or test run because it changed documentation only.
