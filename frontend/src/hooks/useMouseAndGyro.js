/**
 * @file useMouseAndGyro.js
 * @description Custom React hook capturing 2D motion coordinates. 
 * Maps cursor position on desktop or device orientation (gyroscope) on mobile 
 * into normalized, spring-animated Framer Motion values.
 * @author Krystian Bugalski
 */

import { useEffect } from 'react';
import { useMotionValue, useSpring } from 'framer-motion';

export function useMouseAndGyro() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Apply spring physics for smooth, organic motion tracking
  const springConfig = { damping: 30, stiffness: 100, mass: 0.5 };
  const smoothX = useSpring(x, springConfig);
  const smoothY = useSpring(y, springConfig);

  useEffect(() => {
    // Handler for Desktop: Maps viewport coordinates to a [-1, 1] range
    const handleMouseMove = (e) => {
      const normalizedX = (e.clientX / window.innerWidth) * 2 - 1;
      const normalizedY = (e.clientY / window.innerHeight) * 2 - 1;
      x.set(normalizedX);
      y.set(normalizedY);
    };

    // Handler for Mobile: Maps gyroscope beta/gamma angles to a [-1, 1] range
    const handleOrientation = (e) => {
      if (!e.gamma || !e.beta) return;
      // Gamma (left/right tilt) mapping
      const normalizedX = Math.max(-1, Math.min(1, e.gamma / 45));
      // Beta (front/back tilt) mapping, subtracting 45 deg for standard holding angle
      const normalizedY = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
      x.set(normalizedX);
      y.set(normalizedY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [x, y]);

  return { x: smoothX, y: smoothY };
}