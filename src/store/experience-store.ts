import { create } from "zustand";
import type { ChapterId } from "@/lib/chapters";

interface ExperienceState {
  activeChapter: ChapterId;
  menuOpen: boolean;
  setActiveChapter: (chapter: ChapterId) => void;
  setMenuOpen: (open: boolean) => void;
}

// Store chapter transitions only. Pointer and scroll positions stay outside React.
export const useExperienceStore = create<ExperienceState>((set) => ({
  activeChapter: "awakening",
  menuOpen: false,
  setActiveChapter: (activeChapter) => set({ activeChapter }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
}));
