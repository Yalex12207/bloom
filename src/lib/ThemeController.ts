import { Color } from "three";

export const THEME_IDS = ["CRIMSON", "AZURE", "VIOLET", "SILVER", "DUALITY", "NEBULA"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export type ThemeMode = "auto" | "manual";

export const CHAPTER_THEMES: readonly ThemeId[] = ["CRIMSON", "SILVER", "AZURE", "NEBULA", "DUALITY"];

interface ThemeNumbers {
  metalness: number;
  roughness: number;
  transmission: number;
  thickness: number;
  ior: number;
  clearcoat: number;
  iridescence: number;
  envMapIntensity: number;
  gradientMix: number;
  particleIntensity: number;
  keyIntensity: number;
  rimIntensity: number;
  fillIntensity: number;
  coreIntensity: number;
}

interface ThemeColorDefinition {
  accent: string;
  secondary: string;
  petalA: string;
  petalB: string;
  keyLight: string;
  rimLight: string;
  fillLight: string;
  core: string;
  particleA: string;
  particleB: string;
  atmosphereA: string;
  atmosphereB: string;
}

export interface ThemeDefinition extends ThemeNumbers, ThemeColorDefinition {
  label: string;
  description: string;
}

export interface ThemeFrame extends ThemeNumbers {
  accent: Color;
  secondary: Color;
  petalA: Color;
  petalB: Color;
  keyLight: Color;
  rimLight: Color;
  fillLight: Color;
  core: Color;
  particleA: Color;
  particleB: Color;
  atmosphereA: Color;
  atmosphereB: Color;
}

export interface ThemeSnapshot {
  readonly theme: ThemeId;
  readonly mode: ThemeMode;
  readonly chapter: number;
  readonly transitioning: boolean;
}

const COLOR_FIELDS: readonly (keyof ThemeColorDefinition)[] = [
  "accent", "secondary", "petalA", "petalB", "keyLight", "rimLight", "fillLight",
  "core", "particleA", "particleB", "atmosphereA", "atmosphereB",
];
const NUMBER_FIELDS: readonly (keyof ThemeNumbers)[] = [
  "metalness", "roughness", "transmission", "thickness", "ior", "clearcoat",
  "iridescence", "envMapIntensity", "gradientMix", "particleIntensity",
  "keyIntensity", "rimIntensity", "fillIntensity", "coreIntensity",
];

const DEFAULT_NUMBERS: ThemeNumbers = {
  metalness: 0.68, roughness: 0.2, transmission: 0, thickness: 0.2, ior: 1.5,
  clearcoat: 1, iridescence: 0, envMapIntensity: 1.9, gradientMix: 0.3,
  particleIntensity: 0.7, keyIntensity: 1, rimIntensity: 1, fillIntensity: 0.8, coreIntensity: 1,
};

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  CRIMSON: {
    ...DEFAULT_NUMBERS,
    label: "CRIMSON", description: "Lacquer, ember and a warm red atmosphere.",
    accent: "#F04456", secondary: "#8B172F", petalA: "#B81732", petalB: "#5A1026",
    keyLight: "#FFD8CB", rimLight: "#FF7B89", fillLight: "#7D233E", core: "#F04456",
    particleA: "#F04456", particleB: "#C8DDE9", atmosphereA: "#26040C", atmosphereB: "#080A0E",
    metalness: 0.58, roughness: 0.19, thickness: 0.18, ior: 1.52,
    gradientMix: 0.22, rimIntensity: 1.05, coreIntensity: 1.15,
  },
  AZURE: {
    ...DEFAULT_NUMBERS,
    label: "AZURE", description: "Translucent blue glass with a cool cyan rim.",
    accent: "#168BFF", secondary: "#80E2E8", petalA: "#76BCF4", petalB: "#1E4E9A",
    keyLight: "#DDEEFF", rimLight: "#6AF1FF", fillLight: "#3456AA", core: "#69CFFF",
    particleA: "#46AFFF", particleB: "#89E3E4", atmosphereA: "#071A30", atmosphereB: "#061421",
    metalness: 0.05, roughness: 0.11, transmission: 0.82, thickness: 0.28, ior: 1.46,
    envMapIntensity: 2.2, gradientMix: 0.45, particleIntensity: 0.8,
    rimIntensity: 1.25, fillIntensity: 1, coreIntensity: 1.1,
  },
  VIOLET: {
    ...DEFAULT_NUMBERS,
    label: "VIOLET", description: "An iridescent violet surface and soft magenta light.",
    accent: "#A46BFF", secondary: "#E6A3EF", petalA: "#7774CA", petalB: "#A948B8",
    keyLight: "#E9DAFF", rimLight: "#BD8FFF", fillLight: "#61499A", core: "#CC9CF5",
    particleA: "#B591FF", particleB: "#EC9AD9", atmosphereA: "#1B0C2B", atmosphereB: "#0E102B",
    metalness: 0.72, roughness: 0.22, ior: 1.42, iridescence: 1,
    gradientMix: 0.55, particleIntensity: 0.72, rimIntensity: 1.15, fillIntensity: 0.9, coreIntensity: 0.95,
  },
  SILVER: {
    ...DEFAULT_NUMBERS,
    label: "SILVER", description: "Minimal polished silver under soft, cold blue reflections.",
    accent: "#C8DDE9", secondary: "#A9C6DE", petalA: "#C4D3DF", petalB: "#7A8794",
    keyLight: "#EDF5FF", rimLight: "#A9D4FF", fillLight: "#A7BDCD", core: "#D2E5F3",
    particleA: "#CCDDE8", particleB: "#9FBFD9", atmosphereA: "#101A25", atmosphereB: "#0B111B",
    metalness: 0.96, thickness: 0.15, gradientMix: 0.2, particleIntensity: 0.55,
    keyIntensity: 1.1, rimIntensity: 1.1, fillIntensity: 0.7, coreIntensity: 0.8,
  },
  DUALITY: {
    ...DEFAULT_NUMBERS,
    label: "DUALITY", description: "A crimson and blue pair held in the same reflective surface.",
    accent: "#F04456", secondary: "#168BFF", petalA: "#D82C41", petalB: "#168BFF",
    keyLight: "#FFD3C8", rimLight: "#79B7FF", fillLight: "#4079C4", core: "#F9ADAE",
    particleA: "#F04456", particleB: "#168BFF", atmosphereA: "#250916", atmosphereB: "#071E37",
    roughness: 0.18, transmission: 0.12, ior: 1.48, iridescence: 0.2,
    envMapIntensity: 2.1, gradientMix: 0.12, particleIntensity: 0.9,
    rimIntensity: 1.2, fillIntensity: 0.9, coreIntensity: 1.1,
  },
  NEBULA: {
    ...DEFAULT_NUMBERS,
    label: "NEBULA", description: "Blue and violet gradient glass, particles and atmospheric light.",
    accent: "#168BFF", secondary: "#A46BFF", petalA: "#2876DB", petalB: "#9062DA",
    keyLight: "#DBE8FF", rimLight: "#B48AFF", fillLight: "#4965B6", core: "#A6A1FF",
    particleA: "#168BFF", particleB: "#A46BFF", atmosphereA: "#07182F", atmosphereB: "#1C0D32",
    metalness: 0.18, transmission: 0.58, thickness: 0.24, ior: 1.46, iridescence: 0.85,
    envMapIntensity: 2.25, gradientMix: 1, particleIntensity: 1,
    rimIntensity: 1.2, fillIntensity: 1, coreIntensity: 1.1,
  },
};

function createFrame(definition: ThemeDefinition): ThemeFrame {
  const frame: ThemeFrame = {
    ...DEFAULT_NUMBERS,
    accent: new Color(), secondary: new Color(), petalA: new Color(), petalB: new Color(),
    keyLight: new Color(), rimLight: new Color(), fillLight: new Color(), core: new Color(),
    particleA: new Color(), particleB: new Color(), atmosphereA: new Color(), atmosphereB: new Color(),
  };
  applyDefinition(frame, definition);
  return frame;
}

function applyDefinition(frame: ThemeFrame, definition: ThemeDefinition) {
  for (let index = 0; index < COLOR_FIELDS.length; index += 1) {
    const field = COLOR_FIELDS[index];
    // Color.set interprets CSS hex in sRGB and stores working-space linear values.
    frame[field].set(definition[field]);
  }
  for (let index = 0; index < NUMBER_FIELDS.length; index += 1) {
    const field = NUMBER_FIELDS[index];
    frame[field] = definition[field];
  }
}

function copyFrame(destination: ThemeFrame, source: ThemeFrame) {
  for (let index = 0; index < COLOR_FIELDS.length; index += 1) {
    const field = COLOR_FIELDS[index];
    destination[field].copy(source[field]);
  }
  for (let index = 0; index < NUMBER_FIELDS.length; index += 1) {
    const field = NUMBER_FIELDS[index];
    destination[field] = source[field];
  }
}

const TRANSITION_SECONDS = 1.2;

/** An externally clocked store: no RAF, GSAP, browser globals or scene ownership. */
export class ThemeController {
  readonly frame = createFrame(THEMES.CRIMSON);
  private readonly from = createFrame(THEMES.CRIMSON);
  private readonly target = createFrame(THEMES.CRIMSON);
  private readonly listeners = new Set<() => void>();
  private readonly frameListeners = new Set<() => void>();
  private snapshot: ThemeSnapshot = { theme: "CRIMSON", mode: "auto", chapter: 0, transitioning: false };
  private elapsed = TRANSITION_SECONDS;
  private reducedMotion = false;

  getSnapshot = (): ThemeSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  subscribeFrame = (listener: () => void): (() => void) => {
    this.frameListeners.add(listener);
    return () => { this.frameListeners.delete(listener); };
  };

  get progress(): number {
    return Math.min(1, this.elapsed / TRANSITION_SECONDS);
  }

  selectTheme(id: ThemeId): void {
    if (!THEME_IDS.includes(id)) return;
    this.transitionTo(id, "manual", this.snapshot.chapter);
  }

  setAuto(enabled: boolean): void {
    this.transitionTo(enabled ? CHAPTER_THEMES[this.snapshot.chapter] : this.snapshot.theme,
      enabled ? "auto" : "manual", this.snapshot.chapter);
  }

  setChapter(index: number): void {
    const chapter = Number.isNaN(index) ? 0 : Math.min(CHAPTER_THEMES.length - 1, Math.max(0, Math.floor(index)));
    this.transitionTo(this.snapshot.mode === "auto" ? CHAPTER_THEMES[chapter] : this.snapshot.theme,
      this.snapshot.mode, chapter);
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (enabled && this.snapshot.transitioning) {
      copyFrame(this.frame, this.target);
      this.elapsed = TRANSITION_SECONDS;
      this.publishMetadata(this.snapshot.theme, this.snapshot.mode, this.snapshot.chapter, false);
      this.publishFrame();
    }
  }

  advance(seconds: number): void {
    if (!this.snapshot.transitioning || !Number.isFinite(seconds) || seconds <= 0) return;
    this.elapsed = Math.min(TRANSITION_SECONDS, this.elapsed + seconds);
    if (TRANSITION_SECONDS - this.elapsed < 1e-9) this.elapsed = TRANSITION_SECONDS;
    const p = this.progress;
    const eased = p * p * (3 - 2 * p);

    if (p === 1) {
      copyFrame(this.frame, this.target);
      this.publishMetadata(this.snapshot.theme, this.snapshot.mode, this.snapshot.chapter, false);
    } else {
      for (let index = 0; index < COLOR_FIELDS.length; index += 1) {
        const field = COLOR_FIELDS[index];
        this.frame[field].lerpColors(this.from[field], this.target[field], eased);
      }
      for (let index = 0; index < NUMBER_FIELDS.length; index += 1) {
        const field = NUMBER_FIELDS[index];
        this.frame[field] = this.from[field] + (this.target[field] - this.from[field]) * eased;
      }
    }

    this.publishFrame();
  }

  private transitionTo(theme: ThemeId, mode: ThemeMode, chapter: number) {
    if (theme === this.snapshot.theme) {
      this.publishMetadata(theme, mode, chapter, this.snapshot.transitioning);
      return;
    }

    copyFrame(this.from, this.frame);
    applyDefinition(this.target, THEMES[theme]);
    this.elapsed = this.reducedMotion ? TRANSITION_SECONDS : 0;
    if (this.reducedMotion) copyFrame(this.frame, this.target);
    this.publishMetadata(theme, mode, chapter, !this.reducedMotion);
    if (this.reducedMotion) this.publishFrame();
  }

  private publishMetadata(theme: ThemeId, mode: ThemeMode, chapter: number, transitioning: boolean) {
    const previous = this.snapshot;
    if (previous.theme === theme && previous.mode === mode && previous.chapter === chapter
      && previous.transitioning === transitioning) return;
    this.snapshot = { theme, mode, chapter, transitioning };
    for (const listener of this.listeners) listener();
  }

  private publishFrame() {
    for (const listener of this.frameListeners) listener();
  }
}
