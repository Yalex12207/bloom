/** One scroll sample shared by the DOM timeline and the persistent R3F scene. */
export interface CinematicFrame {
  progress: number;
  chapter: number;
  chapterProgress: number;
  bloom: number;
  scatter: number;
  sculpture: number;
  dissolve: number;
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  flowerX: number;
  flowerY: number;
  flowerZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  flowerScale: number;
  keyLight: number;
  rimLight: number;
  coreLight: number;
  sweep: number;
  particleSpread: number;
  particleOpacity: number;
  wave: number;
  shock: number;
  veil: number;
  titleReveal: number;
  genesisReveal: number;
  fractureReveal: number;
  rebornReveal: number;
}

export const TIMELINE_BOUNDARIES = [0, 0.2, 0.4, 0.6, 0.8, 1] as const;

/** Keypoints use absolute normalized page progress, rather than chapter-local time. */
export const TIMELINE_CHAPTERS = [
  {
    id: "awakening", index: 0, number: "00", title: "THE AWAKENING", start: 0, end: 0.2,
    keypoints: [
      { name: "signal-in-the-dark", progress: 0.025 },
      { name: "title-unmasked", progress: 0.12 },
      { name: "first-petal-visible", progress: 0.2 },
    ],
  },
  {
    id: "genesis", index: 1, number: "01", title: "GENESIS", start: 0.2, end: 0.4,
    keypoints: [
      { name: "unfold-begins", progress: 0.2 },
      { name: "camera-orbit", progress: 0.28 },
      { name: "full-bloom", progress: 0.4 },
    ],
  },
  {
    id: "fracture", index: 2, number: "02", title: "FRACTURE", start: 0.4, end: 0.6,
    keypoints: [
      { name: "tension", progress: 0.4 },
      { name: "red-shock", progress: 0.455 },
      { name: "petals-in-flight", progress: 0.6 },
    ],
  },
  {
    id: "metamorphosis", index: 3, number: "03", title: "METAMORPHOSIS", start: 0.6, end: 0.8,
    keypoints: [
      { name: "new-attractor", progress: 0.6 },
      { name: "spiral-observation", progress: 0.73 },
      { name: "compact-helix", progress: 0.8 },
    ],
  },
  {
    id: "rebirth", index: 4, number: "04", title: "REBIRTH", start: 0.8, end: 1,
    keypoints: [
      { name: "return-to-flower", progress: 0.8 },
      { name: "red-wave", progress: 0.895 },
      { name: "quiet-distance", progress: 1 },
    ],
  },
] as const;

type PoseField = Exclude<keyof CinematicFrame,
  "progress" | "chapter" | "chapterProgress" | "sweep" | "wave" | "shock"
  | "titleReveal" | "genesisReveal" | "fractureReveal" | "rebornReveal">;
type CinematicPose = Pick<CinematicFrame, PoseField>;

const POSE_FIELDS: readonly PoseField[] = [
  "bloom", "scatter", "sculpture", "dissolve", "cameraX", "cameraY", "cameraZ",
  "targetX", "targetY", "targetZ", "flowerX", "flowerY", "flowerZ", "rotationX",
  "rotationY", "rotationZ", "flowerScale", "keyLight", "rimLight", "coreLight",
  "particleSpread", "particleOpacity", "veil",
];

const INITIAL_POSE: CinematicPose = {
  bloom: 0, scatter: 0, sculpture: 0, dissolve: 1,
  cameraX: 0, cameraY: 0, cameraZ: 12,
  targetX: 0, targetY: 0, targetZ: 0,
  flowerX: 1.3, flowerY: 1.2, flowerZ: 0,
  rotationX: -0.32, rotationY: -0.22, rotationZ: -0.2,
  flowerScale: 1, keyLight: 0.12, rimLight: 0.8, coreLight: 1.8,
  particleSpread: 1, particleOpacity: 0.05, veil: 0.96,
};

type PoseKeyframe = { progress: number; pose: CinematicPose };

/** Expand sparse authoring patches once, never while sampling a scroll frame. */
function defineKeyframes(definitions: readonly { progress: number; pose: Partial<CinematicPose> }[]): readonly PoseKeyframe[] {
  let previous = INITIAL_POSE;
  return definitions.map((definition) => {
    previous = { ...previous, ...definition.pose };
    return { progress: definition.progress, pose: previous };
  });
}

// Every camera Z remains at least 9.6, and flower Z stays in [0, .1].
// The orbital/spiral moves therefore cannot cut through the flower or near plane.
const KEYFRAMES = defineKeyframes([
  { progress: 0, pose: INITIAL_POSE },
  { progress: 0.1, pose: {
    dissolve: 0.38, cameraY: 0.2, cameraZ: 10.5, rotationY: -0.1,
    keyLight: 0.8, rimLight: 2.2, coreLight: 2.4, veil: 0.24,
  } },
  { progress: 0.2, pose: {
    dissolve: 0.1, cameraX: -0.6, cameraY: 0.4, cameraZ: 9.6,
    targetX: -0.45, flowerX: -1.4, flowerY: 0,
    rotationX: -0.2, rotationY: 0.12, rotationZ: -0.08, flowerScale: 1.12,
    keyLight: 2.4, rimLight: 3.6, coreLight: 1.5, particleOpacity: 0.2, veil: 0,
  } },
  { progress: 0.28, pose: {
    bloom: 0.38, dissolve: 0, cameraX: -3.0, cameraY: 1.6, cameraZ: 10.2,
    targetX: -0.3, targetY: 0.2, flowerX: -0.9,
    rotationX: -0.14, rotationY: 0.5, keyLight: 3.3, rimLight: 4.2,
    particleSpread: 1.2, particleOpacity: 0.3,
  } },
  { progress: 0.4, pose: {
    bloom: 1, cameraX: 1.4, cameraY: 0.5, cameraZ: 10.4,
    targetX: 0, targetY: 0, flowerX: 0,
    rotationX: -0.25, rotationY: 0.8, rotationZ: 0.12, flowerScale: 1,
    keyLight: 3.1, rimLight: 4.6, particleSpread: 1.4, particleOpacity: 0.4,
  } },
  { progress: 0.49, pose: {
    scatter: 0.56, dissolve: 0.03, cameraX: 0.6, cameraY: 0.2, cameraZ: 11.7,
    flowerX: 0.55, flowerZ: 0.04, rotationX: 0.02, rotationY: 1.1,
    rotationZ: -0.08, flowerScale: 0.95, keyLight: 2.3, rimLight: 3.2,
    coreLight: 4.2, particleSpread: 2.4, particleOpacity: 0.8, veil: 0.12,
  } },
  { progress: 0.6, pose: {
    scatter: 1, dissolve: 0.05, cameraX: 1.5, cameraY: 0.8, cameraZ: 13,
    targetX: 0.5, targetY: 0.1, flowerX: 1.5, flowerZ: 0.1,
    rotationX: 0.15, rotationY: 1.5, rotationZ: -0.2, flowerScale: 0.9,
    keyLight: 1.9, rimLight: 2.6, coreLight: 4.8,
    particleSpread: 3, particleOpacity: 0.9, veil: 0.04,
  } },
  { progress: 0.67, pose: {
    scatter: 0.86, sculpture: 0.32, dissolve: 0.28, flowerX: 1.4,
    rotationX: 0.32, rotationY: 2.2, rotationZ: 0.15, flowerScale: 0.86,
    keyLight: 2.2, rimLight: 3.5, coreLight: 3.1, particleSpread: 2.5, veil: 0,
  } },
  { progress: 0.73, pose: {
    scatter: 0.52, sculpture: 0.74, dissolve: 0.08,
    targetX: 0.35, targetY: 0.15, flowerX: 1.2, flowerY: 0.3, flowerZ: 0.05,
    rotationX: 0.24, rotationY: 2.75, rotationZ: 0.4,
    keyLight: 2.7, rimLight: 4.2, coreLight: 2.4,
    particleSpread: 1.9, particleOpacity: 0.8,
  } },
  { progress: 0.8, pose: {
    scatter: 0, sculpture: 1, dissolve: 0, cameraX: 2.1, cameraY: 1.1, cameraZ: 10.8,
    targetX: 0.25, targetY: 0.2, flowerX: 1, flowerY: 0.6, flowerZ: 0,
    rotationX: 0.12, rotationY: 3.2, rotationZ: 0.6, flowerScale: 0.92,
    keyLight: 3.2, rimLight: 4.8, coreLight: 1.8,
    particleSpread: 1.6, particleOpacity: 0.75,
  } },
  { progress: 0.9, pose: {
    sculpture: 0.26, cameraX: 1.2, cameraY: 0.6, cameraZ: 11.8,
    targetX: 0.2, targetY: 0.15, rotationX: -0.12, rotationY: 4.2,
    rotationZ: 0.1, flowerScale: 1.02, keyLight: 3.6, rimLight: 3.8,
    coreLight: 3.8, particleSpread: 1.25, particleOpacity: 0.45, veil: 0.03,
  } },
  { progress: 1, pose: {
    sculpture: 0, cameraX: 0.6, cameraY: 0.8, cameraZ: 13,
    targetX: 0.1, rotationX: -0.32, rotationY: Math.PI * 2 - 0.22,
    rotationZ: -0.2, flowerScale: 1.05, keyLight: 2.8, rimLight: 3,
    coreLight: 2, particleSpread: 1, particleOpacity: 0.2, veil: 0.18,
  } },
]);

function clampProgress(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function smoothRange(progress: number, start: number, end: number) {
  const value = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return value * value * (3 - 2 * value);
}

/** A compact pulse: exactly zero outside [start, end], with smooth joins. */
function envelope(progress: number, start: number, peak: number, end: number) {
  return smoothRange(progress, start, peak) * (1 - smoothRange(progress, peak, end));
}

function createFrame(): CinematicFrame {
  return {
    ...INITIAL_POSE, progress: 0, chapter: 0, chapterProgress: 0,
    sweep: 0, wave: 0, shock: 0, titleReveal: 0,
    genesisReveal: 0, fractureReveal: 0, rebornReveal: 0,
  };
}

/**
 * Stateless, reversible scroll sampling. Supplying `out` allocates no new objects;
 * seeks, reverse scrolling and repeated samples produce exactly the same pose.
 */
export function sampleCinematic(progress: number, out?: CinematicFrame, reducedMotion = false): CinematicFrame {
  const frame = out ?? createFrame();
  const p = clampProgress(progress);
  let nextIndex = 1;
  while (nextIndex < KEYFRAMES.length - 1 && p > KEYFRAMES[nextIndex].progress) nextIndex += 1;
  const before = KEYFRAMES[nextIndex - 1];
  const after = KEYFRAMES[nextIndex];
  const blend = smoothRange(p, before.progress, after.progress);

  for (let index = 0; index < POSE_FIELDS.length; index += 1) {
    const field = POSE_FIELDS[index];
    frame[field] = before.pose[field] + (after.pose[field] - before.pose[field]) * blend;
  }

  if (p >= 0.6 && p <= 0.8) {
    // A contracting helix, with zero endpoint velocity, stays in front of the
    // geometry while making a complete spiral through the sculpture chapter.
    const travel = smoothRange(p, 0.6, 0.8);
    const angle = travel * Math.PI * 2;
    const radius = 2.2 * (1 - travel * 0.3);
    frame.cameraX = -0.7 + travel * 1.26 + Math.cos(angle) * radius;
    frame.cameraY = 0.8 + travel * 0.3 + Math.sin(angle) * radius * 0.55;
    frame.cameraZ = 13 - travel * 2.2;
  }

  frame.progress = p;
  frame.chapter = Math.min(4, Math.floor(p * 5));
  frame.chapterProgress = Math.min(1, Math.max(0, p * 5 - frame.chapter));
  frame.titleReveal = smoothRange(p, 0.015, 0.12);
  frame.genesisReveal = smoothRange(p, 0.215, 0.29) * (1 - smoothRange(p, 0.375, 0.43));
  frame.fractureReveal = smoothRange(p, 0.41, 0.48) * (1 - smoothRange(p, 0.59, 0.65));
  frame.rebornReveal = smoothRange(p, 0.815, 0.89);
  frame.sweep = Math.min(1, envelope(p, 0.215, 0.29, 0.395) + envelope(p, 0.43, 0.51, 0.6) + envelope(p, 0.65, 0.72, 0.79) * 0.75);
  frame.shock = envelope(p, 0.432, 0.455, 0.5) * 0.85;
  frame.wave = envelope(p, 0.84, 0.895, 0.965);

  if (reducedMotion) {
    // Keep the narrative states readable without camera travel or decorative motion.
    frame.cameraX = 0; frame.cameraY = 0; frame.cameraZ = 12;
    frame.targetX = 0; frame.targetY = 0; frame.targetZ = 0;
    frame.flowerX = 1.1; frame.flowerY = 0.6; frame.flowerZ = 0;
    frame.rotationX = -0.32; frame.rotationY = -0.22; frame.rotationZ = -0.2;
    frame.flowerScale = 1;
    frame.particleSpread = 1; frame.particleOpacity = 0;
    frame.sweep = 0; frame.shock = 0; frame.wave = 0;
  }

  return frame;
}

/** One instance per mounted experience; owns no browser APIs, timers or globals. */
export class CinematicRuntime {
  readonly frame = sampleCinematic(0);
  private readonly listeners = new Set<() => void>();
  private readonly replayListeners = new Set<() => void>();

  update(progress: number, reducedMotion = false): void {
    sampleCinematic(progress, this.frame, reducedMotion);
    this.requestRender();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  requestRender(): void {
    for (const listener of this.listeners) listener();
  }

  onReplay(listener: () => void): () => void {
    this.replayListeners.add(listener);
    return () => { this.replayListeners.delete(listener); };
  }

  resetInteraction(): void {
    for (const listener of this.replayListeners) listener();
    // The scroll owner alone sets progress; a replay request cannot desync it.
    this.requestRender();
  }
}
