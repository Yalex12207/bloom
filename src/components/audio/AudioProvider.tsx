"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { gsap } from "gsap";
import { AudioController } from "@/audio/AudioController";

const AudioContextStore = createContext<AudioController | null>(null);

/** No audio context or network request exists until a listener explicitly starts it. */
export function AudioProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => new AudioController());
  const owners = useRef(0);

  useEffect(() => {
    owners.current += 1;
    let ticking = false;
    function tick(_time: number, deltaMs: number) {
      controller.update(Math.min(0.05, deltaMs / 1000));
      if (!controller.needsUpdate) syncTicker();
    }
    function syncTicker() {
      const shouldTick = controller.needsUpdate && document.visibilityState === "visible";
      if (shouldTick && !ticking) { gsap.ticker.add(tick); ticking = true; }
      if (!shouldTick && ticking) { gsap.ticker.remove(tick); ticking = false; }
    }
    function handleVisibility() {
      // Returning to a tab never starts audible playback without another gesture.
      if (document.visibilityState !== "visible") controller.stop();
      syncTicker();
    }
    const unsubscribe = controller.subscribe(syncTicker);
    document.addEventListener("visibilitychange", handleVisibility);
    syncTicker();
    return () => {
      gsap.ticker.remove(tick);
      ticking = false;
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
      owners.current -= 1;
      // StrictMode immediately retains this instance again. A real unmount closes it.
      queueMicrotask(() => { if (owners.current === 0) controller.dispose(); });
    };
  }, [controller]);

  return <AudioContextStore.Provider value={controller}>{children}</AudioContextStore.Provider>;
}

export function useAudioController(): AudioController {
  const controller = useContext(AudioContextStore);
  if (!controller) throw new Error("useAudioController must be used within AudioProvider.");
  return controller;
}

export function useAudioSnapshot() {
  const controller = useAudioController();
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
