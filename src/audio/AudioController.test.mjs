import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// Next's extensionless TS import is resolved only inside this native Node test worker.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "./AudioSignal" && context.parentURL?.endsWith("/AudioController.ts")) {
    return nextResolve(new globalThis.URL("./AudioSignal.ts", context.parentURL).href, context);
  }
  return nextResolve(specifier, context);
} });
const { AudioController } = await import("./AudioController.ts");

const buffer = (duration = 32) => ({ duration, length: Math.round(duration * 22050), numberOfChannels: 1, sampleRate: 22050 });
const response = () => ({ ok: true, headers: { get: () => "16" }, arrayBuffer: async () => new ArrayBuffer(16) });
function deferred() {
  let resolve, reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}
async function until(predicate) {
  for (let index = 0; index < 30 && !predicate(); index += 1) await Promise.resolve();
  assert.ok(predicate(), "expected async stage was reached");
}
class Node {
  connections = [];
  disconnects = 0;
  connect(node) { this.connections.push(node); }
  disconnect() { this.disconnects += 1; }
}
class Source extends Node {
  starts = [];
  stops = 0;
  start(when, offset) { this.starts.push({ when, offset }); }
  stop() { this.stops += 1; }
}
class Context {
  state = "suspended";
  sampleRate = 44100;
  currentTime = 0;
  destination = new Node();
  gain = new Node();
  analyser = new Node();
  sources = [];
  states = new Set();
  resumeCalls = 0;
  suspendCalls = 0;
  closeCalls = 0;
  decodeCalls = 0;
  decodePlans = [];
  spectrumReads = [];
  waveformReads = [];
  constructor() {
    this.gain.gain = { value: 0, setValueAtTime(value) { this.value = value; } };
    this.analyser.getFloatFrequencyData = target => {
      this.spectrumReads.push(target); target.fill(-Infinity);
      for (const frequency of [80, 800, 5000]) target[Math.round(frequency * 2048 / this.sampleRate)] = -24;
    };
    this.analyser.getFloatTimeDomainData = target => {
      this.waveformReads.push(target);
      for (let index = 0; index < target.length; index += 1) target[index] = Math.sin(index * Math.PI * 2 / 32) * 0.15;
    };
  }
  addEventListener(type, listener) { if (type === "statechange") this.states.add(listener); }
  removeEventListener(type, listener) { if (type === "statechange") this.states.delete(listener); }
  emitState(state) { this.state = state; for (const listener of this.states) listener(); }
  createAnalyser() { if (this.failGraph) throw new Error("no graph"); return this.analyser; }
  createGain() { return this.gain; }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  resume() {
    this.resumeCalls += 1;
    if (this.failResume) return Promise.reject(new Error("not allowed"));
    this.emitState("running");
    return this.resumePlan ?? Promise.resolve();
  }
  suspend() { this.suspendCalls += 1; this.emitState("suspended"); return Promise.resolve(); }
  close() { this.closeCalls += 1; this.emitState("closed"); return Promise.resolve(); }
  decodeAudioData(_bytes, success) {
    this.decodeCalls += 1;
    if (this.callbackDecode) { globalThis.queueMicrotask(() => success(buffer())); return; }
    return this.decodePlans.shift() ?? Promise.resolve(buffer());
  }
}
function setup(context = new Context(), fetcher = async () => response()) {
  let creates = 0, fetches = 0;
  const controller = new AudioController({
    createContext: () => { creates += 1; return context; },
    fetch: (...arguments_) => { fetches += 1; return fetcher(...arguments_); },
  });
  return { controller, context, counts: () => ({ creates, fetches }) };
}
function file(name = "A local study.wav", size = 16, type = "audio/wav") {
  return { name, size, type, arrayBuffer: async () => new ArrayBuffer(16) };
}

test("construction is inert; a user start resumes synchronously and creates one ordered looping graph", async () => {
  const { controller, context, counts } = setup();
  const initial = controller.getSnapshot();
  assert.equal(initial.status, "off"); assert.equal(initial.enabled, false);
  assert.equal(controller.getSnapshot(), initial);
  assert.deepEqual(counts(), { creates: 0, fetches: 0 });
  assert.equal(controller.needsUpdate, false);
  const start = controller.start();
  assert.equal(context.resumeCalls, 1, "resume must be invoked before the first await");
  assert.equal(controller.getSnapshot().status, "loading");
  assert.equal(controller.start(), start, "double start joins the same pending operation");
  assert.equal(counts().fetches, 0);
  await start;
  assert.deepEqual(counts(), { creates: 1, fetches: 1 });
  assert.equal(controller.getSnapshot().status, "playing");
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].loop, true);
  assert.equal(context.sources[0].connections[0], context.analyser);
  assert.equal(context.analyser.connections[0], context.gain);
  assert.equal(context.gain.connections[0], context.destination);
  const snapshot = controller.getSnapshot(), frame = controller.frame;
  controller.update(0.1); controller.update(0.1);
  assert.equal(controller.frame, frame); assert.equal(controller.getSnapshot(), snapshot);
  assert.ok(Object.values(frame).every(value => value > 0 && value <= 1));
  assert.equal(context.spectrumReads[0], context.spectrumReads[1]);
  assert.equal(context.waveformReads[0], context.waveformReads[1]);
  controller.dispose();
});

test("pause stops sound immediately, resumes its loop offset, and reuses decoded audio/context", async () => {
  const { controller, context, counts } = setup();
  await controller.start();
  context.currentTime = 5.25; controller.stop();
  assert.equal(context.sources[0].stops, 1);
  assert.equal(context.sources[0].disconnects, 1);
  assert.equal(context.gain.gain.value, 0);
  assert.equal(controller.getSnapshot().status, "paused");
  await controller.start();
  assert.equal(context.sources[1].starts[0].offset, 5.25);
  assert.equal(context.decodeCalls, 1);
  assert.deepEqual(counts(), { creates: 1, fetches: 1 });
  context.currentTime = 100; controller.stop(); await controller.start();
  assert.equal(context.sources[2].starts[0].offset, 4);
  controller.dispose();
});

test("volume zero and stop settle visuals to zero, metadata/frame subscriptions clean up independently", async () => {
  const { controller, context } = setup();
  let metadata = 0, frames = 0;
  const stopMetadata = controller.subscribe(() => { metadata += 1; });
  const stopFrames = controller.subscribeFrame(() => { frames += 1; });
  await controller.start(); controller.update(0.2);
  const reads = context.spectrumReads.length;
  controller.setVolume(0);
  for (let index = 0; index < 30; index += 1) controller.update(0.1);
  assert.equal(context.spectrumReads.length, reads, "mute skips analyser reads");
  assert.deepEqual(controller.frame, { low: 0, mid: 0, high: 0, envelope: 0 });
  assert.equal(context.gain.gain.value, 0);
  controller.stop(); assert.equal(controller.needsUpdate, false);
  const metadataBefore = metadata, framesBefore = frames;
  stopMetadata(); stopMetadata(); stopFrames(); stopFrames();
  controller.setVolume(100); controller.update(0.1);
  assert.equal(controller.getSnapshot().volume, 1);
  controller.setVolume(NaN); assert.equal(controller.getSnapshot().volume, 0);
  controller.dispose();
  assert.equal(metadata, metadataBefore); assert.equal(frames, framesBefore);
});

test("stopping a fetch or a pending resume prevents late decoding and autoplay", async () => {
  const resume = deferred(), context = new Context(); context.resumePlan = resume.promise;
  const first = setup(context);
  const starting = first.controller.start(); first.controller.stop(); resume.resolve(); await starting;
  assert.equal(first.counts().fetches, 0); assert.equal(context.sources.length, 0);
  first.controller.dispose();
  let signal;
  const second = setup(new Context(), async (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
  });
  const loading = second.controller.start();
  await until(() => !!signal); second.controller.stop(); await loading;
  assert.equal(signal.aborted, true);
  assert.equal(second.context.decodeCalls, 0);
  assert.equal(second.controller.getSnapshot().status, "paused");
  second.controller.dispose();
});

test("a newer local-file decode wins over stale loading and dispose cancels late completions", async () => {
  const delayed = deferred(), context = new Context(); context.decodePlans.push(delayed.promise);
  const { controller } = setup(context);
  const old = controller.start(); await until(() => context.decodeCalls === 1);
  await controller.loadFile(file());
  assert.equal(controller.getSnapshot().source, "local");
  assert.equal(controller.getSnapshot().title, "A local study");
  assert.equal(context.sources.length, 1);
  delayed.resolve(buffer()); await old;
  assert.equal(context.sources.length, 1);
  assert.equal(controller.getSnapshot().source, "local");
  const pending = deferred(); context.decodePlans.push(pending.promise);
  const local = controller.loadFile(file("Later.wav")); await until(() => context.decodeCalls === 3);
  controller.dispose(); pending.resolve(buffer()); await local;
  assert.equal(context.sources.length, 1);
  assert.equal(context.states.size, 0);
  assert.equal(context.closeCalls, 1);
  assert.equal(controller.getSnapshot().status, "off");
});

test("invalid files, decode failures, fetch failures and unsupported browsers resolve into recoverable states", async () => {
  const { controller, context, counts } = setup();
  await controller.loadFile(file("big.wav", 13 * 1024 * 1024));
  assert.equal(controller.getSnapshot().status, "error");
  assert.deepEqual(counts(), { creates: 0, fetches: 0 });
  await controller.loadFile(file("notes.txt", 16, "text/plain"));
  assert.equal(counts().creates, 0);
  context.decodePlans.push(Promise.resolve(buffer(121)));
  await controller.loadFile(file());
  assert.match(controller.getSnapshot().error, /two minutes/);
  context.decodePlans.push(Promise.reject(new Error("bad decoder")));
  await controller.loadFile(file());
  assert.match(controller.getSnapshot().error, /decoded/);
  await controller.start();
  assert.equal(controller.getSnapshot().status, "playing");
  assert.equal(controller.getSnapshot().source, "built-in");
  controller.dispose();
  const offline = setup(new Context(), async () => ({ ...response(), ok: false }));
  await offline.controller.start(); assert.equal(offline.controller.getSnapshot().status, "error");
  offline.controller.dispose();
  const blockedContext = new Context(); blockedContext.failResume = true;
  const blocked = setup(blockedContext);
  await blocked.controller.start(); assert.equal(blocked.controller.getSnapshot().status, "error");
  assert.equal(blocked.counts().fetches, 0);
  blockedContext.failResume = false;
  await blocked.controller.start(); assert.equal(blocked.controller.getSnapshot().status, "playing");
  blocked.controller.dispose();
  const unsupported = new AudioController({ createContext: () => null });
  await unsupported.start(); assert.equal(unsupported.getSnapshot().status, "unavailable"); unsupported.dispose();
});

test("graph initialization failures release the context and a later gesture can retry", async () => {
  const broken = new Context(); broken.failGraph = true;
  const healthy = new Context(); let tries = 0;
  const controller = new AudioController({ createContext: () => tries++ === 0 ? broken : healthy, fetch: async () => response() });
  await controller.start();
  assert.equal(controller.getSnapshot().status, "error");
  assert.equal(broken.closeCalls, 1);
  await controller.start();
  assert.equal(controller.getSnapshot().status, "playing");
  assert.equal(healthy.sources.length, 1);
  controller.dispose();
});

test("device/Safari interruptions pause with a visual release and never resume without a gesture", async () => {
  const { controller, context } = setup();
  await controller.start(); controller.update(0.2);
  const resumes = context.resumeCalls;
  context.currentTime = 3; context.emitState("interrupted");
  assert.equal(controller.getSnapshot().status, "paused");
  assert.equal(context.sources[0].stops, 1);
  for (let index = 0; index < 30; index += 1) controller.update(0.1);
  assert.deepEqual(controller.frame, { low: 0, mid: 0, high: 0, envelope: 0 });
  assert.equal(context.resumeCalls, resumes);
  assert.equal(controller.needsUpdate, false);
  await controller.start();
  assert.equal(controller.getSnapshot().status, "playing");
  assert.equal(context.sources[1].starts[0].offset, 3);
  controller.dispose(); assert.equal(context.states.size, 0);
});

test("default factory supports webkitAudioContext and callback decoding without eager access", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  const originalWebkit = Object.getOwnPropertyDescriptor(globalThis, "webkitAudioContext");
  let creates = 0;
  const context = new Context(); context.callbackDecode = true;
  Object.defineProperty(globalThis, "AudioContext", { value: undefined, configurable: true });
  Object.defineProperty(globalThis, "webkitAudioContext", { value: class { constructor() { creates += 1; return context; } }, configurable: true });
  try {
    const controller = new AudioController({ fetch: async () => response() });
    assert.equal(creates, 0);
    await controller.start();
    assert.equal(creates, 1); assert.equal(controller.getSnapshot().status, "playing");
    controller.dispose();
  } finally {
    if (original) Object.defineProperty(globalThis, "AudioContext", original); else delete globalThis.AudioContext;
    if (originalWebkit) Object.defineProperty(globalThis, "webkitAudioContext", originalWebkit); else delete globalThis.webkitAudioContext;
  }
});
