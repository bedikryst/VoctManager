/**
 * @file social.ts
 * @description The ensemble's three social accounts, as data: the address a link opens and the
 *  handle a social-media manager types to tag it.
 *
 *  ONLY THE ENSEMBLE HAS ACCOUNTS. The foundation keeps none, so there is no second set here and
 *  /press's "Oznacz nas" names these three and nothing else.
 *
 *  Read by both footers (the Astro one and the landing's island), the `sameAs` of every page that
 *  declares the ensemble's MusicGroup node, and /press — the same URL typed on six surfaces was
 *  six places for a renamed channel to go stale. Pure by contract, like `foundation.ts`, so a
 *  React island and a Node script can import it too.
 * @architecture Astro islands 2026
 * @module data/social
 */

export interface SocialAccount {
  /** The profile's address, as a link opens it. */
  readonly url: string;
  /** What a post types to tag the account — the platform's own handle, `@` included. */
  readonly handle: string;
  /** The platform's name, printed beside the handle. */
  readonly platform: string;
}

export const SOCIAL = {
  instagram: {
    url: "https://www.instagram.com/voctensemble/",
    handle: "@voctensemble",
    platform: "Instagram",
  },
  facebook: {
    url: "https://www.facebook.com/voctensemble/",
    handle: "@voctensemble",
    platform: "Facebook",
  },
  youtube: {
    url: "https://www.youtube.com/@VoctEnsemble-nb7gh",
    handle: "@VoctEnsemble-nb7gh",
    platform: "YouTube",
  },
} as const satisfies Record<string, SocialAccount>;

/** The three profile URLs, for a schema.org `sameAs`. */
export const SOCIAL_SAME_AS: readonly string[] = Object.values(SOCIAL).map((account) => account.url);
