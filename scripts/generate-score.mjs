/**
 * BLOOM — Study in becoming, v1.
 * Original procedural composition; no recordings, samples, or external assets.
 * Run from any directory: node /path/to/bloom/scripts/generate-score.mjs
 * All oscillators and envelopes are periodic over the 32-second loop.
 */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import console from "node:console";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = resolve(root, "public/audio/bloom-study-v1.wav");
const sampleRate = 22_050;
const duration = 32;
const frames = sampleRate * duration;
const tau = Math.PI * 2;
const targetPeak = 0.32;
const score = new Float64Array(frames);

// A fixed seed only chooses oscillator phases; the music is always identical.
let seed = 0x424c4f4d;
function random() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4_294_967_296;
}

// Quantization to whole loop cycles avoids a phase discontinuity at the seam.
const frequency = (hz) => Math.round(hz * duration) / duration;
const chords = [
  [130.8128, 155.5635, 195.9977, 233.0819], // C minor seventh
  [103.8262, 155.5635, 195.9977, 261.6256], // A-flat major seventh
  [155.5635, 195.9977, 233.0819, 349.2282], // E-flat major ninth color
  [116.5409, 174.6141, 261.6256, 293.6648], // B-flat suspended / added ninth
].map((notes, index) => ({
  center: 4 + index * 8,
  voices: notes.map((hz) => ({
    hz: frequency(hz),
    phase: random() * tau,
    overtonePhase: random() * tau,
  })),
}));
const shimmerVoices = [523.2511, 698.4565, 783.9909, 1046.5023, 3139.9536, 4186.0092].map((hz, index) => ({
  hz: frequency(hz),
  phase: random() * tau,
  modulation: index + 3,
}));
const pulseStrength = Array.from({ length: 16 }, (_, index) => (
  index % 4 === 0 ? 1 : 0.55 + random() * 0.17
));

for (let index = 0; index < frames; index += 1) {
  const time = index / sampleRate;
  let pad = 0;
  for (const chord of chords) {
    // Wrap distance around the loop; adjacent cosine windows sum to one.
    const distance = ((time - chord.center + duration * 1.5) % duration) - duration / 2;
    if (Math.abs(distance) >= 8) continue;
    const envelope = Math.cos(distance * Math.PI / 16) ** 2;
    let voiceSum = 0;
    for (const voice of chord.voices) {
      voiceSum += Math.sin(tau * voice.hz * time + voice.phase);
      voiceSum += 0.16 * Math.sin(tau * voice.hz * 2 * time + voice.overtonePhase);
      voiceSum += 0.045 * Math.sin(tau * voice.hz * 3 * time + voice.phase);
    }
    pad += envelope * voiceSum * 0.032;
  }
  pad *= 0.91 + 0.09 * Math.cos(tau * time / 16);

  // A soft, slowly breathing upper register; band-limited sinusoids only.
  let shimmer = 0;
  for (const voice of shimmerVoices) {
    const breath = (0.5 + 0.5 * Math.sin(tau * voice.modulation * time / duration + voice.phase)) ** 2;
    // Quiet upper partials make the high-band particle response present in this score.
    shimmer += Math.sin(tau * voice.hz * time + voice.phase) * breath * (voice.hz > 2200 ? 0.0016 : 0.0032);
  }

  // A very quiet low drum every two seconds, with a zero-slope onset/tail.
  const pulseTime = time % 2;
  let pulse = 0;
  if (pulseTime < 1.25) {
    const attack = Math.sin(Math.min(1, pulseTime / 0.055) * Math.PI / 2) ** 2;
    const release = Math.cos(pulseTime / 1.25 * Math.PI / 2) ** 2;
    const envelope = attack * release * Math.exp(-pulseTime * 5.8);
    const phase = tau * (48 * pulseTime + 2.6 * (1 - Math.exp(-pulseTime * 9)));
    pulse = Math.sin(phase) * envelope * 0.048 * pulseStrength[Math.floor(time / 2)];
  }
  score[index] = pad + shimmer + pulse;
}

// Remove the tiny numerical DC residual, then leave substantial output headroom.
let mean = 0;
let sourcePeak = 0;
for (const sample of score) mean += sample / frames;
for (const sample of score) sourcePeak = Math.max(sourcePeak, Math.abs(sample - mean));
const gain = targetPeak / sourcePeak;
const wave = Buffer.alloc(44 + frames * 2);
wave.write("RIFF", 0);
wave.writeUInt32LE(wave.length - 8, 4);
wave.write("WAVEfmt ", 8);
wave.writeUInt32LE(16, 16);
wave.writeUInt16LE(1, 20); // PCM
wave.writeUInt16LE(1, 22); // mono
wave.writeUInt32LE(sampleRate, 24);
wave.writeUInt32LE(sampleRate * 2, 28);
wave.writeUInt16LE(2, 32);
wave.writeUInt16LE(16, 34);
wave.write("data", 36);
wave.writeUInt32LE(frames * 2, 40);
for (let index = 0; index < frames; index += 1) {
  wave.writeInt16LE(Math.round((score[index] - mean) * gain * 32767), 44 + index * 2);
}
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, wave);

// Inspect the saved file rather than trusting the synthesis buffer.
const saved = await readFile(destination);
assert.equal(saved.toString("ascii", 0, 4), "RIFF");
assert.equal(saved.toString("ascii", 8, 16), "WAVEfmt ");
assert.equal(saved.readUInt16LE(20), 1);
assert.equal(saved.readUInt16LE(22), 1);
assert.equal(saved.readUInt32LE(24), sampleRate);
assert.equal(saved.readUInt16LE(34), 16);
assert.equal(saved.readUInt32LE(40), frames * 2);
assert.equal(saved.length, 44 + frames * 2);
let squareSum = 0;
let peak = 0;
let deltaSquareSum = 0;
for (let index = 0; index < frames; index += 1) {
  const sample = saved.readInt16LE(44 + index * 2) / 32768;
  peak = Math.max(peak, Math.abs(sample));
  squareSum += sample * sample;
  if (index > 0) {
    const previous = saved.readInt16LE(44 + (index - 1) * 2) / 32768;
    deltaSquareSum += (sample - previous) ** 2;
  }
}
const rms = Math.sqrt(squareSum / frames);
const seamDelta = Math.abs(saved.readInt16LE(44) - saved.readInt16LE(saved.length - 2)) / 32768;
const deltaRms = Math.sqrt(deltaSquareSum / (frames - 1));
assert.ok(peak < 0.321 && peak > 0.31, "Output peak must preserve headroom");
assert.ok(rms < 0.13 && rms > 0.025, "Score must remain softly audible");
assert.ok(seamDelta < Math.max(deltaRms * 3, 0.002), "Loop seam must behave like a normal waveform step");
console.log(JSON.stringify({
  file: destination,
  bytes: saved.length,
  durationSeconds: frames / sampleRate,
  sampleRate,
  channels: 1,
  bitsPerSample: 16,
  peak,
  peakDbfs: 20 * Math.log10(peak),
  rms,
  rmsDbfs: 20 * Math.log10(rms),
  seamDelta,
  adjacentSampleDeltaRms: deltaRms,
}, null, 2));
