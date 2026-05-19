/**
 * @file PathSection.tsx
 * @description "Wcześniejsze wybrzmienia" — catalog grid of past Concerts Spirituels.
 * Mounts <PathCard /> per entry from the typed `PATHS` constant.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/PathSection
 */

import { forwardRef } from "react";

import { PATHS } from "@/features/landing/constants/paths";
import { PathCard } from "@/widgets/landing/PathCard/PathCard";

export const PathSection = forwardRef<HTMLElement>(function PathSection(_props, ref) {
  return (
    <section className="section path" id="droga" aria-label="Wcześniejsze współbrzemienia" ref={ref}>
      <div className="section-grid">
        <div className="section-label micro">
          <span>Z drogi</span>
        </div>
        <div className="path-body">
          <h2 className="section-title reveal">
            Wcześniejsze<br />wybrzmienia.
          </h2>
          <p className="path-lede reveal">
            Od renesansowej polifonii po współczesne misteria — tworzymy koncerty, które
            pozostają żywe i mogą wybrzmieć na nowo w kolejnych przestrzeniach.
          </p>
          <div className="path-grid">
            {PATHS.map((path) => (
              <PathCard key={path.slug} path={path} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});
