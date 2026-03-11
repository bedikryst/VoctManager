/**
 * @file WhatWeSingSection.jsx
 * @description The Repertoire Archive.
 * Flipped layout (Content Left, Titles Right) to break visual monotony.
 * Includes a continuous architectural thread connecting from the previous section,
 * drawing horizontally before descending vertically.
 * Features an interactive, scrollable roster with mobile expansion logic.
 * @author Krystian Bugalski
 */

import { useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useCursor } from '../../context/CursorContext';
import ElegantHeading from '../ui/ElegantHeading';

// ==========================================
// ANIMATION VARIANTS
// ==========================================

const blurVariants = {
  hidden: { opacity: 0, y: 30, filter: "blur(8px)" },
  visible: (delay) => ({
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { duration: 1.2, delay: delay, ease: [0.16, 1, 0.3, 1] }
  })
};

const maskVariants = {
  hidden: { y: "100%", rotate: 7, opacity: 0 },
  visible: (delay) => ({
    y: "0%", 
    rotate: 0, 
    opacity: 1,
    transition: { duration: 1.2, delay: delay, ease: [0.16, 1, 0.3, 1] }
  })
};

// ==========================================
// DATA MODELS (Repertoire Archive)
// ==========================================

const composers = [
  { name: "Gregorio Allegri", piece: "Miserere mei, Deus" },
  { name: "Johann Sebastian Bach", piece: "Singet dem Herrn ein neues Lied, BWV 225" },
  { name: "Edward C. Bairstow", piece: "I sat down" },
  { name: "Anton Bruckner", piece: "Os justi, WAB 30" },
  { name: "Rihards Dubra", piece: "O Crux ave" },
  { name: "Edward Elgar", piece: "Lux aeterna" },
  { name: "Ēriks Ešenvalds", piece: "O salutaris hostia • Stars" },
  { name: "Gabriel Fauré", piece: "Pie Jesu" },
  { name: "Marco Frisina", piece: "Anima Christi" },
  { name: "Orlando Gibbons", piece: "Drop, drop, slow tears • O clap your hands" },
  { name: "Ola Gjeilo", piece: "Pulchra es • Serenity" },
  { name: "Henryk Mikołaj Górecki", piece: "Sanctus, Sanctus, Sanctus" },
  { name: "Jacob Handl (Gallus)", piece: "Canite tuba" },
  { name: "Hanna Havrylets", piece: "Prayer" },
  { name: "George Frideric Händel", piece: "Hallelujah" },
  { name: "Josquin des Prez", piece: "O salutaris hostia" },
  { name: "Mariusz Kramarz", piece: "Gdy śliczna Panna" },
  { name: "Dawid Kusz OP", piece: "Alleluja laterańskie" },
  { name: "Orlando di Lasso", piece: "Laudate Dominum omnes gentes" },
  { name: "Antonio Lotti", piece: "Crucifixus" },
  { name: "David MacIntyre", piece: "Ave Maria" },
  { name: "Claudio Monteverdi", piece: "Cantate Domino • Quel augellin che canta" },
  { name: "Wolfgang Amadeus Mozart", piece: "Ave verum corpus" },
  { name: "Giovanni Pierluigi da Palestrina", piece: "Super flumina Babylonis" },
  { name: "Arvo Pärt", piece: "Da Pacem Domine • Nunc dimittis • The Deer's Cry" },
  { name: "Krzysztof Penderecki", piece: "O gloriosa Virginum" },
  { name: "Siergiej Rachmaninow", piece: "Ektenia Pokoju" },
  { name: "Salomone Rossi", piece: "Barukh haba beshem Adonai" },
  { name: "John Rutter", piece: "A Ukrainian Prayer" },
  { name: "Jan Sandström", piece: "Es ist ein Ros' entsprungen" },
  { name: "Heinrich Schütz", piece: "Jauchzet dem Herrn, alle Welt" },
  { name: "Caroline Shaw", piece: "and the swallow" },
  { name: "Jean Sibelius", piece: "Be Still My Soul" },
  { name: "Charles Villiers Stanford", piece: "Beati quorum via" },
  { name: "Ken Steven", piece: "Dawn and Dusk" },
  { name: "Philip W. J. Stopford", piece: "Lully, Lullay" },
  { name: "Jacek Sykulski", piece: "Stoi lód na prośnie" },
  { name: "John Tavener", piece: "A Hymn to the Mother of God • Song for Athene" },
  { name: "Ralph Vaughan Williams", piece: "The Lark Ascending" },
  { name: "Tomás Luis de Victoria", piece: "Alma Redemptoris Mater" },
  { name: "Bernat Vivancos", piece: "A Child is born • Aeternam • Le cri des bergers" },
  { name: "John Williams", piece: "Hymn to the Fallen" },
  { name: "Mikołaj Zieleński", piece: "Vox in Rama" }
];

const traditional = [
  { name: "Gaudete", piece: "XVI w. / arr. Brian Kay" },
  { name: "O Virgo Splendens", piece: "XIV w. / Llibre Vermell de Montserrat" },
  { name: "Salve Regina", piece: "Tradycyjna melodia z Oksytanii" },
  { name: "Tantum ergo sacramentum", piece: "XVII w. / polifonia korsykańska" }
];

// ==========================================
// HELPER COMPONENTS
// ==========================================

const FadeBlurIn = ({ children, delay = 0, className = "" }) => (
  <motion.div variants={blurVariants} custom={delay} className={className} style={{ willChange: "transform, opacity, filter" }}>
    {children}
  </motion.div>
);

const MaskReveal = ({ children, delay = 0, className = "" }) => (
  <div className={`overflow-hidden pt-10 pb-12 -mt-10 -mb-12 px-4 -mx-4 ${className}`}>
    <motion.div variants={maskVariants} custom={delay}>
      {children}
    </motion.div>
  </div>
);

const RosterItem = ({ composer, piece }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.1 }}
    transition={{ duration: 0.5, ease: "easeOut" }}
    className="flex flex-col md:flex-row md:items-end justify-between py-5 md:py-6 border-b border-stone-200 transition-all duration-500 md:group-hover:opacity-30 md:hover:!opacity-100 md:hover:border-[#002395]"
  >
    <h4 className="text-xl md:text-3xl lg:text-4xl text-stone-800 transition-colors duration-500 md:hover:text-[#002395]" style={{ fontFamily: "'Cormorant', serif" }}>
      {composer}
    </h4>
    <p className="text-xs md:text-sm text-stone-400 mt-2 md:mt-0 font-light tracking-wide text-left md:text-right transition-colors duration-500 md:hover:text-[#002395]">
      {piece}
    </p>
  </motion.div>
);

export default function WhatWeSingSection() {
  // ==========================================
  // STATE & REFERENCES
  // ==========================================
  
  const sectionRef = useRef(null);
  
  // Manages the state of the repertoire list on mobile devices
  const [isExpanded, setIsExpanded] = useState(false);

  // ==========================================
  // SCROLL & PARALLAX KINEMATICS
  // ==========================================
  
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  
  // Parallax for the left-side typography
  const yParallaxFast = useTransform(scrollYProgress, [0, 1], [30, -90]); 
  
  // Parallax for the massive background watermark text
  const bgParallax = useTransform(scrollYProgress, [0, 1], [100, -200]);

  // --- Continuous Visual Thread Logic ---
  // Phase 1: Horizontal bridge drawn as section enters the viewport
  const horizontalProgress = useTransform(scrollYProgress, [0.236, 0.3], [0, 1]);
  // Phase 2: Vertical drop descends once the horizontal bridge completes
  const verticalProgress = useTransform(scrollYProgress, [0.3, 0.8], [0, 1]);

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <section ref={sectionRef} className="relative bg-[#fdfbf7] text-stone-900 selection:bg-[#002395] selection:text-white overflow-hidden">
      
      {/* --- MASSIVE WATERMARK BACKGROUND --- */}
      <motion.div 
        style={{ y: bgParallax, fontFamily: "'Cormorant', serif" }} 
        className="absolute top-[10%] left-[-5%] text-[18vw] leading-none font-bold text-stone-200/50 pointer-events-none z-0 select-none uppercase tracking-tighter hidden md:block"
        aria-hidden="true"
      >
        Ars Vocalis
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 md:px-0 relative z-10">

        {/* ========================================== */}
        {/* ARCHITECTURAL GRID CONNECTION (THE THREAD) */}
        {/* ========================================== */}

        {/* 1. Horizontal Bridge (Connects 41.6% column to 58.3% column) */}
        <div className="hidden md:block absolute -top-9 left-[41.666667%] w-[16.666667%] h-[2px] bg-stone-200/50 z-0" aria-hidden="true">
          <motion.div 
            style={{ scaleX: horizontalProgress }} 
            className="w-full h-full bg-[#002395] origin-left opacity-50" 
          />
        </div>

        {/* 2. Vertical Drop (Desktop only) */}
        <div className="absolute -top-9 bottom-0 left-[58.333333%] w-[2px] bg-stone-200/50 hidden md:block z-0" aria-hidden="true">
          <motion.div 
            style={{ scaleY: verticalProgress }} 
            className="w-full h-full bg-[#002395] origin-top opacity-50" 
          />
        </div>

        {/* ========================================== */}

        {/* --- BLOCK 1: THE MANIFESTO --- */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} className="flex flex-col md:flex-row-reverse mb-24 md:mb-40 relative mt-16 md:mt-24">
          
          {/* Right Column: Section Header */}
          <div className="md:w-5/12 relative md:pl-12 lg:pl-16 mb-12 md:mb-0">
            <div className="md:sticky md:top-48 z-10 w-full text-left">
              <FadeBlurIn>
                <p className="text-[#002395] text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] mb-4">IV. Muzyka</p>
              </FadeBlurIn>
              <MaskReveal delay={0.1} className="w-full md:w-max md:max-w-none">
                <motion.div initial="initial" whileHover="hover" className="flex flex-col w-max">
                  <ElegantHeading text="Nasza dusza" className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[0.95] inline-block" />
                </motion.div>
              </MaskReveal>
            </div>
          </div>
          
          {/* Left Column: Musical Poetry */}
          <motion.div style={{ y: yParallaxFast, willChange: "transform" }} className="md:w-7/12 flex flex-col justify-center relative z-0 md:pr-16 lg:pr-24 md:pt-12">
            
            <FadeBlurIn delay={0.2}>
              <p className="text-base text-stone-500 font-light leading-relaxed max-w-lg mb-12">
                Nade wszystko, dzielimy się. Dzielimy się naszym śpiewem, przemyślanymi narracjami muzycznymi utkanymi z utworów, w których muzyka i słowo są odbiciem lustrzanym samych siebie.
              </p>
            </FadeBlurIn>

            {/* Giant Typographic Manifesto */}
            <FadeBlurIn delay={0.3}>
              <h3 className="text-3xl sm:text-4xl md:text-6xl lg:text-[5rem] leading-[1.1] font-medium text-stone-800 mb-12" style={{ fontFamily: "'Cormorant', serif" }}>
                Ubóstwiamy<br/>
                <span className="italic text-[#002395]">heterofonię</span>,<br/>
                politonalność<br/>
                <span className="text-stone-400">&</span> <span className="italic text-[#002395]">polifonię.</span>
              </h3>
            </FadeBlurIn>

            <FadeBlurIn delay={0.4}>
              <p className="text-base text-stone-500 font-light leading-relaxed max-w-lg mb-6">
                Nie czulibyśmy się sobą, śpiewając muzykę, która nie obejmowałaby całego człowieka, dotykała jego głębi i próbowała urzec go pięknem mimo jego złożoności i kruchości. Interesuje nas świat. Świat widzialny, przyroda, całe stworzenie, jak i świat niematerialny, który odczuwamy.
              </p>
              <p className="text-base text-stone-500 font-light leading-relaxed max-w-lg">
                Muzyka sakralna czerpie z geniuszu ludzkiego i mądrości przodków. Do tej przestrzeni zapraszamy naszych słuchaczy.
              </p>
            </FadeBlurIn>

          </motion.div>
        </motion.div>

        {/* --- BLOCK 2: THE INTERACTIVE ARCHIVE (ROSTER) --- */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} className="flex flex-col md:flex-row-reverse relative">
          
          {/* Right Column: Repertoire Title */}
          <div className="md:w-5/12 relative md:pl-12 lg:pl-16 mb-12 md:mb-0">
            <div className="md:sticky md:top-48 z-10 w-full text-left">
              <FadeBlurIn>
                <p className="text-[#002395] text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] mb-4">V. Katalog Dźwięku</p>
              </FadeBlurIn>
              <MaskReveal delay={0.1} className="w-full md:w-max md:max-w-none">
                <motion.div initial="initial" whileHover="hover" className="flex flex-col w-max">
                  <ElegantHeading text="Repertuar" className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[0.95] inline-block" />
                </motion.div>
              </MaskReveal>
            </div>
          </div>
          
          {/* Left Column: Scrollable Repertoire List */}
          <motion.div className="md:w-7/12 md:pb-15 flex flex-col justify-center relative z-0 md:pr-16 lg:pr-24 w-full">
            <FadeBlurIn delay={0.2} className="w-full relative">
              
              {/* Scrollable Container (Dynamic height based on mobile state) */}
              <div 
                id="repertoire-container"
                data-lenis-prevent="true"
                className={`w-full pr-0 group md:scrollbar-hide relative z-20 md:h-[70vh] md:overflow-y-auto transition-all duration-700 ease-[0.16,1,0.3,1] ${
                  isExpanded ? 'h-auto overflow-visible' : 'h-[60vh] overflow-hidden'
                }`}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                
                <div className="pt-8 md:pt-16 pb-8 border-b-2 border-stone-800 mb-8">
                  <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-stone-400">Kompozytorzy (A-Z)</p>
                </div>

                {composers.map((item, idx) => (
                  <RosterItem key={idx} composer={item.name} piece={item.piece} />
                ))}

                <div className="pt-16 pb-8 border-b-2 border-stone-800 mb-8">
                  <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-stone-400">Kompozycje Anonimowe & Tradycyjne</p>
                </div>

                {traditional.map((item, idx) => (
                  <RosterItem key={`trad-${idx}`} composer={item.name} piece={item.piece} />
                ))}
                
                {/* --- Mobile: Collapse Button (Visible only at the bottom when expanded) --- */}
                {isExpanded && (
                  <div className="md:hidden flex justify-center mt-12 mb-8">
                    <button 
                      onClick={() => {
                        setIsExpanded(false);
                        document.getElementById('repertoire-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="group flex items-center justify-center gap-3 px-6 py-3 border border-stone-300 rounded-full text-[9px] uppercase tracking-[0.2em] font-bold text-stone-500 hover:border-[#002395] hover:text-[#002395] transition-all duration-500 active:scale-95"
                    >
                      Zwiń repertuar
                    </button>
                  </div>
                )}

                {/* Desktop bottom buffer */}
                <div className="h-10 md:h-20" />
              </div>

              {/* --- Mobile: Expand Button & Fade Overlay --- */}
              {!isExpanded && (
                <div className="md:hidden absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#fdfbf7] via-[#fdfbf7]/90 to-transparent z-30 flex items-end justify-center pb-2">
                  <button 
                    onClick={() => setIsExpanded(true)}
                    className="group flex items-center justify-center gap-3 px-6 py-3 border border-[#002395] rounded-full text-[9px] uppercase tracking-[0.2em] font-bold text-[#002395] hover:bg-[#002395] hover:text-white transition-all duration-500 active:scale-95"
                  >
                    Rozwiń pełny repertuar
                  </button>
                </div>
              )}

              {/* --- Desktop: Luxury Masking Gradients --- */}
              <div className="hidden md:block absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#fdfbf7] to-transparent pointer-events-none z-30" />
              <div className="hidden md:block absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#fdfbf7] to-transparent pointer-events-none z-30" />

            </FadeBlurIn>
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}