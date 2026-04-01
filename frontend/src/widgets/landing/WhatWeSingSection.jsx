/**
 * @file WhatWeSingSection.jsx
 * @description The Repertoire Archive (What We Sing).
 * Flipped layout (Content Left, Titles Right) to break visual monotony.
 * Includes a continuous architectural thread connecting from the previous section,
 * drawing horizontally before descending vertically.
 * Features an interactive, scrollable roster with integrated audio sample playback
 * and local scroll-linked typography (Scrollytelling).
 * @author Krystian Bugalski
 */

import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useCursor } from '../../app/providers/CursorProvider';
import ElegantHeading from '../../shared/ui/ElegantHeading';

// ==========================================
// DATA MODELS
// ==========================================

const composers = [
  { name: "Gregorio Allegri", piece: "Miserere mei, Deus", audioSrc: "/samples/Gregorio_Allegri_Miserere.mp3" },
  { name: "Johann Sebastian Bach", piece: "Singet dem Herrn ein neues Lied, BWV 225", audioSrc: "/samples/Bach_Singet.mp3" },
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
  { name: "Salve Regina", piece: "Tradycyjna melodia z Oksytanii", audioSrc: "/samples/salve-regina.mp3" },
  { name: "Tantum ergo sacramentum", piece: "XVII w. / polifonia korsykańska" }
];

// ==========================================
// COMPONENTS
// ==========================================

/**
 * @component RosterItem
 * @description Individual item in the repertoire list, supporting audio playback.
 */
const RosterItem = ({ index, composer, piece, audioSrc, isPlaying, onTogglePlay }) => {
  const hasAudio = Boolean(audioSrc);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      onClick={() => hasAudio && onTogglePlay()}
      className={`group flex flex-col md:flex-row md:items-baseline justify-between py-5 md:py-6 border-b border-stone-800/10 transition-all duration-500 
        ${hasAudio ? 'cursor-pointer' : ''} 
        ${isPlaying ? 'opacity-100 border-[#002395]' : 'md:hover:!opacity-100 md:hover:border-stone-800/40 md:opacity-100'}
      `}
    >
      <div className="flex items-baseline gap-4 md:gap-6">
        <span className={`text-[9px] font-bold tracking-[0.2em] transition-colors duration-500 ${isPlaying ? 'text-[#002395]' : 'text-stone-400 group-hover:text-[#002395]'}`}>
          {String(index).padStart(2, '0')}
        </span>
        <h4 className={`text-xl md:text-3xl lg:text-4xl transition-colors duration-500 ${isPlaying ? 'text-[#002395]' : 'text-stone-800 group-hover:text-[#002395]'}`} style={{ fontFamily: "'Cormorant', serif" }}>
          {composer}
        </h4>
      </div>
      
      <div className="flex flex-col md:items-end mt-2 md:mt-0">
        <p className={`text-xs md:text-sm font-light tracking-wide text-left md:text-right transition-colors duration-500 md:max-w-[80%] ${isPlaying ? 'text-stone-900' : 'text-stone-400 group-hover:text-stone-600'}`}>
          {piece}
        </p>
        
        {hasAudio && (
          <div className="mt-2 md:mt-3 flex items-center gap-2 overflow-hidden h-4">
            <motion.div 
              initial={false}
              animate={{ opacity: isPlaying ? 1 : 0, y: isPlaying ? 0 : 10 }}
              className="flex items-center gap-2"
            >
              <div className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#002395] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#002395]" />
              </div>
              <span className="text-[8px] uppercase tracking-[0.2em] font-bold text-[#002395]">Odtwarzanie</span>
            </motion.div>

            {!isPlaying && (
              <motion.span 
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                className="text-[8px] uppercase tracking-[0.2em] font-bold text-stone-300 group-hover:text-[#002395] transition-colors duration-500"
              >
                [ Odsłuchaj ]
              </motion.span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default function WhatWeSingSection() {
  // ==========================================
  // STATE & REFS
  // ==========================================
  
  const sectionRef = useRef(null);
  const block1Ref = useRef(null);
  const block2Ref = useRef(null);
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const [activeAudio, setActiveAudio] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  // ==========================================
  // EFFECTS
  // ==========================================

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize(); 
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    return () => {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.src = "";
      }
    };
  }, [activeAudio]);

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleTogglePlay = (id, src) => {
    if (playingId === id) {
      activeAudio.pause();
      setPlayingId(null);
      return;
    }
    if (activeAudio) {
      activeAudio.pause();
    }
    const newAudio = new Audio(src);
    newAudio.play();
    newAudio.onended = () => setPlayingId(null);
    
    setActiveAudio(newAudio);
    setPlayingId(id);
  };

  // ==========================================
  // SCROLL KINEMATICS
  // ==========================================
  
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  
  const yParallaxFast = useTransform(scrollYProgress, [0, 1], [30, -290]);
  const yParallaxSlow = useTransform(scrollYProgress, [0, 1], [30, -70]); 
  const bgParallax = useTransform(scrollYProgress, [0, 1], [100, -200]);

  // Global Grid Connections
  const horizontalProgress = useTransform(scrollYProgress, [0.245, 0.27], [0, 1]);
  const verticalProgress = useTransform(scrollYProgress, [0.27, 0.8], [0, 1]);

  // Mirrored Branches
  const branch1Progress = useTransform(scrollYProgress, [0.32, 0.36], [0, 1]);
  const branch2Progress = useTransform(scrollYProgress, [0.588, 0.63], [0, 1]);
  const dot1Opacity = useTransform(scrollYProgress, [0.36, 0.38], [0, 1]);
  const dot2Opacity = useTransform(scrollYProgress, [0.63, 0.65], [0, 1]);

  // Local Scrollytelling (Philosophy)
  const { scrollYProgress: scroll1 } = useScroll({ target: block1Ref, offset: ["start 80%", "end 30%"] });
  const block1Opacity = useTransform(scroll1, [0, 0.3, 0.8, 1], [0, 1, 1, 0]);
  const block1Y = useTransform(scroll1, [0, 0.3, 0.8, 1], [40, 0, 0, -40]);
  const block1Blur = useTransform(scroll1, [0, 0.3, 0.8, 1], ["blur(12px)", "blur(0px)", "blur(0px)", "blur(12px)"]);

  // Local Scrollytelling (Repertoire Archive)
  const { scrollYProgress: scroll2 } = useScroll({ target: block2Ref, offset: ["start 80%", "end 30%"] });
  const block2Opacity = useTransform(scroll2, [0, 0.2, 0.9, 1], [0, 1, 1, 0]);
  const block2Y = useTransform(scroll2, [0, 0.2, 0.9, 1], [40, 0, 0, -40]);
  const block2Blur = useTransform(scroll2, [0, 0.2, 0.9, 1], ["blur(12px)", "blur(0px)", "blur(0px)", "blur(12px)"]);

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <section ref={sectionRef} className="relative bg-[#fdfbf7] text-stone-900 selection:bg-[#002395] selection:text-white overflow-hidden">
      
      <motion.div 
        style={{ y: bgParallax, fontFamily: "'Cormorant', serif" }} 
        className="absolute top-[10%] left-[-5%] text-[18vw] leading-none font-bold text-stone-200/50 pointer-events-none z-0 select-none uppercase tracking-tighter hidden md:block"
        aria-hidden="true"
      >
        Ars Vocalis
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 md:px-0 relative z-10">

        {/* Grid Lines */}
        <div className="hidden md:block absolute -top-9 left-[41.666667%] w-[16.666667%] h-[2px] bg-stone-200/50 z-0" aria-hidden="true">
          <motion.div style={{ scaleX: horizontalProgress }} className="w-full h-full bg-[#002395] origin-left opacity-50" />
        </div>
        <div className="absolute -top-9 bottom-0 left-[58.333333%] w-[2px] bg-stone-200/50 hidden md:block z-0" aria-hidden="true">
          <motion.div style={{ scaleY: verticalProgress }} className="w-full h-full bg-[#002395] origin-top opacity-50" />
        </div>

        {/* --- BLOCK 1: PHILOSOPHY --- */}
        <div ref={block1Ref} className="flex flex-col md:flex-row-reverse min-h-[60vh] mb-24 md:mb-40 relative mt-16 md:mt-24">
          
          <div className="md:w-5/12 relative md:pl-12 lg:pl-16 mb-12 md:mb-0">
            <div className="md:sticky md:top-48 z-10 w-full text-left">
              
              <div className="hidden md:flex absolute top-6 md:-left-12 lg:-left-16 w-[12vw] lg:w-[15vw] h-px items-center justify-start z-0" aria-hidden="true">
                <motion.div style={{ scaleX: branch1Progress }} className="w-full h-full bg-[#002395]/70 origin-left" />
                <motion.div style={{ opacity: dot1Opacity }} className="absolute right-0 w-2 h-2 rounded-full bg-[#002395] shadow-[0_0_12px_rgba(0,35,149,0.5)]" />
              </div>

              <motion.div style={{ opacity: block1Opacity, y: block1Y, filter: block1Blur, willChange: "transform, opacity, filter" }}>
                <p className="text-[#002395] text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] mb-4">IV. Filozofia</p>
                <div className="flex flex-col w-max">
                  <ElegantHeading text="Manifest" className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[0.95] inline-block" />
                  <ElegantHeading text="Brzmienia" className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[0.95] inline-block" />
                </div>
              </motion.div>

            </div>
          </div>
          
          <motion.div style={{ y: isMobile ? yParallaxSlow : yParallaxFast, willChange: "transform" }} className="md:w-7/12 flex flex-col justify-center relative z-0 md:pr-16 lg:pr-24 md:pt-12">
            <motion.div style={{ opacity: block1Opacity, y: block1Y, filter: block1Blur, willChange: "transform, opacity, filter" }}>
              
              <p className="text-xl md:text-2xl text-stone-600 leading-relaxed max-w-lg mb-12 italic" style={{ fontFamily: "'Cormorant', serif" }}>
                Nade wszystko, dzielimy się. Utkaliśmy przemyślaną narrację, w której muzyka i słowo są lustrzanym odbiciem samych siebie.
              </p>

              <h3 className="text-3xl sm:text-4xl md:text-6xl lg:text-[5rem] leading-[1.1] font-medium text-stone-800 mb-16" style={{ fontFamily: "'Cormorant', serif" }}>
                Ubóstwiamy<br/>
                <span className="italic text-[#002395]">heterofonię</span>,<br/>
                politonalność<br/>
                <span className="text-stone-400">&</span> <span className="italic text-[#002395]">polifonię.</span>
              </h3>

              <div className="relative pl-6 md:pl-8 border-l border-[#002395]/30">
                <p className="text-sm text-stone-500 font-light leading-relaxed max-w-md mb-6">
                  Nie czulibyśmy się sobą, śpiewając muzykę, która nie dotyka głębi człowieka i nie próbuje urzec go pięknem mimo jego kruchości.
                </p>
                <p className="text-sm text-stone-500 font-light leading-relaxed max-w-md font-medium">
                  Interesuje nas świat widzialny i niematerialny. Muzyka sakralna czerpie z mądrości przodków — i to do tej przestrzeni zapraszamy słuchaczy.
                </p>
              </div>

            </motion.div>
          </motion.div>
        </div>
        
        {/* --- BLOCK 2: ARCHIVE --- */}
        <div ref={block2Ref} className="flex flex-col md:flex-row-reverse relative">
          
          <div className="md:w-5/12 relative md:pl-12 lg:pl-16 mb-12 md:mb-0">
            <div className="md:sticky md:top-48 z-10 w-full text-left">
              
              <div className="hidden md:flex absolute top-6 md:-left-12 lg:-left-16 w-[12vw] lg:w-[15vw] h-px items-center justify-start z-0" aria-hidden="true">
                <motion.div style={{ scaleX: branch2Progress }} className="w-full h-full bg-[#002395]/70 origin-left" />
                <motion.div style={{ opacity: dot2Opacity }} className="absolute right-0 w-2 h-2 rounded-full bg-[#002395] shadow-[0_0_12px_rgba(0,35,149,0.5)]" />
              </div>

              <motion.div style={{ opacity: block2Opacity, y: block2Y, filter: block2Blur, willChange: "transform, opacity, filter" }}>
                <p className="text-[#002395] text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] mb-4">V. Katalog Dźwięku</p>
                <div className="flex flex-col w-max">
                  <ElegantHeading text="Partytury" className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[0.95] inline-block" />
                </div>
              </motion.div>
            </div>
          </div>
          
          <motion.div 
            style={{ opacity: block2Opacity, y: block2Y, filter: block2Blur, willChange: "transform, opacity, filter" }}
            className="md:w-7/12 md:pb-15 flex flex-col justify-center relative z-0 md:pr-16 lg:pr-24 w-full"
          >
            <div className="w-full relative">
              
              <div 
                id="repertoire-container"
                data-lenis-prevent="true"
                className={`w-full pr-0 md:scrollbar-hide relative z-20 md:h-[70vh] md:overflow-y-auto transition-all duration-700 ease-[0.16,1,0.3,1] ${
                  isExpanded ? 'h-auto overflow-visible' : 'h-[60vh] overflow-hidden'
                }`}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div className="pt-8 md:pt-16 pb-8 border-b border-stone-800 mb-8">
                  <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-stone-400">Indeks Kompozytorów (A-Z)</p>
                </div>

                {composers.map((item, idx) => {
                  const id = `comp-${idx}`;
                  return (
                    <RosterItem 
                      key={id} 
                      index={idx + 1} 
                      composer={item.name} 
                      piece={item.piece}
                      audioSrc={item.audioSrc}
                      isPlaying={playingId === id}
                      onTogglePlay={() => handleTogglePlay(id, item.audioSrc)}
                    />
                  );
                })}

                <div className="pt-16 pb-8 border-b border-stone-800 mb-8 mt-8">
                  <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-stone-400">Zbiory Historyczne & Tradycyjne</p>
                </div>

                {traditional.map((item, idx) => {
                  const id = `trad-${idx}`;
                  return (
                    <RosterItem 
                      key={id} 
                      index={composers.length + idx + 1} 
                      composer={item.name} 
                      piece={item.piece}
                      audioSrc={item.audioSrc}
                      isPlaying={playingId === id}
                      onTogglePlay={() => handleTogglePlay(id, item.audioSrc)}
                    />
                  );
                })}
                
                {isExpanded && (
                  <div className="md:hidden flex justify-center mt-12 mb-8">
                    <button 
                      onClick={() => {
                        setIsExpanded(false);
                        document.getElementById('repertoire-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="group flex items-center justify-center gap-3 px-6 py-3 border border-stone-300 rounded-full text-[9px] uppercase tracking-[0.2em] font-bold text-stone-500 hover:border-[#002395] hover:text-[#002395] transition-all duration-500 active:scale-95"
                    >
                      Zwiń archiwum
                    </button>
                  </div>
                )}

                <div className="h-10 md:h-20" />
              </div>

              {!isExpanded && (
                <div className="md:hidden absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#fdfbf7] via-[#fdfbf7]/90 to-transparent z-30 flex items-end justify-center pb-2">
                  <button 
                    onClick={() => setIsExpanded(true)}
                    className="group flex items-center justify-center gap-3 px-6 py-3 border border-[#002395] rounded-full text-[9px] uppercase tracking-[0.2em] font-bold text-[#002395] hover:bg-[#002395] hover:text-white transition-all duration-500 active:scale-95"
                  >
                    Eksploruj archiwum
                  </button>
                </div>
              )}

              <div className="hidden md:block absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#fdfbf7] to-transparent pointer-events-none z-30" />
              <div className="hidden md:block absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#fdfbf7] to-transparent pointer-events-none z-30" />

            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
}