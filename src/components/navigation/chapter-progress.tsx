"use client";

import { chapters } from "@/lib/chapters";
import { useExperienceStore } from "@/store/experience-store";

export function ChapterProgress() {
  const activeChapter = useExperienceStore((state) => state.activeChapter);

  return (
    <nav className="chapter-progress" aria-label="Chapter progress">
      <span className="chapter-progress-label" aria-hidden="true">CHAPTERS</span>
      <ol className="chapter-progress-list">
        {chapters.map((chapter) => (
          <li key={chapter.id}>
            <a
              className="chapter-progress-link"
              href={`#${chapter.id}`}
              aria-label={`${chapter.number} / ${chapter.title}`}
              aria-current={activeChapter === chapter.id ? "location" : undefined}
              data-active={activeChapter === chapter.id}
            >
              <span className="chapter-progress-name" aria-hidden="true">{chapter.title}</span>
              <span className="chapter-progress-number" aria-hidden="true">{chapter.number}</span>
              <span className="chapter-progress-line" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
