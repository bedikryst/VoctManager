/**
 * @file public.config.ts
 * @description Navigation schema for the public-facing site (Landing, OverlayMenu).
 * @module shared/config/navigation/public
 */

// Marker for i18next-parser
const t = (key: string): string => key;

export interface PublicMenuLink {
  labelKey: string;
  path: string;
  image: string;
}

export const MAIN_PUBLIC_LINKS: readonly PublicMenuLink[] = [
  {
    labelKey: t("nav.overlay.links.home"),
    path: "/",
    image: "/wystep2.jpg",
  },
  {
    labelKey: t("nav.overlay.links.about"),
    path: "/o-zespole",
    image: "/zespol3.jpg",
  },
  {
    labelKey: t("nav.overlay.links.repertoire"),
    path: "/repertuar",
    image: "/nuty.jpg",
  },
  {
    labelKey: t("nav.overlay.links.foundation"),
    path: "/fundacja",
    image: "/zarzad.jpeg",
  },
  {
    labelKey: t("nav.overlay.links.support"),
    path: "/wesprzyj",
    image: "/kontakt.jpg",
  },
] as const;

export const SOCIAL_LINKS = {
  instagram: "https://instagram.com/voctensemble",
  facebook: "https://facebook.com/voctensemble",
  youtube: "https://www.youtube.com/@VoctEnsemble-nb7gh",
} as const;

export const CONTACT_INFO = {
  email: "kontakt@voctensemble.pl",
  locationKey: t("nav.overlay.status.location"), // "Kraków, PL — Fundacja VoctEnsemble"
} as const;
