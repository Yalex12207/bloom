"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { chapters } from "@/lib/chapters";
import { useExperienceStore } from "@/store/experience-store";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export function SiteHeader() {
  const menuOpen = useExperienceStore((state) => state.menuOpen);
  const setMenuOpen = useExperienceStore((state) => state.setMenuOpen);
  const activeChapter = useExperienceStore((state) => state.activeChapter);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggle.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [menuOpen, setMenuOpen]);

  return (
    <header ref={header} className="site-header">
      <a className="brand" href="#awakening" aria-label="BLOOM — return to the awakening" onClick={() => setMenuOpen(false)}>
        bloom<span className="brand-mark" aria-hidden="true">®</span>
      </a>

      <nav className="header-nav" aria-label="Main navigation">
        <a className="header-experience" href="#awakening" onClick={() => setMenuOpen(false)}>
          The experience
        </a>
        <button
          ref={toggle}
          className="chapters-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="chapter-menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          The chapters
          <span className="menu-symbol" data-open={menuOpen} aria-hidden="true">+</span>
        </button>
      </nav>

      <a className="header-enter" href="#genesis" onClick={() => setMenuOpen(false)}>
        Enter the experience <span aria-hidden="true">↗</span>
      </a>

      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.nav
            id="chapter-menu"
            className="chapter-menu"
            aria-label="Choose a chapter"
            initial={reducedMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: reducedMotion ? 0 : 0.22, ease: "easeOut" }}
          >
            <span className="chapter-menu-eyebrow">Five chapters. One becoming.</span>
            {chapters.map((chapter) => (
              <a
                key={chapter.id}
                className="chapter-menu-link"
                href={`#${chapter.id}`}
                aria-current={activeChapter === chapter.id ? "location" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <span className="chapter-menu-number">{chapter.number}</span>
                <span>{chapter.title}</span>
                <span className="chapter-menu-arrow" aria-hidden="true">↗</span>
              </a>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
