"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { chapters } from "@/lib/chapters";
import { useExperienceStore } from "@/store/experience-store";
import { CinematicContextProvider, useCinematicRuntime } from "./cinematic-context";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AudioProvider } from "@/components/audio/AudioProvider";

const CHAPTER_COUNT = chapters.length;
const CSS_VARIABLES = ["--cinema-progress", "--hero-reveal", "--cinema-veil", "--cinema-shock", "--reborn-reveal"] as const;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function ExperienceRoot({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const runtime = useCinematicRuntime();

  useEffect(() => {
    const root = scope.current;
    if (!root) return;
    const hadCinematicClass = root.classList.contains("cinematic-enabled");
    gsap.registerPlugin(ScrollTrigger);

    let disposed = false;
    let rebuilding = false;
    let refreshFrame = 0;
    let timeline: gsap.core.Timeline | null = null;
    let trigger: ScrollTrigger | null = null;
    const proxy = { progress: 0 };
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = media.matches;
    const sections = chapters.map(chapter => root.querySelector<HTMLElement>(`#${chapter.id}`));
    const boundaries = Array.from({ length: CHAPTER_COUNT + 1 }, (_, index) => index);
    let scrollRange = 1;
    let endScroll = 1;
    const previousVariables = CSS_VARIABLES.map(name => [name, root.style.getPropertyValue(name)] as const);
    const revealSlots = new Map<HTMLElement, number>();
    const reveals = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]")).map(element => {
      const section = element.closest<HTMLElement>("[data-chapter]");
      const chapterIndex = Math.max(0, chapters.findIndex(chapter => chapter.id === section?.dataset.chapter));
      const slot = section ? revealSlots.get(section) ?? 0 : 0;
      if (section) revealSlots.set(section, slot + 1);
      return {
        element, chapterIndex, delay: Math.min(0.09, slot * 0.03),
        intensity: element.matches(".fracture-type") ? 0.16 : element.matches(".genesis-art,.metamorphosis-art") ? 0.14 : 1,
        translate: element.style.translate,
        opacity: element.style.opacity,
        clipPath: element.style.clipPath,
      };
    });

    function paint() {
      if (disposed) return;
      const frame = runtime.frame;
      const chapter = chapters[frame.chapter] ?? chapters[0];
      root!.style.setProperty("--cinema-progress", frame.progress.toFixed(5));
      root!.style.setProperty("--hero-reveal", (reducedMotion ? 1 : frame.titleReveal).toFixed(5));
      root!.style.setProperty("--cinema-veil", (reducedMotion ? 0 : frame.veil).toFixed(5));
      root!.style.setProperty("--cinema-shock", frame.shock.toFixed(5));
      root!.style.setProperty("--reborn-reveal", (reducedMotion?1:frame.rebornReveal).toFixed(5));
      root!.dataset.cinemaProgress = frame.progress.toFixed(5);
      root!.dataset.cinemaChapter = chapter.id;
      root!.dataset.cinemaLocal = frame.chapterProgress.toFixed(5);
      root!.dataset.cinemaPhase = chapter.id;
      root!.dataset.cinemaCamera = `${frame.cameraX.toFixed(4)},${frame.cameraY.toFixed(4)},${frame.cameraZ.toFixed(4)}`;
      root!.dataset.cinemaReduced = String(reducedMotion);
      root!.dataset.cinemaFinale = String(frame.progress >= 0.94);
      for (const reveal of reveals) {
        // A small overlap reveals the next heading as it enters the viewport.
        // The same reversible story sample drives every mask, without local triggers.
        const local = frame.progress * CHAPTER_COUNT - reveal.chapterIndex;
        const amount = reducedMotion ? 1 : clamp01((local + 0.22 - reveal.delay) / 0.3);
        const eased = amount * amount * (3 - 2 * amount);
        reveal.element.style.translate = `0 ${(34 * (1 - eased)).toFixed(3)}px`;
        reveal.element.style.opacity = (eased * reveal.intensity).toFixed(5);
        reveal.element.style.clipPath = `inset(0 0 ${(100 * (1 - eased)).toFixed(3)}% 0)`;
      }
      const state = useExperienceStore.getState();
      if (state.activeChapter !== chapter.id) state.setActiveChapter(chapter.id);
    }

    const unsubscribe = runtime.subscribe(paint);

    function publish() {
      if (!disposed && !rebuilding) runtime.update(proxy.progress, reducedMotion);
    }

    function measure() {
      const rootTop = root!.getBoundingClientRect().top + window.scrollY;
      endScroll = Math.max(rootTop + CHAPTER_COUNT, document.documentElement.scrollHeight - window.innerHeight);
      scrollRange = endScroll - rootTop;
      boundaries[0] = 0;
      for (let index = 1; index < CHAPTER_COUNT; index++) {
        const section = sections[index];
        const margin = section ? Number.parseFloat(window.getComputedStyle(section).scrollMarginTop) || 0 : 0;
        const position = section
          ? section.getBoundingClientRect().top + window.scrollY - rootTop - margin
          : scrollRange * index / CHAPTER_COUNT;
        // Account for native scroll-margin-top so chapter links land on their state.
        boundaries[index] = Math.max(boundaries[index - 1] + 1, Math.min(scrollRange - (CHAPTER_COUNT - index), position));
      }
      boundaries[CHAPTER_COUNT] = scrollRange;
      root!.dataset.cinemaBoundaries = boundaries.map(value => value.toFixed(2)).join(",");
    }

    function buildSegments() {
      if (!timeline) return;
      rebuilding = true;
      measure();
      timeline.pause(0).clear();
      proxy.progress = 0;
      for (let index = 0; index < CHAPTER_COUNT; index++) {
        timeline.fromTo(proxy, { progress: index / CHAPTER_COUNT }, {
          progress: (index + 1) / CHAPTER_COUNT,
          duration: (boundaries[index + 1] - boundaries[index]) / scrollRange,
          ease: "none",
          immediateRender: false,
        }, boundaries[index] / scrollRange);
      }
      rebuilding = false;
    }

    function pauseScrub(owner: ScrollTrigger | null) {
      // GSAP can return false for scrub:true, which has no smoothing tween.
      const tween = owner?.getTween();
      if (tween && typeof tween.pause === "function") tween.pause();
    }

    function seekToScroll(owner: ScrollTrigger) {
      if (!timeline || disposed) return;
      // Refresh/reload/visibility restoration must sample today's scroll position,
      // rather than waiting for the old scrub tween to catch up to an obsolete pose.
      const progress = clamp01((window.scrollY - owner.start) / Math.max(1, owner.end - owner.start));
      pauseScrub(owner);
      timeline.totalProgress(progress, true);
      publish();
    }

    function createMaster() {
      trigger?.kill();
      timeline?.kill();
      timeline = gsap.timeline({ paused: true, onUpdate: publish });
      buildSegments();
      trigger = ScrollTrigger.create({
        id: "bloom-master",
        trigger: root,
        start: "top top",
        end: () => endScroll,
        animation: timeline,
        scrub: reducedMotion ? true : 0.4,
        invalidateOnRefresh: true,
        onRefreshInit: buildSegments,
        onRefresh: seekToScroll,
      });
      root!.dataset.cinemaTriggerCount=String(ScrollTrigger.getAll().filter(item=>item.vars.id==="bloom-master").length);
      seekToScroll(trigger);
    }

    function scheduleRefresh() {
      if (disposed || refreshFrame) return;
      refreshFrame = window.requestAnimationFrame(() => {
        refreshFrame = 0;
        trigger?.refresh();
      });
    }

    function handleMediaChange() {
      reducedMotion = media.matches;
      createMaster();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") scheduleRefresh();
      else pauseScrub(trigger);
    }

    root.classList.add("cinematic-enabled");
    createMaster();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleRefresh) : null;
    observer?.observe(root);
    sections.forEach(section => { if (section) observer?.observe(section); });
    media.addEventListener("change", handleMediaChange);
    window.addEventListener("resize", scheduleRefresh);
    window.addEventListener("pageshow", scheduleRefresh);
    window.addEventListener("load", scheduleRefresh);
    document.addEventListener("visibilitychange", handleVisibility);
    document.fonts.addEventListener("loadingdone", scheduleRefresh);
    void document.fonts.ready.then(() => { if (!disposed) scheduleRefresh(); });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(refreshFrame);
      observer?.disconnect();
      media.removeEventListener("change", handleMediaChange);
      window.removeEventListener("resize", scheduleRefresh);
      window.removeEventListener("pageshow", scheduleRefresh);
      window.removeEventListener("load", scheduleRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.fonts.removeEventListener("loadingdone", scheduleRefresh);
      trigger?.kill();
      timeline?.kill();
      unsubscribe();
      if (!hadCinematicClass) root.classList.remove("cinematic-enabled");
      previousVariables.forEach(([name, value]) => {
        if (value) root.style.setProperty(name, value);
        else root.style.removeProperty(name);
      });
      reveals.forEach(({ element, translate, opacity, clipPath }) => {
        element.style.translate = translate;
        element.style.opacity = opacity;
        element.style.clipPath = clipPath;
      });
      for (const key of ["cinemaProgress", "cinemaChapter", "cinemaLocal", "cinemaPhase", "cinemaCamera", "cinemaReduced", "cinemaFinale", "cinemaBoundaries", "cinemaTriggerCount"]) {
        delete root.dataset[key];
      }
    };
  }, [runtime]);

  return (
    <MotionConfig reducedMotion="user">
      <div ref={scope} className="experience-root cinematic-enabled" data-cinematic-root>
        {children}
      </div>
    </MotionConfig>
  );
}

export function ExperienceProvider({ children }: { children: ReactNode }) {
  return <CinematicContextProvider><ThemeProvider><AudioProvider><ExperienceRoot>{children}</ExperienceRoot></AudioProvider></ThemeProvider></CinematicContextProvider>;
}
