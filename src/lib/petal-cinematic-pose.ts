import type { PetalDescriptor } from "../components/scene/flower/FlowerController";
import type { CinematicFrame } from "./cinematic-state";

export interface PetalPose { x: number; y: number; z: number; rx: number; ry: number; rz: number; angle: number; scale: number; morph: number }
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Reversible geometry choreography. No clocks, timers, Mesh creation, or random calls. */
export function samplePetalPose(petal: PetalDescriptor, index: number, frame: CinematicFrame, out: PetalPose): PetalPose {
  const phase = clamp((frame.bloom - petal.delay) / (1 - petal.delay));
  const open = phase * phase * (3 - 2 * phase);
  const layer = petal.layer === "inner" ? 0 : petal.layer === "middle" ? 1 : 2;
  const scatter = frame.scatter;
  const sculpture = frame.sculpture;
  const radius = petal.radius * (0.38 + open * 0.62);
  const arc = Math.sin(scatter * Math.PI);
  const x = -Math.sin(petal.angle) * radius + petal.burst[0] * scatter * 2.9 + Math.cos(petal.angle + 0.7) * arc * 0.45;
  const y = Math.cos(petal.angle) * radius + petal.burst[1] * scatter * 2.9 + Math.sin(petal.angle + 0.7) * arc * 0.45;
  // Both sides of the real text plane: foreground petals write depth; others pass behind.
  const z = 0.14 - layer * 0.12 + (index % 2 ? -1 : 1) * petal.burst[2] * scatter * 2.9;
  const helix = index * 2.399963 + frame.progress * Math.PI * 2;
  const sculptureRadius = 0.47 + layer * 0.14;
  out.x = mix(x, Math.cos(helix) * sculptureRadius, sculpture);
  out.y = mix(y, Math.sin(helix) * sculptureRadius, sculpture);
  out.z = mix(z, Math.sin(index * 0.7) * 0.4, sculpture);
  out.angle = mix(petal.angle, helix + Math.PI / 2, sculpture);
  out.rx = mix((1 - open) * 1.12 + petal.bend * 0.17 + scatter * Math.sin(index * 1.8) * 1.1, 1.1 + Math.sin(index) * 0.42, sculpture);
  out.ry = mix(petal.rotation + scatter * Math.cos(index * 2.1) * 1.3, index * 0.27, sculpture);
  out.rz = mix(petal.rotation * 0.2 + scatter * Math.sin(index) * 0.7, Math.sin(index * 0.3) * 0.3, sculpture);
  out.scale = 1 - sculpture * 0.42;
  out.morph = clamp(mix((1 - open) * 0.85 + petal.bend * 0.12, 0.62 + Math.sin(index * 0.9) * 0.1, sculpture));
  return out;
}
