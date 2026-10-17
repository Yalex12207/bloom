import assert from "node:assert/strict";
import test from "node:test";
import { CinematicRuntime, TIMELINE_BOUNDARIES, TIMELINE_CHAPTERS, sampleCinematic } from "./cinematic-state.ts";

const metadata = new Set(["chapter", "chapterProgress"]);
const bounded = ["bloom", "scatter", "sculpture", "dissolve", "particleOpacity", "sweep", "wave", "shock", "veil", "titleReveal", "genesisReveal", "fractureReveal", "rebornReveal"];

function seededValues(count) {
  let seed = 48154;
  return Array.from({ length: count }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  });
}

test("five chapters share exact endpoints and named absolute keypoints", () => {
  assert.deepEqual(TIMELINE_BOUNDARIES, [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.equal(TIMELINE_CHAPTERS.length, 5);
  for (let index = 0; index < 5; index += 1) {
    const chapter = TIMELINE_CHAPTERS[index];
    assert.equal(chapter.start, TIMELINE_BOUNDARIES[index]);
    assert.equal(chapter.end, TIMELINE_BOUNDARIES[index + 1]);
    assert.equal(chapter.index, index);
    assert.ok(chapter.keypoints.length >= 3);
    assert.ok(chapter.keypoints.every((point) => point.name && point.progress >= chapter.start && point.progress <= chapter.end));
    const frame = sampleCinematic(chapter.start);
    assert.equal(frame.chapter, index);
    assert.equal(frame.chapterProgress, 0);
  }
  assert.equal(sampleCinematic(1).chapter, 4);
  assert.equal(sampleCinematic(1).chapterProgress, 1);
});

test("all samples are finite, bounded and leave a safe camera distance", () => {
  const out = sampleCinematic(0);
  const seeks = [0, 1, NaN, Infinity, -Infinity, -100, 100, ...seededValues(2000)];
  for (const reduced of [false, true]) {
    for (const progress of seeks) {
      assert.equal(sampleCinematic(progress, out, reduced), out);
      assert.ok(Object.values(out).every(Number.isFinite));
      assert.ok(out.chapter >= 0 && out.chapter <= 4 && Number.isInteger(out.chapter));
      for (const field of bounded) assert.ok(out[field] >= 0 && out[field] <= 1, field);
      const distance = Math.hypot(out.cameraX - out.flowerX, out.cameraY - out.flowerY, out.cameraZ - out.flowerZ);
      assert.ok(distance > 6, `unsafe camera distance at ${progress}`);
      assert.ok(out.flowerScale > 0);
    }
  }
  assert.equal(sampleCinematic(NaN).progress, 0);
  assert.equal(sampleCinematic(Infinity).progress, 1);
  assert.equal(sampleCinematic(-Infinity).progress, 0);
});

test("seeking and reverse sampling match direct deterministic samples", () => {
  const seeks = seededValues(150);
  const expected = seeks.map((progress) => sampleCinematic(progress));
  const out = sampleCinematic(0);
  for (let index = seeks.length - 1; index >= 0; index -= 1) {
    sampleCinematic(seeks[index], out);
    assert.deepEqual(out, expected[index]);
    sampleCinematic(0.455, out);
    sampleCinematic(0.9, out);
  }
  const closed = sampleCinematic(0);
  const open = sampleCinematic(0.4);
  const scattered = sampleCinematic(0.6);
  const sculpture = sampleCinematic(0.8);
  const reborn = sampleCinematic(1);
  assert.equal(closed.bloom, 0);
  assert.equal(closed.dissolve, 1);
  assert.equal(open.bloom, 1);
  assert.equal(scattered.scatter, 1);
  assert.equal(sculpture.sculpture, 1);
  assert.equal(sculpture.scatter, 0);
  assert.equal(reborn.sculpture, 0);
  assert.equal(reborn.scatter, 0);
  assert.equal(reborn.bloom, 1);
  assert.equal(reborn.wave, 0);
  assert.equal(sampleCinematic(0.895).wave, 1);
  assert.equal(sampleCinematic(0.455).shock, 0.85);
});

test("physical and visual channels are continuous across boundaries and seeks", () => {
  // Include chapter edges, all internal poses, and all envelope/reveal joins.
  const joins = [0.015, 0.025, 0.1, 0.12, 0.2, 0.215, 0.28, 0.29, 0.375, 0.4, 0.41, 0.43, 0.432, 0.455, 0.48, 0.49, 0.5, 0.51, 0.59, 0.6, 0.65, 0.67, 0.72, 0.73, 0.79, 0.8, 0.815, 0.84, 0.89, 0.895, 0.9, 0.965, ...seededValues(100)];
  for (const reduced of [false, true]) {
    for (const progress of joins) {
      const before = sampleCinematic(progress - 1e-7, undefined, reduced);
      const after = sampleCinematic(progress + 1e-7, undefined, reduced);
      for (const field of Object.keys(before)) {
        if (!metadata.has(field)) assert.ok(Math.abs(before[field] - after[field]) < 0.0001, `${field} jumped at ${progress}`);
      }
    }
  }
});

test("chapter typography fades before later chapter planes become visible", () => {
  const genesis = sampleCinematic(0.35);
  assert.equal(genesis.genesisReveal, 1);
  assert.equal(genesis.fractureReveal, 0);
  assert.equal(genesis.rebornReveal, 0);
  const fracture = sampleCinematic(0.55);
  assert.equal(fracture.genesisReveal, 0);
  assert.equal(fracture.fractureReveal, 1);
  assert.equal(fracture.rebornReveal, 0);
  const rebirth = sampleCinematic(0.95);
  assert.equal(rebirth.genesisReveal, 0);
  assert.equal(rebirth.fractureReveal, 0);
  assert.equal(rebirth.rebornReveal, 1);
});

test("reduced motion fixes transforms and suppresses traveling effects", () => {
  const initial = sampleCinematic(0, undefined, true);
  const fixed = ["cameraX", "cameraY", "cameraZ", "targetX", "targetY", "targetZ", "flowerX", "flowerY", "flowerZ", "rotationX", "rotationY", "rotationZ", "flowerScale"];
  for (const progress of seededValues(40)) {
    const frame = sampleCinematic(progress, undefined, true);
    for (const field of fixed) assert.equal(frame[field], initial[field]);
    assert.equal(frame.wave, 0);
    assert.equal(frame.shock, 0);
    assert.equal(frame.sweep, 0);
    assert.equal(frame.particleOpacity, 0);
    assert.equal(frame.bloom, sampleCinematic(progress).bloom);
  }
});

test("runtime shares one frame and cleans up render/replay subscriptions", () => {
  const runtime = new CinematicRuntime();
  const frame = runtime.frame;
  let renders = 0;
  let replays = 0;
  const stopRender = runtime.subscribe(() => { renders += 1; });
  const stopReplay = runtime.onReplay(() => { replays += 1; });
  runtime.update(0.73);
  assert.equal(runtime.frame, frame);
  assert.deepEqual(frame, sampleCinematic(0.73));
  assert.equal(renders, 1);
  const unchanged = { ...frame };
  runtime.requestRender();
  assert.deepEqual(frame, unchanged);
  runtime.resetInteraction();
  assert.equal(replays, 1);
  assert.equal(renders, 3);
  assert.deepEqual(frame, unchanged);
  stopRender(); stopRender(); stopReplay(); stopReplay();
  runtime.update(0.1);
  runtime.requestRender();
  runtime.resetInteraction();
  assert.equal(renders, 3);
  assert.equal(replays, 1);
  assert.equal(frame.progress, 0.1);
});
