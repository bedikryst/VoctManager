/**
 * @file concert.ts
 * @description Static configuration for the next public Concerts Spirituels event.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/constants/concert
 */

export const CONCERT = {
  date: new Date("2026-05-16T18:00:00+02:00"),
  cycle: "Concerts Spirituels · MMXXVI",
  venueShort: "Warszawa",
  venueLong:
    "Sanktuarium św. Andrzeja Boboli · w obecności o. gen. Arturo Sosy SJ i abp. Adriana Galbasa SAC",
  occasion:
    "Uroczystość św. Andrzeja Boboli oraz jubileusz 100-lecia obu Polskich Prowincji Towarzystwa Jezusowego",
  iso: "16.V.MMXXVI · 18:00 CEST",
} as const;
