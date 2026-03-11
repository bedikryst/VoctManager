/**
 * @file oldTeamSection.jsx
 * @description Board of Directors section featuring a brutalist editorial grid, 
 * staggered scroll-linked parallax for individual cards, multi-directional 
 * hover physics, and an infinite CSS/Framer marquee. 
 * To use in the future.
 * @author Krystian Bugalski
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useMouseAndGyro } from '../../hooks/useMouseAndGyro';

// Data model for the board members
const board = [
  {
    name: "Florent de Bazelaire",
    role: "Dyrygent",
    vision: "Muzyka • Artyzm",
    description: "Inicjator i dyrektor artystyczny. Odpowiada za jedność brzmienia i duchowy wymiar repertuaru.",
    img: "/flordraw.jpeg", 
    video: "/florvideo.mp4"
  },
  {
    name: "Anna Marcisz",
    role: "Manager Zespołu",
    vision: "Organizacja • Wizerunek",
    description: "Architektka relacji i wizerunku. Dba o to, by wizja artystyczna spotkała się z perfekcyjną realizacją.",
    img: "/aniadraw.jpeg",
    video: "/ania2.mp4"
  },
  {
    name: "Krystian Bugalski",
    role: "Digital Manager",
    vision: "Technologia • Stabilność",
    description: "Twórca ekosystemu VoctManager. Odpowiada za innowacje cyfrowe i technologiczną niezależność zespołu.",
    img: "/krystdraw.jpeg", 
    video: "/krystvideo.mp4"
  }
];

// Reusable SVG Noise texture
const noiseOverlay = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/**
 * Infinite horizontal scrolling text component.
 * @param {string} props.text - The typographic string to repeat.
 * @param {boolean} [props.reverse=false] - Sets the scroll direction (true = left-to-right).
 */
const Marquee = ({ text, reverse = false }) => {
  return (
    <div className="flex overflow-hidden whitespace-nowrap border-y border-stone-200 bg-stone-50 py-4 md:py-8 mt-16 md:mt-32">
      <motion.div 
        animate={{ x: reverse ? ["-100%", "0%"] : ["0%", "-100%"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="flex items-center"
      >
        {/* Render multiple instances to ensure a seamless infinite loop */}
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center">
            <span 
              className="text-4xl md:text-6xl lg:text-8xl font-medium tracking-tighter text-stone-300 uppercase px-8 md:px-12"
              style={{ fontFamily: "'Cormorant', serif" }}
            >
              {text}
            </span>
            {/* Decorative separator dot */}
            <div className="w-3 h-3 md:w-4 md:h-4 lg:w-5 lg:h-5 bg-stone-300 rounded-full" />
          </div>
        ))}
      </motion.div>
    </div>
  );
};

/**
 * Individual Card Component for Board Members
 * Handles image rendering, internal hover parallax, and external scroll offsets.
 */
const TeamMemberCard = ({ member, scrollTransform, gyroX, gyroY }) => {
  return (
    <motion.div style={{ y: scrollTransform }} className="flex flex-col group relative z-10">
      <div className="relative aspect-[3/4] overflow-hidden bg-white mb-8 border border-stone-200" onContextMenu={(e) => e.preventDefault()}>
        
        {/* Inner Parallax Image Wrapper */}
        <motion.div 
          style={{ 
            x: useTransform(gyroX, [-1, 1], [-20, 20]),
            y: useTransform(gyroY, [-1, 1], [-20, 20]),
          }}
          className="absolute inset-[-10%] w-[120%] h-[120%] flex items-center justify-center transition-transform duration-[700ms] group-hover:scale-105"
        >
          {member.video ? (
            <video
              src={member.video}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 z-10"
            />
          ) : (
            <img 
              src={member.img} 
              alt={member.name} 
              className="w-full h-full object-cover grayscale transition-all duration-700 group-hover:grayscale-0 bg-stone-800"
              loading="lazy"
              onError={(e) => {
                e.target.onerror = null; 
                e.target.src = `https://placehold.co/600x800/292524/a8a29e?text=${encodeURIComponent(member.name)}`;
              }}
            />
          )}
        </motion.div>
        
        {/* Optical Overlays */}
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none mix-blend-multiply" style={{ backgroundImage: noiseOverlay }} />
        
        {/* Vision Tag */}
        <div className="absolute bottom-4 left-4 bg-stone-900 text-stone-100 px-3 py-1 text-[9px] uppercase tracking-widest font-bold z-20">
          {member.vision}
        </div>
      </div>

      {/* Typography & Copy */}
      <h3 className="text-3xl md:text-4xl mb-2 tracking-tighter text-stone-900" style={{ fontFamily: "'Cormorant', serif" }}>
        {member.name}
      </h3>
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-700 mb-6">{member.role}</p>
      <p className="text-stone-500 text-sm leading-loose">{member.description}</p>
    </motion.div>
  );
};

export default function TeamSection() {
  const containerRef = useRef(null);
  
  // Track device orientation or mouse coordinates for internal card parallax
  const { x: gyroX, y: gyroY } = useMouseAndGyro();

  // Reference for scroll-linked animations
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  // Staggered vertical scroll transforms for the grid items
  const scrollTransforms = [
    useTransform(scrollYProgress, [0.1, 0.4], [300, 0]),
    useTransform(scrollYProgress, [0.15, 0.45], [300, 0]),
    useTransform(scrollYProgress, [0.2, 0.5], [300, 0])
  ];

  // Animation variants for the cinematic text reveal
  const titleRevealVariants = {
    hidden: { y: "100%" },
    visible: { 
      y: 0, 
      transition: { duration: 1, ease: [0.76, 0, 0.24, 1] } 
    }
  };

  return (
    <section id="zespol" ref={containerRef} className="bg-stone-50 pt-40 md:pt-64 z-20 relative overflow-hidden pb-16 md:pb-24">
      <div className="max-w-screen-2xl mx-auto px-6 md:px-12 relative">
        
        {/* Section Header with Typographic Mask */}
        <div className="mb-24 md:mb-40">
          <p className="mb-6 text-[10px] font-bold uppercase tracking-[0.4em] text-amber-700">Struktura</p>
          
          <div className="overflow-hidden pb-4">
            <motion.h2 
              variants={titleRevealVariants} 
              initial="hidden" 
              whileInView="visible" 
              viewport={{ once: true, margin: "-100px 0px 0px 0px" }} 
              className="text-5xl md:text-7xl lg:text-[7rem] leading-none tracking-tighter text-stone-900"
              style={{ fontFamily: "'Cormorant', serif" }}
            >
              Zarząd Zespołu
            </motion.h2>
          </div>
        </div>

        {/* Brutalist Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-24 items-start relative">
          {board.map((member, index) => (
            <TeamMemberCard 
              key={member.name}
              member={member}
              scrollTransform={scrollTransforms[index]}
              gyroX={gyroX}
              gyroY={gyroY}
            />
          ))}
        </div>
      </div>

      <Marquee text="Music Silence Contemplation" reverse={true} />
    </section>
  );
}