"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { gsap } from "gsap";
import { ThemeController } from "@/lib/ThemeController";
import { useCinematicRuntime } from "@/components/effects/cinematic-context";

const ThemeContext = createContext<ThemeController | null>(null);

/** One theme clock, separate from scroll geometry but following its current chapter. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => new ThemeController());
  const rootRef = useRef<HTMLDivElement>(null);
  const cinematic = useCinematicRuntime();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let ticking = false;

    function paint() {
      const frame = controller.frame;
      const snapshot = controller.getSnapshot();
      root!.style.setProperty("--theme-accent", frame.accent.getStyle());
      root!.style.setProperty("--theme-secondary", frame.secondary.getStyle());
      root!.style.setProperty("--theme-atmosphere-a", frame.atmosphereA.getStyle());
      root!.style.setProperty("--theme-atmosphere-b", frame.atmosphereB.getStyle());
      // Existing emphasis tokens remain the single source for the original UI.
      root!.style.setProperty("--crimson", frame.accent.getStyle());
      root!.dataset.theme = snapshot.theme;
      root!.dataset.themeMode = snapshot.mode;
      root!.dataset.themeTransitioning = String(snapshot.transitioning);
      root!.dataset.themeProgress = controller.progress.toFixed(5);
      root!.dataset.themeAccent = frame.accent.getHexString();
      root!.dataset.themeSecondary = frame.secondary.getHexString();
      root!.dataset.themePetalA = frame.petalA.getHexString();
      root!.dataset.themePetalB = frame.petalB.getHexString();
      root!.dataset.themeTransmission = frame.transmission.toFixed(5);
      root!.dataset.themeGradient = frame.gradientMix.toFixed(5);
    }

    function tick(_time: number, deltaMs: number) {
      // A restored tab resumes the blend instead of consuming its hidden time.
      if (document.visibilityState === "visible") controller.advance(Math.min(deltaMs / 1000, 0.064));
    }

    function syncTicker() {
      const shouldTick = controller.getSnapshot().transitioning && document.visibilityState === "visible";
      if (shouldTick && !ticking) { gsap.ticker.add(tick); ticking = true; }
      if (!shouldTick && ticking) { gsap.ticker.remove(tick); ticking = false; }
      paint();
    }

    function followChapter() { controller.setChapter(cinematic.frame.chapter); }
    function handleMedia() { controller.setReducedMotion(media.matches); syncTicker(); }
    const stopFrames = controller.subscribeFrame(paint);
    const stopMetadata = controller.subscribe(syncTicker);
    const stopCinematic = cinematic.subscribe(followChapter);
    media.addEventListener("change", handleMedia);
    document.addEventListener("visibilitychange", syncTicker);
    controller.setReducedMotion(media.matches);
    followChapter();
    syncTicker();

    return () => {
      gsap.ticker.remove(tick);
      ticking = false;
      stopFrames(); stopMetadata(); stopCinematic();
      media.removeEventListener("change", handleMedia);
      document.removeEventListener("visibilitychange", syncTicker);
    };
  }, [controller, cinematic]);

  return <ThemeContext.Provider value={controller}><div ref={rootRef} className="theme-root" data-theme-root>{children}</div></ThemeContext.Provider>;
}

export function useThemeController(): ThemeController {
  const controller = useContext(ThemeContext);
  if (!controller) throw new Error("useThemeController must be used within ThemeProvider.");
  return controller;
}

export function useThemeSnapshot() {
  const controller = useThemeController();
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
