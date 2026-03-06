/**
 * @file useScrollyAudio.js
 * @description Custom React hook for scroll-linked cinematic audio.
 * Modulates volume based on scroll position to match visual cues 
 * (e.g., smoothly fading to silence on specific typography).
 * @author Krystian Bugalski
 */

import { useEffect, useRef } from 'react';
import { useScroll } from 'framer-motion';

/**
 * @param {boolean} isSoundOn - State determining if the user has enabled audio.
 */
export function useScrollyAudio(isSoundOn) {
  const audioRef = useRef(null);
  const { scrollYProgress } = useScroll();

  // ==========================================
  // 1. AUDIO INITIALIZATION & CLEANUP
  // ==========================================
  useEffect(() => {
    // Note: Ensure the mp3 file is located in public/sounds/
    const audio = new Audio('/sounds/choir-room-tone.mp3');
    audio.loop = true;
    audioRef.current = audio;

    // Cleanup function to prevent memory leaks and ghost audio
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // ==========================================
  // 2. PLAY/PAUSE STATE MANAGEMENT
  // ==========================================
  useEffect(() => {
    if (!audioRef.current) return;
    
    if (isSoundOn) {
      // Browsers require user interaction before playing audio.
      // We catch the promise rejection to avoid console errors if auto-play fails.
      audioRef.current.play().catch(e => {
        console.warn("VoctEnsemble Audio System: Playback blocked by browser policy.", e);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isSoundOn]);

  // ==========================================
  // 3. SCROLL-LINKED VOLUME KINEMATICS
  // ==========================================
  useEffect(() => {
    // Framer Motion's onChange listener attached to scroll progress
    return scrollYProgress.onChange((latest) => {
      if (!audioRef.current || !isSoundOn) return;
      
      let volume = 0.5; // Base subtle volume (avoid deafening the user)
      
      // The "Silence" Scene Logic:
      // When the user scrolls into the "Music — silence — Contemplation" section 
      // (approx 0.15 to 0.45 scroll depth), we mathematically fade out the audio.
      if (latest > 0.15 && latest < 0.45) {
        // Calculate the absolute distance to the absolute center of the scene (0.3)
        const distanceToSilenceCenter = Math.abs(latest - 0.3); 
        
        // Multiplier controls the "steepness" of the fade. 
        // 0 at the dead center, returning to max 0.5 on the edges.
        volume = Math.min(0.5, distanceToSilenceCenter * 3); 
      }
      
      // Safety clamp to ensure volume strictly stays between 0.0 and 1.0
      audioRef.current.volume = Math.max(0, Math.min(1, volume)); 
    });
  }, [scrollYProgress, isSoundOn]);
}