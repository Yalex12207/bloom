import assert from "node:assert/strict";
import test from "node:test";
import { AudioSignal } from "./AudioSignal.ts";

function tone(signal, frequency, amplitude = 0.2) {
  signal.frequencies.fill(-Infinity);
  signal.frequencies[Math.round(frequency * signal.fftSize / signal.sampleRate)] = -24;
  for (let index = 0; index < signal.waveform.length; index += 1) {
    signal.waveform[index] = Math.sin(index * Math.PI * 2 / 32) * amplitude;
  }
}

test("native FFT bins distinguish the low, mid and high frequency ranges", () => {
  const signal = new AudioSignal(44100);
  const output = signal.frame;
  for (const [frequency, field] of [[80, "low"], [800, "mid"], [5000, "high"]]) {
    signal.reset(); tone(signal, frequency);
    assert.equal(signal.update(1), output);
    assert.ok(output[field] > 0.2);
    for (const other of ["low", "mid", "high"]) if (other !== field) assert.equal(output[other], 0);
    assert.ok(output.envelope > 0.5);
  }
  tone(signal, 12_000);
  signal.reset(); tone(signal, 12_000);
  signal.update(1);
  assert.equal(output.low + output.mid + output.high, 0);
});

test("attack and release are frame-rate independent and reuse all buffers", () => {
  const a = new AudioSignal(22050, 1024), b = new AudioSignal(22050, 1024);
  const frequencies = a.frequencies, waveform = a.waveform;
  tone(a, 400); tone(b, 400);
  for (let index = 0; index < 24; index += 1) a.update(1 / 24);
  for (let index = 0; index < 120; index += 1) b.update(1 / 120);
  for (const field of Object.keys(a.frame)) assert.ok(Math.abs(a.frame[field] - b.frame[field]) < 1e-12);
  const peak = a.frame.mid;
  a.update(0.04, false);
  assert.ok(a.frame.mid > peak * 0.8, "release should be gentler than attack");
  b.update(0.04, false);
  for (let index = 0; index < 24; index += 1) a.update(1 / 24, false);
  for (let index = 0; index < 120; index += 1) b.update(1 / 120, false);
  for (const field of Object.keys(a.frame)) assert.ok(Math.abs(a.frame[field] - b.frame[field]) < 1e-12);
  assert.equal(a.frequencies, frequencies); assert.equal(a.waveform, waveform);
});

test("mute, inactivity and malformed input remain finite and settle exactly to rest", () => {
  const signal = new AudioSignal(NaN);
  tone(signal, 100); signal.update(0.2);
  const before = { ...signal.frame };
  signal.update(NaN); signal.update(-1); signal.update(Infinity);
  assert.deepEqual(signal.frame, before);
  for (let index = 0; index < 30; index += 1) signal.update(0.1, true, 0);
  assert.deepEqual(signal.frame, { low: 0, mid: 0, high: 0, envelope: 0 });
  signal.frequencies.fill(NaN); signal.waveform.fill(Infinity);
  signal.update(1, true, 1);
  assert.deepEqual(signal.frame, { low: 0, mid: 0, high: 0, envelope: 0 });
  signal.waveform.fill(0.4); signal.update(1);
  assert.equal(signal.frame.envelope, 0, "DC offset is not an audible RMS envelope");
  signal.frequencies.fill(30); signal.waveform[2] = -2;
  signal.update(1, true, 100);
  assert.ok(Object.values(signal.frame).every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  signal.reset();
  assert.deepEqual(signal.frame, { low: 0, mid: 0, high: 0, envelope: 0 });
});
