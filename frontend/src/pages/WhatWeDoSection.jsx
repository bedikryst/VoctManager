/**
 * @file WhatWeDoSection.jsx
 * @description Editorial exhibition with a mathematically precise architectural grid.
 * Refactored: Smooth drag slider, optimized spacing, and accessibility improvements.
 * @author Krystian Bugalski & Gemini
 */

import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useMotionValue } from 'framer-motion';

// --- WARIANTY ANIMACJI ---

const blurVariants = {
  hidden: { opacity: 0, y: 40, filter: "blur(12px)" },
  visible: (delay) => ({
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 1.2, delay: delay, ease: [0.16, 1, 0.3, 1] }
  })
};

const maskVariants = {
  hidden: { y: "100%", rotate: 2, opacity: 0 },
  visible: (delay) => ({
    y: "0%", rotate: 0, opacity: 1,
    transition: { duration: 1.2, delay: delay, ease: [0.16, 1, 0.3, 1] }
  })
};

const lineVariants = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 1.2, ease: [0.76, 0, 0.24, 1] } }
};

const dotVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { delay: 0.8, duration: 0.5, ease: "backOut" } }
};

// --- KOMPONENTY POMOCNICZE ---

const FadeBlurIn = ({ children, delay = 0, className = "" }) => (
  <motion.div variants={blurVariants} custom={delay} className={className}>
    {children}
  </motion.div>
);

const MaskReveal = ({ children, delay = 0, className = "" }) => (
  <div className={`overflow-hidden pt-10 pb-12 -mt-10 -mb-12 px-2 -mx-2 ${className}`}>
    <motion.div variants={maskVariants} custom={delay}>
      {children}
    </motion.div>
  </div>
);

const CollabItem = ({ role, name, description }) => (
  <motion.div 
    whileHover={{ x: 10 }}
    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    className="flex-shrink-0 w-[80vw] md:w-[400px] border-t border-[#002395]/10 py-6 md:py-8 flex flex-col md:flex-row md:items-baseline gap-2 md:gap-8 group relative z-10 cursor-grab active:cursor-grabbing"
  >
    <div className="md:w-1/3 text-[10px] uppercase tracking-[0.25em] font-bold text-[#002395] md:text-stone-400 group-hover:text-[#002395] transition-colors duration-500">
      {role}
    </div>
    <div className="md:w-2/3 relative">
      <div className="text-2xl md:text-3xl text-stone-900 mb-2 transition-colors duration-500 select-none" style={{ fontFamily: "'Cormorant', serif" }}>
        {name}
      </div>
      {description && (
        <div className="text-sm text-stone-500 font-light leading-relaxed whitespace-normal pr-4 select-none">
          {description}
        </div>
      )}
      <div className="hidden md:block absolute -left-8 top-2 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 text-[#002395]" aria-hidden="true">
        →
      </div>
    </div>
  </motion.div>
);

const collaborators = [
  { role: "Muzyka", name: "Radu Ropotan", desc: "Wybitny skrzypek rumuński. Nasza synergia zaowocowała m.in. wspólnym projektem 'Wołanie Gór' w Szczawnicy." },
  { role: "Reżyseria Dźwięku", name: "Jakub Garbacz", desc: "Ars Sonora Studio. Perfekcja w ujęciu akustyki sakralnej." },
  { role: "Reżyseria Świateł", name: "Ada Bystrzycka", desc: "Multiscena. Budowanie architektury nastroju poprzez światło." },
  { role: "Kreacja Wizualna", name: "Sebastian Kuźma", desc: "ART Agencja Rzemieślników Teatralnych." },
  { role: "Partnerzy", name: "Instytucje Kultury", desc: "Współpracujemy z Łódzką fundacją Carpe Diem oraz Ośrodkiem Kultury Norwida." }
];

// --- GŁÓWNY KOMPONENT ---

export default function WhatWeDoSection() {
  const sectionRef = useRef(null);
  
  // Paralaksa i Oś Pionowa
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const yParallaxFast = useTransform(scrollYProgress, [0, 1], [60, -60]); // Zmniejszona siła paralaksy
  const yParallaxSlow = useTransform(scrollYProgress, [0, 1], [30, -30]);
  const lineProgress = useTransform(scrollYProgress, [0.2, 0.9], [0, 1]);

  // Logika Drag Slidera
  const sliderRef = useRef(null);
  const [sliderWidth, setSliderWidth] = useState(0);
  const x = useMotionValue(0);

  // Dynamicznie obliczany pasek postępu (Mobile) na podstawie przeciągnięcia
  const progressWidth = useTransform(x, [0, -sliderWidth || -1000], ["0%", "100%"]);

  useEffect(() => {
    const measureSlider = () => {
      if (sliderRef.current) {
        setSliderWidth(sliderRef.current.scrollWidth - sliderRef.current.offsetWidth);
      }
    };
    measureSlider();
    window.addEventListener("resize", measureSlider);
    return () => window.removeEventListener("resize", measureSlider);
  }, []);

  return (
    <section ref={sectionRef} className="relative bg-[#fdfbf7] text-stone-900 pb-20 selection:bg-[#002395] selection:text-white overflow-hidden">
      
      <div className="max-w-7xl mx-auto px-6 md:px-0 relative z-10">

        {/* --- ARCHITEKTONICZNA SIATKA --- */}
        <motion.div 
          initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
          className="absolute top-0 right-1/2 w-[60%] md:w-[8.333333%] h-px bg-[#002395]/40 origin-right z-0" aria-hidden="true"
        />

        <div className="absolute top-0 bottom-0 left-[41.666667%] w-px bg-stone-200 hidden md:block z-0" aria-hidden="true">
          <motion.div style={{ scaleY: lineProgress }} className="w-full h-full bg-[#002395]/40 origin-top shadow-[0_0_15px_rgba(0,35,149,0.2)]" />
        </div>

        {/* --- BLOK 1: Concerts Spirituels --- */}
        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}
          className="flex flex-col md:flex-row min-h-[50vh] mb-24 md:mb-0 relative pb-8 md:pb-0"
        >
          <div className="md:w-5/12 relative md:pr-12 lg:pr-8">
            <div className="md:sticky md:top-48 z-10 w-full pt-8 md:pt-0">
              
              <div className="hidden md:flex absolute top-6 md:-right-12 lg:-right-8 w-[12vw] lg:w-[15vw] h-px items-center justify-start z-0" aria-hidden="true">
                <motion.div variants={lineVariants} className="w-full h-full bg-[#002395]/30 origin-right" />
                <motion.div variants={dotVariants} className="absolute left-0 w-2 h-2 rounded-full bg-[#002395] shadow-[0_0_12px_rgba(0,35,149,0.5)]" />
              </div>

              <div className="md:pl-[4vw] lg:pl-[1vw] xl:pl-0 md:pt-14 relative z-10 text-left">
                <FadeBlurIn>
                  <p className="text-[#002395] text-[10px] font-bold uppercase tracking-[0.3em] mb-4">I. Działalność</p>
                </FadeBlurIn>
                <MaskReveal delay={0.1}>
                  <h2 className="text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[0.95]" style={{ fontFamily: "'Cormorant', serif" }}>
                    Concerts<br/>Spirituels
                  </h2>
                </MaskReveal>
              </div>
            </div>
          </div>
          
          {/* Zmienione paddingi: py-24 na desktop, mt-6 na mobile */}
          <motion.div style={{ y: yParallaxFast }} className="md:w-7/12 flex flex-col justify-center relative z-0 md:pl-16 lg:pl-28 md:py-50 mt-6 md:mt-0">
            <FadeBlurIn delay={0.2}>
              <p className="text-2xl md:text-4xl text-stone-800 leading-snug mb-8" style={{ fontFamily: "'Cormorant', serif" }}>
                Przywracamy tradycję dawnych <span className="text-[#002395] italic">Concerts Spirituels</span>. 
                Tworzymy pomost między historyczną świadomością a potrzebami współczesnego słuchacza.
              </p>
            </FadeBlurIn>

            <FadeBlurIn delay={0.3}>
              <p className="text-base text-stone-500 font-light leading-relaxed max-w-lg">
                Nasza działalność obejmuje nie tylko autorskie Koncerty Duchowe, ale również starannie przygotowane oprawy liturgiczne, msze ślubne oraz uświetnianie najważniejszych uroczystości kościelnych. Jesteśmy tam, gdzie muzyka musi stać się modlitwą.
              </p>
            </FadeBlurIn>
          </motion.div>
        </motion.div>

        {/* --- BLOK 2: Współprace --- */}
        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}
          className="flex flex-col md:flex-row min-h-[50vh] mb-24 md:mb-0 relative pb-8 md:pb-0"
        >
          <div className="md:w-5/12 relative md:pr-12 lg:pr-8">
            <div className="md:sticky md:top-48 z-10 w-full pt-8 md:pt-0">
              <div className="hidden md:flex absolute top-6 md:-right-12 lg:-right-8 w-[12vw] lg:w-[15vw] h-px items-center justify-start z-0" aria-hidden="true">
                <motion.div variants={lineVariants} className="w-full h-full bg-[#002395]/30 origin-right" />
                <motion.div variants={dotVariants} className="absolute left-0 w-2 h-2 rounded-full bg-[#002395] shadow-[0_0_12px_rgba(0,35,149,0.5)]" />
              </div>

              <div className="md:pl-[4vw] lg:pl-[1vw] xl:pl-0 md:pt-14 relative z-10 text-left">
                <FadeBlurIn>
                  <p className="text-[#002395] text-[10px] font-bold uppercase tracking-[0.3em] mb-4">II. Interdyscyplinarność</p>
                </FadeBlurIn>
                <MaskReveal delay={0.1}>
                  <h2 className="text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[0.95]" style={{ fontFamily: "'Cormorant', serif" }}>
                    Synergie<br/><span className="italic">&</span>Wirtuozeria
                  </h2>
                </MaskReveal>
              </div>
            </div>
          </div>
          
          <motion.div style={{ y: yParallaxSlow }} className="md:w-7/12 flex flex-col justify-center relative z-0 md:pl-16 lg:pl-28 md:py-24 mt-6 md:mt-0">
            <FadeBlurIn delay={0.2}>
              <p className="text-2xl md:text-4xl text-stone-800 leading-snug mb-12" style={{ fontFamily: "'Cormorant', serif" }}>
                Nasze koncerty to nowoczesne misteria. Aby dźwięk mógł w pełni rezonować z przestrzenią, zapraszamy do współpracy wybitnych mistrzów formy, światła i instrumentu.
              </p>
            </FadeBlurIn>

            {/* DRAG SLIDER Z FIZYKĄ */}
            <div className="w-full relative">
              <FadeBlurIn delay={0.3}>
                <div ref={sliderRef} className="overflow-hidden cursor-grab active:cursor-grabbing pb-2 -mx-6 px-6 md:mx-0 md:px-0">
                  <motion.div 
                    drag="x" 
                    dragConstraints={{ right: 0, left: -sliderWidth }} 
                    style={{ x }} 
                    className="flex gap-6 md:gap-12"
                  >
                    {collaborators.map((item, idx) => (
                      <CollabItem key={idx} role={item.role} name={item.name} description={item.desc} />
                    ))}
                  </motion.div>
                </div>
              </FadeBlurIn>
              
              {/* Płynny pasek postępu (Progress Bar) zamiast kropek na Mobile */}
              <div className="md:hidden mt-6 h-1 w-full bg-[#002395]/10 rounded-full overflow-hidden">
                <motion.div style={{ width: progressWidth }} className="h-full bg-[#002395] rounded-full" />
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* --- BLOK 3: Przestrzenie Sacrum --- */}
        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}
          className="flex flex-col md:flex-row min-h-[50vh] pb-8 md:pb-0"
        >
          <div className="md:w-5/12 relative md:pr-12 lg:pr-8">
            <div className="md:sticky md:top-48 z-10 w-full pt-8 md:pt-0">
              <div className="hidden md:flex absolute top-6 md:-right-12 lg:-right-8 w-[12vw] lg:w-[15vw] h-px items-center justify-start z-0" aria-hidden="true">
                <motion.div variants={lineVariants} className="w-full h-full bg-[#002395]/30 origin-right"/>
                <motion.div variants={dotVariants} className="absolute left-0 w-2 h-2 rounded-full bg-[#002395] shadow-[0_0_12px_rgba(0,35,149,0.5)]" />
              </div>

              <div className="md:pl-[4vw] lg:pl-[1vw] xl:pl-0 md:pt-14 relative z-10 text-left">
                <FadeBlurIn>
                  <p className="text-[#002395] text-[10px] font-bold uppercase tracking-[0.3em] mb-4">III. Wydarzenia</p>
                </FadeBlurIn>
                <MaskReveal delay={0.1}>
                  <h2 className="text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[0.95]" style={{ fontFamily: "'Cormorant', serif" }}>
                    Przestrzenie<br/>Sacrum
                  </h2>
                </MaskReveal>
              </div>
            </div>
          </div>
          
          <motion.div style={{ y: yParallaxFast }} className="md:w-7/12 flex flex-col justify-center gap-12 relative z-0 md:pl-16 lg:pl-28 md:py-24 mt-6 md:mt-0">
            <FadeBlurIn delay={0.2}>
              <div className="relative pl-8 md:pl-0 py-4">
                <motion.div 
                  variants={{ hidden: { scaleY: 0 }, visible: { scaleY: 1, transition: { duration: 1, ease: [0.76, 0, 0.24, 1] } } }}
                  className="absolute left-0 top-0 bottom-0 w-px bg-[#002395] origin-top md:hidden" aria-hidden="true"
                />
                <p className="text-2xl md:text-4xl text-stone-800 mb-6 leading-snug" style={{ fontFamily: "'Cormorant', serif" }}>
                  Wzbogaciliśmy liturgię podczas obchodów 28. Dnia Judaizmu w Kościele katolickim pod przewodnictwem bp Roberta Chrząszcza.
                </p>
                <p className="text-stone-500 font-light text-base max-w-lg leading-relaxed">
                  Dopełnieniem tego wydarzenia był nasz występ w krakowskiej Synagodze Tempel w ramach wspomnienia o Błogosławionej Pamięci Tadeuszu Jakubowiczu.
                </p>
              </div>
            </FadeBlurIn>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 pb-10 md:pb-0">
              <FadeBlurIn delay={0.3}>
                <h4 className="text-[#002395] font-bold mb-4 uppercase text-[10px] tracking-[0.2em]">Stolica Apostolska</h4>
                <p className="text-stone-600 text-sm font-light leading-relaxed">
                  W najbliższym czasie uświetnimy liturgię w Sanktuarium św. Andrzeja Boboli w obecności o. Generała jezuitów, o. Artura Sosy-Abascala SJ.
                </p>
              </FadeBlurIn>
              <FadeBlurIn delay={0.4}>
                <h4 className="text-[#002395] font-bold mb-4 uppercase text-[10px] tracking-[0.2em]">Oprawy Uroczystości</h4>
                <p className="text-stone-600 text-sm font-light leading-relaxed">
                  Mieliśmy zaszczyt oprawiać liturgie ślubne w tak monumentalnych przestrzeniach jak Kolegiata św. Anny w Krakowie czy historyczne Opactwo Benedyktynów w Tyńcu.
                </p>
              </FadeBlurIn>
            </div>
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}