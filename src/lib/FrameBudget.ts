export type QualityTier = "high" | "balanced" | "economy";

/** Sustained frame cost lowers quality, never oscillates after a single slow frame. */
export class FrameBudget {
  private current: QualityTier;
  private warmup = 0;
  private elapsed = 0;
  private frames = 0;
  private slowWindows = 0;
  private readonly mobile: boolean;

  constructor(mobile: boolean) {
    this.mobile = mobile;
    this.current = mobile ? "balanced" : "high";
  }

  get tier(): QualityTier { return this.current; }

  sample(deltaSeconds: number): QualityTier {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return this.current;
    if (deltaSeconds > 0.25) {
      this.elapsed = 0; this.frames = 0; this.slowWindows = 0;
      return this.current;
    }
    if (this.warmup < 2) { this.warmup += deltaSeconds; return this.current; }
    if (this.current === "economy") return this.current;
    this.elapsed += deltaSeconds;
    this.frames += 1;
    if (this.elapsed < 1.5) return this.current;
    const average = this.elapsed / this.frames;
    const threshold = this.current === "high" ? 1 / 42 : this.mobile ? 1 / 27 : 1 / 29;
    this.slowWindows = average > threshold ? this.slowWindows + 1 : 0;
    this.elapsed = 0; this.frames = 0;
    if (this.slowWindows >= 2) {
      this.current = this.current === "high" ? "balanced" : "economy";
      this.slowWindows = 0;
    }
    return this.current;
  }
}

export function qualitySettings(tier: QualityTier, mobile: boolean) {
  if (tier === "economy") return { dprMax: mobile ? 0.85 : 1, effects: false, particleFactor: 0.4, transmission: false };
  if (mobile) return { dprMax: 1.15, effects: false, particleFactor: 0.75, transmission: false };
  if (tier === "balanced") return { dprMax: 1.2, effects: false, particleFactor: 0.75, transmission: true };
  return { dprMax: 1.5, effects: true, particleFactor: 1, transmission: true };
}
