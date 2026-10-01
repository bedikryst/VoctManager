/**
 * @file foundationSchema.ts
 * @description The schema.org `NGO` node for VoctFoundation, built from `data/foundation.ts`. The
 *  foundation is one entity under one `@id`; /fundacja and /o-nas describe it in full with
 *  `foundationNode()`, and every other graph that names it (a concert's organiser, a page's
 *  publisher) points at the same `@id` through `FOUNDATION_REF`, so search engines see one
 *  foundation rather than a twin per page.
 *
 *  TWO OBJECTS, NEVER ONE. The foundation and the ensemble are different organisations with
 *  different URLs: `SITE` is the MusicGroup's, the foundation's is its own page. The ensemble is
 *  the foundation's `subOrganization`, by reference only — its description belongs to the graphs
 *  that are about it (the landing, /o-nas).
 *
 *  ONLY REGISTER FACTS. Every value is read from `FOUNDATION`: the founding date is the notarial
 *  act's (the KRS entry date has not been read off the extract yet), the board's role names are
 *  the register's own Polish terms — the entity is the same in every locale, so they are not
 *  translated — and `sameAs` lists only the foundation's own profiles that exist.
 * @architecture Astro islands 2026
 * @module lib/foundationSchema
 */

import { FOUNDATION, type BoardFunction, type BoardMember } from "../data/foundation";
import { FOUNDATION_PAGE_LINKED } from "../data/foundationSupport";
import { SITE } from "../i18n/config";

/** The foundation's entity id, shared by every JSON-LD graph on the site. */
export const FOUNDATION_ID = `${SITE}/#foundation`;

/** The ensemble's entity id — the landing declares that node in full. */
const ENSEMBLE_ID = `${SITE}/#ensemble`;

/** The foundation's public home: /fundacja once it is announced, /o-nas's band until then. */
export const FOUNDATION_URL = FOUNDATION_PAGE_LINKED ? `${SITE}/fundacja` : `${SITE}/o-nas#fundacja`;

/** A reference to the foundation for a graph that only names it. */
export const FOUNDATION_REF = {
  "@type": "NGO",
  "@id": FOUNDATION_ID,
  name: FOUNDATION.nameShort,
  url: FOUNDATION_URL,
} as const;

/** The board functions as the KRS register words them. */
const ROLE_NAME: Readonly<Record<BoardFunction, string>> = {
  president: "Prezes Zarządu",
  vicePresident: "Wiceprezes Zarządu",
};

const person = (member: BoardMember) => ({
  "@type": "Person",
  "@id": `${SITE}/#person-${member.id}`,
  name: member.name,
});

/** The foundation in full: identity, registry, seat, founder, board and its own profiles. */
export function foundationNode() {
  const founder = FOUNDATION.board.find((member) => member.id === FOUNDATION.founder);
  if (!founder) throw new Error(`[foundationSchema] the founder "${FOUNDATION.founder}" is not on the board.`);
  return {
    "@type": "NGO",
    "@id": FOUNDATION_ID,
    name: FOUNDATION.nameShort,
    legalName: FOUNDATION.name,
    url: FOUNDATION_URL,
    email: FOUNDATION.mail.foundation,
    foundingDate: FOUNDATION.foundedOn,
    founder: person(founder),
    address: {
      "@type": "PostalAddress",
      streetAddress: FOUNDATION.seat.street,
      postalCode: FOUNDATION.seat.postalCode,
      addressLocality: FOUNDATION.seat.city,
      addressCountry: FOUNDATION.seat.countryCode,
    },
    taxID: FOUNDATION.registry.nip,
    identifier: [
      { "@type": "PropertyValue", propertyID: "KRS", value: FOUNDATION.registry.krs },
      { "@type": "PropertyValue", propertyID: "REGON", value: FOUNDATION.registry.regon },
    ],
    member: FOUNDATION.board.map((member) => ({
      "@type": "OrganizationRole",
      roleName: ROLE_NAME[member.function],
      member: person(member),
    })),
    subOrganization: { "@id": ENSEMBLE_ID },
    ...(FOUNDATION.socials.length > 0 && { sameAs: FOUNDATION.socials.map((profile) => profile.url) }),
  };
}
