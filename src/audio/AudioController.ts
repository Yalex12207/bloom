import { AudioSignal, type AudioFrame } from "./AudioSignal";

export type { AudioFrame } from "./AudioSignal";
export type AudioStatus = "off" | "loading" | "playing" | "paused" | "error" | "unavailable";
export type AudioSource = "built-in" | "local";

export interface AudioSnapshot {
  readonly status: AudioStatus;
  readonly enabled: boolean;
  readonly title: string;
  readonly volume: number;
  readonly error: string | null;
  readonly source: AudioSource;
}

/** Optional dependencies keep lifecycle tests independent of a real browser/device. */
export interface AudioEnvironment {
  createContext: () => AudioContext | null;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

const BUILT_IN_URL = "/audio/bloom-study-v1.wav";
const BUILT_IN_TITLE = "BLOOM — Study No. 1";
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_DECODED_BYTES = 48 * 1024 * 1024;
const MAX_DURATION = 120;
const FILE_EXTENSION = /\.(wav|wave|mp3|ogg|oga|opus|m4a|aac|webm|flac)$/i;
const AUDIO_MIME = /^(audio\/(mpeg|mp3|wav|wave|x-wav|ogg|opus|mp4|aac|webm|flac|x-flac)|application\/ogg)$/i;

function defaultContext(): AudioContext | null {
  const host = globalThis as typeof globalThis & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Constructor = host.AudioContext ?? host.webkitAudioContext;
  return Constructor ? new Constructor() : null;
}

function defaultFetch(url: string, init?: RequestInit) {
  return globalThis.fetch(url, init);
}

function volumeValue(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function validBuffer(buffer: AudioBuffer) {
  return Number.isFinite(buffer.duration) && buffer.duration > 0 && buffer.duration <= MAX_DURATION
    && buffer.numberOfChannels > 0 && buffer.numberOfChannels <= 2
    && buffer.sampleRate > 0 && buffer.sampleRate <= 96000
    && Number.isFinite(buffer.length) && buffer.length > 0
    && buffer.length * buffer.numberOfChannels * 4 <= MAX_DECODED_BYTES;
}

/** Support both Promise and legacy WebKit callback forms without decoding twice. */
function decode(context: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    try {
      const result = context.decodeAudioData(bytes, resolve, reject);
      if (result) void result.then(resolve, reject);
    } catch (error) { reject(error); }
  });
}

/**
 * One lazily created graph: source → analyser → gain → destination.
 * Construction, imports and subscription never create an AudioContext or fetch.
 * start/loadFile call resume synchronously, inside their caller's user gesture.
 */
export class AudioController {
  readonly frame: AudioFrame = { low: 0, mid: 0, high: 0, envelope: 0 };
  private snapshot: AudioSnapshot = {
    status: "off", enabled: false, title: BUILT_IN_TITLE, volume: 0.55, error: null, source: "built-in",
  };
  private readonly environment: AudioEnvironment;
  private readonly listeners = new Set<() => void>();
  private readonly frameListeners = new Set<() => void>();
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gain: GainNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private signal: AudioSignal | null = null;
  private offset = 0;
  private startedAt = 0;
  private generation = 0;
  private abort: AbortController | null = null;
  private pending: Promise<void> | null = null;
  private readonly contextStateChanged = () => {
    // Safari/device interruptions require another explicit gesture; never resume here.
    if (this.snapshot.status === "playing" && this.context?.state !== "running") this.stop();
  };

  constructor(environment: Partial<AudioEnvironment> = {}) {
    this.environment = { createContext: environment.createContext ?? defaultContext, fetch: environment.fetch ?? defaultFetch };
  }

  getSnapshot = (): AudioSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  subscribeFrame = (listener: () => void): (() => void) => {
    this.frameListeners.add(listener);
    return () => { this.frameListeners.delete(listener); };
  };

  get needsUpdate(): boolean {
    return this.snapshot.status === "playing"
      || this.frame.low > 0 || this.frame.mid > 0 || this.frame.high > 0 || this.frame.envelope > 0;
  }

  start(): Promise<void> {
    if (this.snapshot.status === "playing" && this.context?.state === "running") return Promise.resolve();
    if (this.snapshot.status === "loading" && this.pending) return this.pending;
    const generation = this.cancelOperation(true);
    if (!this.buffer) this.publish({ title: BUILT_IN_TITLE, source: "built-in" });
    return this.begin(generation, null);
  }

  stop(): void {
    this.cancelOperation(true);
    this.silence();
    const context = this.context;
    this.publish({ status: this.snapshot.status === "off" ? "off" : "paused", enabled: false, error: null });
    if (context && context.state !== "closed") void context.suspend().catch(() => {});
  }

  setVolume(value: number): void {
    const volume = volumeValue(value);
    if (this.gain && this.context) this.gain.gain.setValueAtTime(volume, this.context.currentTime);
    this.publish({ volume });
  }

  loadFile(file: File): Promise<void> {
    const generation = this.cancelOperation(true);
    if (!file || !Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_FILE_BYTES) {
      this.fail("Choose an audio file up to 12 MB.");
      return Promise.resolve();
    }
    if (!AUDIO_MIME.test(file.type) && !FILE_EXTENSION.test(file.name)) {
      this.fail("Choose WAV, MP3, OGG, M4A, AAC, WebM or FLAC audio.");
      return Promise.resolve();
    }
    this.buffer = null;
    this.offset = 0;
    this.publish({ title: file.name.replace(/\.[^.]+$/, "").slice(0, 72) || "LOCAL AUDIO", source: "local" });
    return this.begin(generation, file);
  }

  update(deltaSeconds: number): void {
    if (this.snapshot.status === "playing" && this.context?.state !== "running") this.stop();
    const active = this.snapshot.status === "playing" && this.snapshot.volume > 0;
    if (active && this.analyser && this.signal) {
      try {
        this.analyser.getFloatFrequencyData(this.signal.frequencies);
        this.analyser.getFloatTimeDomainData(this.signal.waveform);
      } catch {
        this.fail("Audio analysis was interrupted. Press play to try again.");
      }
    }
    if (this.signal) this.signal.update(deltaSeconds, this.snapshot.status === "playing", this.snapshot.volume);
    for (const listener of this.frameListeners) listener();
  }

  /** Release device/GPU-independent audio resources; a later user gesture may start afresh. */
  dispose(): void {
    this.cancelOperation(false);
    this.silence();
    this.analyser?.disconnect();
    this.gain?.disconnect();
    const context = this.context;
    context?.removeEventListener?.("statechange", this.contextStateChanged);
    this.context = null; this.analyser = null; this.gain = null;
    this.buffer = null; this.offset = 0;
    this.signal?.reset(); this.signal = null;
    this.frame.low = 0; this.frame.mid = 0; this.frame.high = 0; this.frame.envelope = 0;
    if (context && context.state !== "closed") void context.close().catch(() => {});
    this.publish({ status: "off", enabled: false, title: BUILT_IN_TITLE, source: "built-in", error: null });
    for (const listener of this.frameListeners) listener();
    this.listeners.clear(); this.frameListeners.clear();
  }

  private ensureContext() {
    if (this.context?.state === "closed") {
      this.context.removeEventListener?.("statechange", this.contextStateChanged);
      this.analyser?.disconnect(); this.gain?.disconnect();
      this.context = null; this.analyser = null; this.gain = null;
    }
    if (this.context) return this.context;
    const context = this.environment.createContext();
    if (!context) return null;
    this.context = context;
    try {
      const analyser = context.createAnalyser();
      this.analyser = analyser;
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      analyser.minDecibels = -90; analyser.maxDecibels = -12;
      const gain = context.createGain();
      this.gain = gain;
      gain.gain.setValueAtTime(this.snapshot.volume, context.currentTime);
      analyser.connect(gain); gain.connect(context.destination);
      this.signal = new AudioSignal(context.sampleRate, 2048, this.frame);
      context.addEventListener?.("statechange", this.contextStateChanged);
      return context;
    } catch (error) {
      this.analyser?.disconnect(); this.gain?.disconnect();
      this.context = null; this.analyser = null; this.gain = null;
      if (context.state !== "closed") void context.close().catch(() => {});
      throw error;
    }
  }

  private begin(generation: number, file: File | null): Promise<void> {
    try {
      const context = this.ensureContext();
      if (!context) {
        this.publish({ status: "unavailable", enabled: false, error: "Audio is unavailable in this browser." });
        return Promise.resolve();
      }
      // This call precedes every await, so browsers retain the initiating gesture.
      const resumed = context.resume();
      this.publish({ status: "loading", enabled: true, error: null });
      const operation = this.run(generation, context, resumed, file);
      this.pending = operation;
      void operation.then(() => { if (this.pending === operation) this.pending = null; });
      return operation;
    } catch {
      this.fail("Audio could not start. Press play to try again.");
      return Promise.resolve();
    }
  }

  private async run(generation: number, context: AudioContext, resumed: Promise<void>, file: File | null): Promise<void> {
    try {
      await resumed;
      if (!this.current(generation, context)) return;
      let buffer = this.buffer;
      if (!buffer) {
        let bytes: ArrayBuffer;
        if (file) {
          bytes = await file.arrayBuffer();
        } else {
          const abort = new AbortController();
          this.abort = abort;
          const response = await this.environment.fetch(BUILT_IN_URL, { signal: abort.signal });
          if (!response.ok) throw new Error("fetch");
          const length = Number(response.headers.get("content-length"));
          if (length > MAX_FILE_BYTES) throw new Error("size");
          bytes = await response.arrayBuffer();
        }
        if (!this.current(generation, context)) return;
        if (bytes.byteLength === 0 || bytes.byteLength > MAX_FILE_BYTES) throw new Error("size");
        buffer = await decode(context, bytes);
        if (!this.current(generation, context)) return;
        if (!validBuffer(buffer)) throw new Error("duration");
        this.buffer = buffer;
        this.offset = 0;
      }
      if (!this.current(generation, context) || !this.analyser || !this.gain) return;
      this.abort = null;
      const source = context.createBufferSource();
      source.buffer = buffer; source.loop = true;
      source.connect(this.analyser);
      this.sourceNode = source;
      this.gain.gain.setValueAtTime(this.snapshot.volume, context.currentTime);
      this.offset %= buffer.duration;
      this.startedAt = context.currentTime;
      source.start(0, this.offset);
      this.publish({ status: "playing", enabled: true, error: null });
    } catch (error) {
      if (!this.current(generation, context)) return;
      const message = error instanceof Error ? error.message : "";
      this.fail(message === "duration" ? "Choose audio up to two minutes, mono or stereo, under 48 MB decoded."
        : file ? "This audio file could not be decoded. Choose another file."
          : "The soundtrack could not load. Press play to try again.");
    }
  }

  private current(generation: number, context: AudioContext) {
    return generation === this.generation && context === this.context;
  }

  private cancelOperation(saveOffset: boolean) {
    this.generation += 1;
    this.abort?.abort(); this.abort = null; this.pending = null;
    const source = this.sourceNode;
    this.sourceNode = null;
    if (source) {
      if (saveOffset && this.buffer && this.context) {
        this.offset = (this.offset + Math.max(0, this.context.currentTime - this.startedAt)) % this.buffer.duration;
      }
      source.onended = null;
      try { source.stop(); } catch { /* A failed start has already stopped this node. */ }
      source.disconnect();
    }
    return this.generation;
  }

  private silence() {
    if (this.gain && this.context) this.gain.gain.setValueAtTime(0, this.context.currentTime);
  }

  private fail(error: string) {
    this.cancelOperation(true);
    this.silence();
    this.publish({ status: "error", enabled: false, error });
    if (this.context && this.context.state !== "closed") void this.context.suspend().catch(() => {});
  }

  private publish(patch: Partial<AudioSnapshot>) {
    const previous = this.snapshot;
    const next = { ...previous, ...patch };
    if (previous.status === next.status && previous.enabled === next.enabled && previous.title === next.title
      && previous.volume === next.volume && previous.error === next.error && previous.source === next.source) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}
