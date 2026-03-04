/**
 * @file WhatWeDoSection.jsx
 * @description Fullscreen horizontal scroll section featuring reveal parallax and dynamic grayscale-to-color transitions.
 * @author Krystian Bugalski
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const cards = [
  {
    id: "01",
    title: "Koncerty Duchowe",
    subtitle: "Concerts Spirituels",
    text: "Przywracamy tradycję dawnych Concerts Spirituels. Budujemy pomost między historyczną świadomością a potrzebami współczesnego słuchacza, tworząc przestrzeń autentycznego sacrum.",
    img: "/wystep.jpg"
  },
  {
    id: "02",
    title: "Dźwięk i Światło",
    subtitle: "Przestrzeń Interdyscyplinarna",
    text: "Koncerty jako nowoczesne misteria. Nasze brzmienie dopełniają mistrzowie formy: Ada Bystrzycka (reżyseria świateł), Jakub Garbacz (reżyseria dźwięku) oraz Sebastian Kuźma (kreacja wizualna).",
    img: "/jastrzab.jpg"
  },
  {
    id: "03",
    title: "Soliści i Wirtuozi",
    subtitle: "Muzyczne Synergie",
    text: "Poszerzamy klasyczne brzmienie wokalne o wybitne osobowości instrumentalne. Częstym gościem naszych projektów jest znakomity rumuński skrzypek, Radu Ropotan.",
    img: "/proba.jpg"
  },
  {
    id: "04",
    title: "Mecenat i Oprawa",
    subtitle: "Wydarzenia Dedykowane",
    text: "Uświetniamy najważniejsze uroczystości – od Opactwa Benedyktynów w Tyńcu i Kolegiaty św. Anny, po liturgie w obecności Przełożonego Generalnego Towarzystwa Jezusowego.",
    img: "/nuty.jpg"
  }
];

/**
 * Individual card component handling its own scroll-linked animations.
 * @param {Object} props.card - Card data containing id, title, subtitle, text, and image path.
 * @param {Object} props.scrollYProgress - Framer Motion value tracking the parent's scroll progress.
 * @param {number} props.index - Array index of the card to calculate scroll thresholds.
 */
const SingleCard = ({ card, scrollYProgress, index }) => {
  
  // Calculate the scroll range where this specific card is active.
  // Assuming 4 cards, each occupies 25% (0.25) of the total scroll distance.
  const start = index * 0.25 - 0.1; 
  const end = (index + 1) * 0.25;

  // Reveal Parallax Effect: Translate the image rightwards as the card container translates leftwards.
  const imageX = useTransform(scrollYProgress, [start, end], ["-15%", "15%"]);

  // Grayscale Transition: Interpolate to full color exactly at the midpoint of the card's screen time.
  const mid = start + 0.125; 
  const grayscale = useTransform(scrollYProgress, [start, mid, end], ["100%", "0%", "100%"]);

  return (
    <div className="relative flex h-screen w-screen shrink-0 items-center justify-start overflow-hidden">
      
      {/* Background Image Container */}
      <div className="absolute inset-0 h-full w-full overflow-hidden z-0 bg-stone-800">
        <motion.div 
          style={{ 
            x: imageX,
            filter: useTransform(grayscale, (v) => `grayscale(${v})`),
            backgroundImage: `url(${card.img})`
          }}
          className="absolute inset-[-20%] h-[140%] w-[140%] bg-cover bg-center transition-transform duration-[10s] ease-out hover:scale-105 bg-stone-800"
        />
      </div>
            
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-stone-900/70 md:bg-gradient-to-r md:from-stone-900/85 md:via-stone-800/50 md:to-transparent z-10" />

      {/* Card Content */}
      <div className="relative z-20 flex h-full w-full flex-col justify-center px-8 text-stone-100 md:w-1/2 md:pl-24 lg:pl-32 xl:pl-48">
        <span 
          className="mb-4 block text-7xl text-stone-500/50 md:text-8xl lg:text-[9rem] leading-none"
          style={{ fontFamily: "'Cormorant', serif" }}
        >
          {card.id}
        </span>
        <p className="mb-6 text-[10px] font-bold uppercase tracking-[0.4em] text-amber-600">
          {card.subtitle}
        </p>
        <h2 
          className="mb-8 text-4xl font-medium tracking-tighter md:text-6xl lg:text-7xl"
          style={{ fontFamily: "'Cormorant', serif" }}
        >
          {card.title}
        </h2>
        <p className="max-w-md text-sm leading-loose text-stone-300 md:text-base lg:text-lg font-thin">
          {card.text}
        </p>
      </div>
    </div>
  );
};

/**
 * Main wrapper component managing the sticky horizontal scroll container.
 */
export default function WhatWeDoSection() {
  const targetRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: targetRef,
  });

  // Maps the vertical scroll progress to horizontal translation
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-75%"]);

  return (
    <section ref={targetRef} className="relative h-[400vh] bg-stone-900">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <motion.div style={{ x }} className="flex w-[400vw]">
          {cards.map((card, index) => (
            <SingleCard 
              key={card.id} 
              card={card} 
              index={index} 
              scrollYProgress={scrollYProgress} 
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}