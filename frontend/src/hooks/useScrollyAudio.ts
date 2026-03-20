/**
 * @file useScrollyAudio.ts
 * @description Custom React hook for scroll-linked cinematic audio.
 * Modulates volume based on scroll position to match visual cues.
 * @architecture Enterprise 2026 Standards
 * @module hooks/useScrollyAudio
 */

import { useEffect, useRef } from 'react';
import { useScroll } from 'framer-motion';

export function useScrollyAudio(isSoundOn: boolean): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { scrollYProgress } = useScroll();

  useEffect(() => {
    const audio = new Audio('/sounds/choir-room-tone.mp3');
    audio.loop = true;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    
    if (isSoundOn) {
      audioRef.current.play().catch(e => {
        console.warn("Audio System: Playback blocked by browser policy.", e);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isSoundOn]);

  useEffect(() => {
    return scrollYProgress.onChange((latest: number) => {
      if (!audioRef.current || !isSoundOn) return;
      
      let volume = 0.5; 
      
      // Silence Scene Logic:
      // Fade out audio between 0.15 and 0.45 scroll depth (center at 0.3).
      if (latest > 0.15 && latest < 0.45) {
        const distanceToSilenceCenter = Math.abs(latest - 0.3); 
        volume = Math.min(0.5, distanceToSilenceCenter * 3); 
      }
      
      audioRef.current.volume = Math.max(0, Math.min(1, volume)); 
    });
  }, [scrollYProgress, isSoundOn]);
}