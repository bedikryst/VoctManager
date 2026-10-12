/**
 * @file commentMode.ts
 * @description Links from the desk into the comment mode on the public site.
 * `?uwagi` is the site's switch: its loader stores the flag and drops the
 * parameter from the address bar, so a copied link never turns the mode on for
 * somebody else. The site shares the panel's origin, which is what lets the
 * mode reuse this session's cookies.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/lib/commentMode
 */

/** The query parameter the site's loader listens for. */
export const COMMENT_MODE_PARAM = "uwagi";

/** The site's root, where the mode opens when no page is named. */
export const SITE_ROOT_PATH = "/";

/**
 * `path` on the public site with the comment mode switched on. A plain `<a>`,
 * never a router link: the router would send a site path to the panel.
 */
export function commentModeHref(path: string = SITE_ROOT_PATH): string {
  return `${path}?${COMMENT_MODE_PARAM}`;
}
