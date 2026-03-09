/**
 * @file ElegantHeading.jsx
 * @description A sophisticated typographic component.
 * Parses strings into independently animatable spans, allowing for 
 * complex, staggered hover interactions typical of high-end editorial web design.
 * @author Krystian Bugalski
 */

import { motion } from 'framer-motion';

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function ElegantHeading({ text, className }) {
  // --- STRING PROCESSING ---
  // Splits text into a character array to enable per-letter animation
  const letters = text.split('');

  // ==========================================
  // CHOREOGRAPHY
  // ==========================================

  const containerVariants = {
    initial: {},
    hover: {
      transition: {
        staggerChildren: 0.02,
      }
    }
  };

  const letterVariants = {
    initial: {
      y: 0,
      opacity: 1,
      skewX: 0,
      color: "inherit",
    },
    hover: {
      y: -2,
      opacity: 0.8,
      skewX: -5,
      color: "#002395",
      transition: {
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <motion.h2 
      className={`relative inline-block cursor-none ${className}`}
      variants={containerVariants}
      initial="initial"
      whileHover="hover"
      style={{ fontFamily: "'Cormorant', serif" }}
    >
      {letters.map((letter, index) => (
        <motion.span
          key={index}
          variants={letterVariants}
          className="inline-block"
          // Preserve natural spacing for empty characters
          style={{ whiteSpace: letter === ' ' ? 'pre' : 'normal' }}
        >
          {letter}
        </motion.span>
      ))}
    </motion.h2>
  );
}