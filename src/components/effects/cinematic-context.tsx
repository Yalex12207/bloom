"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { CinematicRuntime } from "@/lib/cinematic-state";

const CinematicContext = createContext<CinematicRuntime | null>(null);

/** One retained frame and notification channel for the DOM and the WebGL scene. */
export function CinematicContextProvider({ children }: { children: ReactNode }) {
  const [runtime] = useState(() => new CinematicRuntime());
  return <CinematicContext.Provider value={runtime}>{children}</CinematicContext.Provider>;
}

export function useCinematicRuntime(): CinematicRuntime {
  const runtime = useContext(CinematicContext);
  if (!runtime) throw new Error("useCinematicRuntime must be used within ExperienceProvider.");
  return runtime;
}
