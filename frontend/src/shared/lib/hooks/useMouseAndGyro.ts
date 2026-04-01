/**
 * @file useMouseAndGyro.ts
 * @description Custom React hook capturing 2D motion coordinates. 
 * Maps cursor position on desktop or device orientation (gyroscope) on mobile 
 * into normalized, spring-animated Framer Motion values.
 * @architecture Enterprise 2026 Standards
 * @module hooks/useMouseAndGyro
 */

import { useEffect } from 'react';
import { useMotionValue, useSpring, MotionValue } from 'framer-motion';

interface MouseAndGyroReturn {
  x: MotionValue<number>;
  y: MotionValue<number>;
}

export function useMouseAndGyro(): MouseAndGyroReturn {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 30, stiffness: 100, mass: 0.5 };
  const smoothX = useSpring(x, springConfig);
  const smoothY = useSpring(y, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const normalizedX = (e.clientX / window.innerWidth) * 2 - 1;
      const normalizedY = (e.clientY / window.innerHeight) * 2 - 1;
      x.set(normalizedX);
      y.set(normalizedY);
    };

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!e.gamma || !e.beta) return;
      
      const normalizedX = Math.max(-1, Math.min(1, e.gamma / 45));
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