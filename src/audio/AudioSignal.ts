export interface AudioFrame {
  low: number;
  mid: number;
  high: number;
  envelope: number;
}

function unit(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** Reusable FFT/time-domain storage and a clock-independent attack/release follower. */
export class AudioSignal {
  readonly frame: AudioFrame;
  readonly frequencies: Float32Array<ArrayBuffer>;
  readonly waveform: Float32Array<ArrayBuffer>;
  readonly fftSize: number;
  readonly sampleRate: number;
  private readonly lowStart: number;
  private readonly lowEnd: number;
  private readonly midStart: number;
  private readonly midEnd: number;
  private readonly highStart: number;
  private readonly highEnd: number;

  constructor(sampleRate = 44100, fftSize: 1024 | 2048 = 2048, frame?: AudioFrame) {
    this.sampleRate = Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 44100;
    this.fftSize = fftSize === 1024 ? 1024 : 2048;
    this.frame = frame ?? { low: 0, mid: 0, high: 0, envelope: 0 };
    this.frequencies = new Float32Array(this.fftSize / 2);
    this.waveform = new Float32Array(this.fftSize);
    const bin = this.sampleRate / this.fftSize;
    const count = this.frequencies.length;
    this.lowStart = Math.min(count, Math.ceil(20 / bin));
    this.lowEnd = Math.min(count, Math.ceil(180 / bin));
    this.midStart = Math.min(count, Math.ceil(180 / bin));
    this.midEnd = Math.min(count, Math.ceil(2200 / bin));
    this.highStart = Math.min(count, Math.ceil(2200 / bin));
    this.highEnd = Math.min(count, Math.ceil(9000 / bin));
    this.frequencies.fill(Number.NEGATIVE_INFINITY);
  }

  /** Frequencies contain native analyser dB values; waveform contains [-1, 1] samples. */
  update(deltaSeconds: number, active = true, volume = 1): AudioFrame {
    const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    const gain = active ? unit(volume) : 0;
    const low = gain > 0 ? this.band(this.lowStart, this.lowEnd) * gain : 0;
    const mid = gain > 0 ? this.band(this.midStart, this.midEnd) * gain : 0;
    const high = gain > 0 ? this.band(this.highStart, this.highEnd) * gain : 0;
    let envelope = 0;

    if (gain > 0) {
      let sum = 0;
      let squares = 0;
      for (let index = 0; index < this.waveform.length; index += 1) {
        const sample = this.waveform[index];
        const value = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
        sum += value;
        squares += value * value;
      }
      const mean = sum / this.waveform.length;
      envelope = unit(Math.sqrt(Math.max(0, squares / this.waveform.length - mean * mean)) * 4.2) * gain;
    }

    this.frame.low = this.follow(this.frame.low, low, delta);
    this.frame.mid = this.follow(this.frame.mid, mid, delta);
    this.frame.high = this.follow(this.frame.high, high, delta);
    this.frame.envelope = this.follow(this.frame.envelope, envelope, delta);
    return this.frame;
  }

  reset(): void {
    this.frame.low = 0; this.frame.mid = 0; this.frame.high = 0; this.frame.envelope = 0;
    this.frequencies.fill(Number.NEGATIVE_INFINITY);
    this.waveform.fill(0);
  }

  private band(start: number, end: number) {
    let power = 0;
    for (let index = start; index < end; index += 1) {
      const decibels = this.frequencies[index];
      if (Number.isFinite(decibels)) power += Math.pow(10, Math.min(0, decibels) / 10);
    }
    return unit(Math.sqrt(power) * 4.8);
  }

  private follow(previous: number, target: number, delta: number) {
    const current = unit(previous);
    const next = current + (unit(target) - current) * (1 - Math.exp(-delta / (target > current ? 0.04 : 0.25)));
    return next < 0.0001 ? 0 : unit(next);
  }
}
