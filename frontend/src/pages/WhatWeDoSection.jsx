/**
 * @file WhatWeDoSection.jsx
 * @description Editorial-style exhibition of the ensemble's activities, collaborations, and sacred spaces.
 * Uses asymmetric sticky scrolling and sophisticated typography.
 * @author Krystian Bugalski
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

// --- KOMPONENTY POMOCNICZE ---

// Komponent dla precyzyjnie sformatowanych współprac (Wygląd obsady teatralnej)
const CollabItem = ({ role, name, description }) => (
  <div className="border-t border-[#002395]/10 py-6 md:py-8 flex flex-col md:flex-row md:items-baseline gap-2 md:gap-8 group">
    <div className="md:w-1/3 text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 group-hover:text-[#002395] transition-colors duration-500">
      {role}
    </div>
    <div className="md:w-2/3">
      <div className="text-xl md:text-3xl text-stone-900 mb-2" style={{ fontFamily: "'Cormorant', serif" }}>
        {name}
      </div>
      {description && <div className="text-sm text-stone-500 font-light leading-relaxed">{description}</div>}
    </div>
  </div>
);

// Pływający obrazek z delikatną paralaksą (zamiast wielkiego tła)
const FloatingImage = ({ src, alt, offset = "0" }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);

  return (
    <div ref={ref} className={`relative w-full aspect-[4/5] md:aspect-square overflow-hidden bg-stone-200 ${offset}`}>
      <motion.img 
        style={{ y }}
        src={src} 
        alt={alt} 
        className="absolute inset-[-15%] w-[130%] h-[130%] object-cover grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all duration-1000 ease-out"
      />
    </div>
  );
};

// --- GŁÓWNY KOMPONENT ---

export default function WhatWeDoSection() {
  return (
    <section className="relative bg-[#fdfbf7] text-stone-900 py-24 md:py-48 selection:bg-[#002395] selection:text-white">
      
      <div className="max-w-7xl mx-auto px-6 md:px-12">

        {/* --- BLOK 1: Concerts Spirituels --- */}
        <div className="flex flex-col md:flex-row gap-12 md:gap-24 mb-32 md:mb-64">
          <div className="md:w-5/12 relative">
            <div className="sticky top-48">
              <p className="text-[#002395] text-[10px] font-bold uppercase tracking-[0.3em] mb-6">I. Działalność</p>
              <h2 className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight mb-8" style={{ fontFamily: "'Cormorant', serif" }}>
                Concerts<br/>Spirituels
              </h2>
            </div>
          </div>
          
          <div className="md:w-7/12 flex flex-col gap-12 md:gap-24 pt-4 md:pt-24">
            <p className="text-lg md:text-2xl text-stone-600 leading-relaxed" style={{ fontFamily: "'Cormorant', serif" }}>
              Przywracamy tradycję dawnych <span className="text-[#002395] italic">Concerts Spirituels</span>. 
              Tworzymy pomost między historyczną świadomością a potrzebami współczesnego słuchacza. Nie gramy zwykłych koncertów – tworzymy autentyczne przestrzenie sacrum.
            </p>
            <p className="text-base text-stone-500 font-light leading-loose">
              Nasza działalność obejmuje nie tylko autorskie Koncerty Duchowe, ale również starannie przygotowane oprawy liturgiczne, msze ślubne oraz uświetnianie najważniejszych uroczystości kościelnych. Jesteśmy tam, gdzie muzyka musi stać się modlitwą.
            </p>
            
            {/* Tutaj możesz użyć swojego zdjęcia z chórem */}
            <FloatingImage src="/wystep.jpg" alt="VoctEnsemble podczas występu" />
          </div>
        </div>

        {/* --- BLOK 2: Współprace i Synergie --- */}
        <div className="flex flex-col md:flex-row gap-12 md:gap-24 mb-32 md:mb-64">
          <div className="md:w-5/12 relative">
            <div className="sticky top-48">
              <p className="text-[#002395] text-[10px] font-bold uppercase tracking-[0.3em] mb-6">II. Interdyscyplinarność</p>
              <h2 className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight mb-8" style={{ fontFamily: "'Cormorant', serif" }}>
                Synergie<br/>i Wirtuozeria
              </h2>
            </div>
          </div>
          
          <div className="md:w-7/12 flex flex-col pt-4 md:pt-24">
            <p className="text-lg md:text-2xl text-stone-600 leading-relaxed mb-16" style={{ fontFamily: "'Cormorant', serif" }}>
              Nasze koncerty to nowoczesne misteria. Aby dźwięk mógł w pełni rezonować z przestrzenią, zapraszamy do współpracy wybitnych mistrzów formy, światła i instrumentu.
            </p>

            <div className="flex flex-col">
              <CollabItem 
                role="Muzyka" 
                name="Radu Ropotan" 
                description="Wybitny skrzypek rumuński. Nasza synergia zaowocowała m.in. wspólnym projektem 'Wołanie Gór' w Szczawnicy." 
              />
              <CollabItem 
                role="Reżyseria Dźwięku" 
                name="Jakub Garbacz" 
                description="Ars Sonora Studio. Perfekcja w ujęciu akustyki sakralnej." 
              />
              <CollabItem 
                role="Reżyseria Świateł" 
                name="Ada Bystrzycka" 
                description="Multiscena. Budowanie architektury nastroju poprzez światło." 
              />
              <CollabItem 
                role="Kreacja Wizualna" 
                name="Sebastian Kuźma" 
                description="ART Agencja Rzemieślników Teatralnych." 
              />
              <CollabItem 
                role="Partnerzy" 
                name="Instytucje Kultury" 
                description="Współpracujemy z Łódzką fundacją Carpe Diem oraz Ośrodkiem Kultury Norwida w krakowskich Mistrzejowicach." 
              />
            </div>
          </div>
        </div>

        {/* --- BLOK 3: Przestrzenie Sacrum --- */}
        <div className="flex flex-col md:flex-row gap-12 md:gap-24">
          <div className="md:w-5/12 relative">
            <div className="sticky top-48">
              <p className="text-[#002395] text-[10px] font-bold uppercase tracking-[0.3em] mb-6">III. Miejsca i Wydarzenia</p>
              <h2 className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight mb-8" style={{ fontFamily: "'Cormorant', serif" }}>
                Przestrzenie<br/>Sacrum
              </h2>
            </div>
          </div>
          
          <div className="md:w-7/12 flex flex-col gap-12 md:gap-24 pt-4 md:pt-24">
            <div className="border-l border-[#002395] pl-6 md:pl-10">
              <p className="text-xl md:text-3xl text-stone-900 mb-6 leading-snug" style={{ fontFamily: "'Cormorant', serif" }}>
                Wzbogaciliśmy liturgię podczas obchodów 28. Dnia Judaizmu w Kościele katolickim pod przewodnictwem bp Roberta Chrząszcza.
              </p>
              <p className="text-stone-500 font-light text-sm md:text-base">
                Dopełnieniem tego wydarzenia był nasz występ w krakowskiej Synagodze Tempel w ramach wspomnienia o Błogosławionej Pamięci Tadeuszu Jakubowiczu.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
              <div>
                <h4 className="text-stone-900 font-bold mb-3 uppercase text-[11px] tracking-widest">Stolica Apostolska</h4>
                <p className="text-stone-500 text-sm font-light leading-relaxed">
                  W najbliższym czasie uświetnimy liturgię w Sanktuarium św. Andrzeja Boboli w obecności o. Generała jezuitów, o. Artura Sosy-Abascala SJ, świętując 100-lecie prowincji północnej jezuitów polskich.
                </p>
              </div>
              <div>
                <h4 className="text-stone-900 font-bold mb-3 uppercase text-[11px] tracking-widest">Oprawy Uroczystości</h4>
                <p className="text-stone-500 text-sm font-light leading-relaxed">
                  Jesteśmy dyspozycyjni dla najważniejszych celebracji. Mieliśmy zaszczyt oprawiać liturgie ślubne w tak monumentalnych przestrzeniach jak Kolegiata św. Anny w Krakowie czy historyczne Opactwo Benedyktynów w Tyńcu.
                </p>
              </div>
            </div>
            
            <div className="mt-12 text-center md:text-left">
              <a href="/kontakt" className="inline-block border border-[#002395]/30 text-[#002395] px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-[#002395] hover:text-white transition-colors duration-500">
                Skontaktuj się z nami
              </a>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}