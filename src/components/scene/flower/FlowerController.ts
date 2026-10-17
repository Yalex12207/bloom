export type FlowerState = "CLOSED" | "BLOOMING" | "OPEN";
export type PetalLayer = "inner" | "middle" | "outer";

export interface PetalDescriptor {
  id: number;
  layer: PetalLayer;
  angle: number;
  radius: number;
  length: number;
  width: number;
  bend: number;
  /** A normalized opening delay. Remap [delay, 1] to [0, 1] per petal. */
  delay: number;
  /** A small local twist, in addition to the radial angle. */
  rotation: number;
  scale: number;
  /** A displacement from the rest position, rather than a world position. */
  burst: readonly [number, number, number];
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/** Mulberry32 keeps the sculpture identical across reloads and render passes. */
function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPetalDescriptors(seed: number, mobile: boolean): PetalDescriptor[] {
  const random = seededRandom(seed);
  const petals: PetalDescriptor[] = [];
  const layers: readonly PetalLayer[] = ["inner", "middle", "outer"];
  const counts = mobile ? [6, 9, 12] : [9, 14, 19];
  const lengths = [1.18, 1.78, 2.35];
  const widths = [0.68, 0.96, 1.15];
  const radii = [0.12, 0.18, 0.24];
  const bends = [0.42, 0.28, 0.15];

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    const count = counts[layerIndex];
    const phase = layerIndex * 0.37 + (layerIndex % 2) * Math.PI / count;

    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2 + phase + (random() - 0.5) * 0.09;
      const throwDistance = 0.48 + layerIndex * 0.2 + random() * 0.36;
      petals.push({
        id: petals.length,
        layer: layers[layerIndex],
        angle,
        radius: radii[layerIndex] + random() * 0.035,
        length: lengths[layerIndex] * (0.94 + random() * 0.12),
        width: widths[layerIndex] * (0.93 + random() * 0.14),
        bend: bends[layerIndex] + (random() - 0.5) * 0.07,
        delay: layerIndex * 0.105 + random() * 0.075,
        rotation: (random() - 0.5) * 0.14,
        scale: 0.96 + random() * 0.08,
        burst: [
          -Math.sin(angle) * throwDistance,
          Math.cos(angle) * throwDistance,
          0.24 + random() * 0.56,
        ],
      });
    }
  }

  return petals;
}

/**
 * The mutable animation clock lives outside React state. One controller is reused
 * for the lifetime of a flower; update() creates no objects and starts no timers.
 */
export class FlowerController {
  state: FlowerState;
  openness: number;
  target: number;
  elapsed = 0;
  pulse = 0;
  pulseAge = Number.POSITIVE_INFINITY;
  charge = 0;
  burst = 0;
  burstAge = Number.POSITIVE_INFINITY;
  isCharging = false;

  private burstStrength = 0;

  constructor(initial: FlowerState = "BLOOMING") {
    this.state = initial;
    this.openness = initial === "OPEN" ? 1 : 0;
    this.target = initial === "CLOSED" ? 0 : 1;
  }

  setState(state: FlowerState) {
    this.state = state;
    this.target = state === "CLOSED" ? 0 : 1;
  }

  setProgress(progress: number) {
    this.target = clamp01(progress);
    this.state = this.target === 0 ? "CLOSED" : "BLOOMING";
  }

  captureOpenness(openness: number) {
    this.openness = clamp01(openness);
  }

  resetInteraction() {
    this.cancelCharge();
    this.pulse = 0; this.pulseAge = Number.POSITIVE_INFINITY;
    this.burst = 0; this.burstAge = Number.POSITIVE_INFINITY;
    this.burstStrength = 0;
  }

  triggerPulse() {
    this.pulseAge = 0;
    this.pulse = 0;
  }

  beginCharge() {
    this.isCharging = true;
    this.charge = 0;
  }

  releaseCharge(): "pulse" | "burst" {
    const charged = this.isCharging && this.charge >= 0.24;
    this.isCharging = false;

    if (charged) {
      this.burstStrength = 0.55 + this.charge * 0.45;
      this.burstAge = 0;
      this.burst = 0;
      this.triggerPulse();
    } else {
      this.triggerPulse();
    }

    this.charge = 0;
    return charged ? "burst" : "pulse";
  }

  cancelCharge() {
    this.isCharging = false;
    this.charge = 0;
  }

  update(delta: number, reducedMotion = false) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    // Prevent a resumed hidden tab from jumping through a whole interaction.
    const step = Math.min(delta, 0.1);
    this.elapsed += step;

    if (reducedMotion) {
      this.openness = this.target;
    } else {
      this.openness += (this.target - this.openness) * (1 - Math.exp(-step * 1.85));
      if (Math.abs(this.target - this.openness) < 0.00015) this.openness = this.target;
    }

    if (this.target === 1 && this.openness === 1) this.state = "OPEN";
    if (this.isCharging) this.charge = Math.min(1, this.charge + step / 1.05);

    this.pulseAge += step;
    if (this.pulseAge < 1.55) {
      this.pulse = Math.sin(Math.PI * this.pulseAge / 1.55);
    } else {
      this.pulse = 0;
    }

    this.burstAge += step;
    if (this.burstAge < 1.5) {
      // Fast release, then a gentle, exactly bounded return to the rest pose.
      const phase = this.burstAge / 1.5;
      this.burst = Math.sin(Math.PI * Math.pow(phase, 0.55)) * this.burstStrength;
    } else {
      this.burst = 0;
    }
  }
}
