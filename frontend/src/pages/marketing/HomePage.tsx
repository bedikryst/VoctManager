/**
 * @file HomePage.tsx
 * @description Public landing page (`/`) — full React port of the hand-authored
 * `LandingPage.html` (kept side-by-side in this folder as the nginx fallback). Composes
 * the entire experience: preloader → threshold gate → sticky chrome → hero → manifest →
 * three aether interludes weaving through the path of past concerts → final support →
 * coda → footer. Donation flow (Vault + Regulamin + Gratitude/Failure result modals)
 * is hoisted under <VaultProvider> so any descendant can open the sheet.
 *
 * Lenis is mounted at the root via <ReactLenis root>. Scroll-aware behaviors
 * (reveals, parallax, rite-glow, chrome tone, anchor smooth-scroll, smooth-details
 * accordion) attach via dedicated hooks scoped to the landing root ref.
 * @architecture Enterprise SaaS 2026
 * @module pages/marketing/HomePage
 */

import { useRef } from "react";
import { ReactLenis } from "lenis/react";

import { useChantAudio } from "@/features/landing/hooks/useChantAudio";
import { useChromeTone } from "@/features/landing/hooks/useChromeTone";
import { useLenisAnchors } from "@/features/landing/hooks/useLenisAnchors";
import { useParallax } from "@/features/landing/hooks/useParallax";
import { useReveals } from "@/features/landing/hooks/useReveals";
import { useRiteGlow } from "@/features/landing/hooks/useRiteGlow";
import { useSmoothDetails } from "@/features/landing/hooks/useSmoothDetails";
import { VaultProvider } from "@/features/landing/providers/VaultContext";

import { AetherInterlude } from "@/widgets/landing/AetherInterlude/AetherInterlude";
import { CodaSection } from "@/widgets/landing/CodaSection/CodaSection";
import { DirectorSection } from "@/widgets/landing/DirectorSection/DirectorSection";
import { EnsembleSection } from "@/widgets/landing/EnsembleSection/EnsembleSection";
import { FinalSupportSection } from "@/widgets/landing/FinalSupportSection/FinalSupportSection";
import { HeroSection } from "@/widgets/landing/HeroSection/HeroSection";
import { ImageRiteSection } from "@/widgets/landing/ImageRiteSection/ImageRiteSection";
import { ManifestSection } from "@/widgets/landing/ManifestSection/ManifestSection";
import { PathSection } from "@/widgets/landing/PathSection/PathSection";
import { Preloader } from "@/widgets/landing/Preloader/Preloader";
import { RegulaminModal } from "@/widgets/landing/RegulaminModal/RegulaminModal";
import { FailureModal } from "@/widgets/landing/ResultModals/FailureModal";
import { GratitudeModal } from "@/widgets/landing/ResultModals/GratitudeModal";
import { SiteCursor } from "@/widgets/landing/SiteCursor/SiteCursor";
import { SiteFooter } from "@/widgets/landing/SiteFooter/SiteFooter";
import { StickyHeader } from "@/widgets/landing/StickyHeader/StickyHeader";
import { ThresholdGate } from "@/widgets/landing/ThresholdGate/ThresholdGate";
import { VaultModal } from "@/widgets/landing/VaultModal/VaultModal";

/**
 * Wires every landing-scoped scroll/audio side effect against the root tree.
 * Lives inside <ReactLenis> so `useLenisAnchors` can grab the shared Lenis instance.
 */
function LandingExperience(): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const chromeRef = useRef<HTMLElement>(null);
  const riteRef = useRef<HTMLElement>(null);
  const audio = useChantAudio();

  useReveals(rootRef);
  useParallax(rootRef);
  useRiteGlow(riteRef);
  useChromeTone(chromeRef, heroRef);
  useSmoothDetails(rootRef);
  useLenisAnchors();

  return (
    <div ref={rootRef} className="voct-landing">
      <a className="skip-link" href="#main">
        Przejdź do treści
      </a>
      <SiteCursor />
      <Preloader />
      <ThresholdGate audio={audio} />

      <StickyHeader ref={chromeRef} audio={audio} />

      <main id="main">
        <HeroSection ref={heroRef} />
        <ManifestSection />
        <AetherInterlude variant="passage" roman="I" latin="Lumen quaerit" />
        <ImageRiteSection ref={riteRef} />
        <EnsembleSection />
        <DirectorSection />
        <AetherInterlude variant="memory" roman="II" latin="Vox memoriae" />
        <PathSection />
        <AetherInterlude variant="offering" roman="III" latin="Sustinete nos" />
        <FinalSupportSection />
      </main>

      <VaultModal />
      <RegulaminModal />
      <GratitudeModal />
      <FailureModal />

      <CodaSection />
      <SiteFooter />
    </div>
  );
}

export default function HomePage(): React.JSX.Element {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.06,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1,
      }}
    >
      <VaultProvider>
        <LandingExperience />
      </VaultProvider>
    </ReactLenis>
  );
}
