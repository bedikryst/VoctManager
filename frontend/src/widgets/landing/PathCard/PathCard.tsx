/**
 * @file PathCard.tsx
 * @description One catalog entry in the "wcześniejsze wybrzmienia" grid: poster,
 * meta strip with the auto-incremented Roman index, title, place, note and an
 * animated <details> for the repertoire or program text. The fallback "is-missing"
 * state engages when the poster image can't load.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/PathCard
 */

import { useState } from "react";

import type { Path } from "@/features/landing/constants/paths";

export function PathCard({ path }: { readonly path: Path }): React.JSX.Element {
  const [posterMissing, setPosterMissing] = useState(false);
  const { works, paragraphs, note } = path.detail.content;

  return (
    <article className="path-card reveal">
      <figure className={`path-card-poster${posterMissing ? " is-missing" : ""}`} aria-hidden="true">
        {!posterMissing ? (
          <img
            src={path.poster.src}
            srcSet={path.poster.srcset}
            sizes="(max-width: 980px) 86vw, 30vw"
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setPosterMissing(true)}
          />
        ) : null}
      </figure>
      <div className="path-card-body">
        <div className="path-card-meta">
          <span className="path-card-year">{path.year}</span>
          <span className="path-card-tag">{path.tag}</span>
        </div>
        <h3 className="path-card-title">{path.title}</h3>
        <p className="path-card-place">{path.place}</p>
        <p className="path-card-note">{path.note}</p>
        <details className="path-card-detail">
          <summary>
            <span>{path.detail.summary}</span>
            <span className="path-detail-icon" aria-hidden="true" />
          </summary>
          {works ? (
            <ol className="path-works">
              {works.map((work, index) => (
                <li key={index} className={work.bis ? "path-works-bis" : undefined}>
                  {work.text}
                  {work.italic ? <em>{work.italic}</em> : null}
                </li>
              ))}
            </ol>
          ) : null}
          {paragraphs?.map((paragraph, index) => (
            <p key={index} className="path-detail-text">
              {paragraph}
            </p>
          ))}
          {note ? <p className="path-works-note">{note}</p> : null}
        </details>
      </div>
    </article>
  );
}
