# Newsletter creative brief: a letter between the leaves

Date: 2026-09-16. Status: creative proposal for the developer to select and hand off.
The developer explicitly requested a complete newsletter redesign, using the breviary
motif creatively. This stage produces a concept only; no application implementation.

## Authority and scope

This request supersedes the conservative recommendation to preserve the existing signup
composition in `web-outreach-second-review-2026-09.md`. The low footer strip, static
decorative ribbon and existing layout are not requirements for this proposal. Historical
comments describing why another surface was built a certain way are context, not a veto
on the requested redesign. Navigation itself is outside this redesign.

The site still provides the materials: parchment, ink, Cormorant, Plex, Cinzel, hairline
rules, silk and directional light. The newsletter gets a new composition and choreography
made from those materials. Backend findings remain in the second review as a separate
implementation workstream; they are not a reason to reduce the creative ambition.

## The concept

**A loose correspondence leaf tucked into the ensemble's breviary.**

The reader encounters a personal page in a public book. Entering an address writes the
destination on that page. Submitting shifts the leaf and reveals the confirmation
instruction underneath. Following the confirmation email opens the same composition on
the next concert. The metaphor explains the material and movement; plain language
explains every action.

The distinguishing object is the complete leaf: typography, address line, edge, ribbon
and response all share its geometry. Its reference is a contemporary typographic edition,
with the breviary visible in the construction rather than in antique illustration.

## The first frame

Use one broad editorial composition. The headline sits above the form, across the same
measure. This replaces the current promotional text beside a separate form.

1. A small running head: `NUNTIUS · zaproszenia na koncerty`.
2. A large Cormorant headline: **Do zobaczenia.** It is the visual centre of gravity.
3. One short sentence: **Zostaw e-mail. Damy znać o naszych koncertach.**
4. A prominent, permanently labelled address line occupying most of the leaf's width.
5. A shorter name line, labelled **Imię (opcjonalnie)**.
6. The consent block, then **Zapisz mnie**.

All functional content is visible on arrival. The name can share a lower horizontal
register with supporting information on generous widths; reading and focus order remain
email, name, consent, submit. Consent is ordinary readable text, not an ornamental footnote.
Its exact approved wording comes from the consent workstream.

The headline is expressive; labels and instructions use Plex Sans. Cinzel belongs to the
running head, Plex Mono to short metadata. An entered email uses Sans, with enough room
for a real long address. Avoid using a delicate display face for a practical value.

### Material and geometry

- The leaf occupies the section's available measure, without a rounded enclosing card.
  A slight difference between the paper plane and the surrounding ground defines it.
- Two exposed edges, offset approximately 6 and 12px, reveal the underlying leaves at
  the right/lower boundary. Most edges remain quiet; one edge carries a narrow shadow.
- The composition has a wide reading area and a narrow outer margin. A flax-coloured
  silk ribbon threads through a small slit in that margin and falls toward the action row.
  It visibly belongs to the leaf rather than floating beside a generic form.
- Start around 16-20px for the ribbon on desktop, 8-12px on mobile. Its slender proportion,
  axial highlight and notched end do the work. The ribbon carries no label or status code.
- The button sits beside the ribbon's terminal area, with a clear rectangular ink surface
  on paper and a legible inverse on the night ground. Its target is independent of the silk.
- Keep text horizontal. The paper edge and the motion can be oblique; the reader's work is not.
- Use the site's day/night ground when applicable. The letter remains distinct by a small
  tonal step and an edge; it does not become a separate black-and-gold campaign.

Starting proportions, to tune during implementation: desktop content measure 960-1120px;
roughly 8% outer margin for the ribbon; headline 72-112px on a wide layout and 42-58px on a
phone; email value 24-32px desktop and 18-22px mobile. These are art-direction starting
points, not fixed dimensions or a reason to clip translations. Form height follows content.

## Choreography: the signature moment

The distinctive motion happens after deliberate action, in the paper's own geometry.
The complete composition is readable and usable before any entrance animation finishes.

| Moment | Visible behavior |
| --- | --- |
| Arrival | The rear edges separate by a few pixels and settle; a brief raking highlight makes the silk readable. About 450-650ms, once per reveal. |
| Focus in the form | A small highlight on the silk and a clear underline on the active field. Nothing follows the pointer or moves the input. |
| Submitting | Keep the leaf and entered values in place. The ordinary button label reports the operation. |
| Request accepted | The foreground leaf moves about 24px upward and 8px sideways while fading out, revealing the receipt underneath over about 400-500ms. The ribbon settles by a few pixels. |
| Error | The leaf stays open with the values preserved. Show the error beside its field or the submit area. |
| Confirmed through email | The receipt composition contains the confirmed status and the next concert. It opens directly in this state, without replaying signup. |

This is a short movement between overlapping planes, not a simulated turning book page.
The request-accepted state is explicitly pending confirmation. Movement never announces
subscription success on its own. No drag, pull or scroll gesture is required to submit.
Reduced motion shows the target state directly. A ribbon is decorative, not a second control.

Preserve the region's height during the leaf exchange and move focus to the new instruction.
Allow it to grow when the new content needs more room. A fixed-height theatrical frame would
break the actual letter when its text, language or error changes.

## The other leaves

**Pending confirmation**

- Heading: **Sprawdź skrzynkę.**
- Main instruction: **Potwierdź zapis w wiadomości od VoctEnsemble.**
- Show the address entered in this browser, with **Popraw adres**.
- Provide a restrained **Wiadomość nie dotarła?** recovery disclosure with resend/cooldown
  behavior agreed with the backend. Keep the public response neutral about membership.
- The same paper and ribbon remain; the fields have been replaced by the next instruction.

**Confirmed**

- A clear **Jesteś na liście.** status.
- When a public future concert exists: title, place, date and **Zobacz program** typeset as
  the programme entry on this leaf. Use existing concert data, including individual dates.
- When no such concert exists: a truthful short promise of a future invitation and a link
  to concerts. There is no empty event card.
- A future patronage link is a secondary line after the concert action, once its page exists.
- Reopening a confirmed link shows the same useful destination.

**Expired, invalid or withdrawn**

The material stays calm. The heading describes the actual state; the primary action solves
it. Withdrawal has a plain acknowledgement without a new persuasive signup sequence.

## Responsive composition and placement

On a phone the book becomes a single leaf, with a narrow outer strip showing its layered
edge. Keep the ribbon at that edge and all text on the main reading axis. The headline
wraps naturally, fields stack, consent wraps, and the button has a generous target. The
keyboard must not require scrolling an internal panel. Compress decoration before text.

The composition fits content rather than consuming a prescribed viewport. Mobile uses the
same short paper exchange, with smaller travel; it is not a shrunken desktop book spread.

| Surface | Treatment |
| --- | --- |
| `/newsletter` | The complete leaf as the page's principal object, with an h1 and normal site chrome. Build this version first. |
| Landing | Replace the existing strip after the coda with the broad leaf. Let its ground join the footer as an endpaper, giving it real space without another chapter numeral or interlude. The existing coda remains upstream. |
| Concert list and upcoming concert | A compact leaf: smaller headline and margins, same form order, edges and state exchange. It can inherit the surrounding dark ground. |
| Contact and 404 | A short, clearly labelled invitation leading to `/newsletter`, using a small edge/ribbon signature. These pages do not need a second full theatrical ending. |
| `/nuntius` | The receipt/confirmed leaf from the same family. Keep existing email URLs operational. |

Use two form compositions (full and compact) and one small invitation link. The visual
family is shared; the amount of space reflects each page's purpose.

## The email belongs to the same family

Use a restrained correspondence layout: VoctEnsemble as sender, a small running head,
one short message, one unmistakable confirmation action, and a readable footer. A fine
rule can recall the page's register. Normal email-safe typography and a plain-text version
are sufficient; the website owns the moving paper. Concert invitations can subsequently
share the same letter structure with the programme as their main content.

## Handoff to implementation

The first implementation stage is the full leaf on `/newsletter`, including mobile,
pending, confirmed and error states, with their choreography. This establishes the object
before multiplying it across placements. The developer then judges it in their browser.

Once that composition works, apply the landing and compact placements, followed by the
receipt page and matching email treatment. Integrate the backend corrections from the
second review as their own stage; preserve subscription evidence and working mail links.
Every production text must cover PL/EN/FR through the existing web copy/chrome split.

Visual acceptance is specific: one recognizable correspondence leaf; an immediately
obvious email signup; a ribbon structurally attached to the paper; a memorable, brief
exchange into the next instruction; and a mobile composition that still feels intentional.
Do not reduce this brief to the current two-column strip with an extra ribbon.

Use `npm run check` and `npm run build` in `web/` at the end of the web implementation
stage, with relevant backend checks only when that code is changed. There is no build or
test requirement for this planning-only document.
