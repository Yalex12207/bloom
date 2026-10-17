import assert from "node:assert/strict";
import test from "node:test";
import { Color } from "three";
import { CHAPTER_THEMES, THEME_IDS, THEMES, ThemeController } from "./ThemeController.ts";

const colors = ["accent", "secondary", "petalA", "petalB", "keyLight", "rimLight", "fillLight", "core", "particleA", "particleB", "atmosphereA", "atmosphereB"];
const numbers = ["metalness", "roughness", "transmission", "thickness", "ior", "clearcoat", "iridescence", "envMapIntensity", "gradientMix", "particleIntensity", "keyIntensity", "rimIntensity", "fillIntensity", "coreIntensity"];

function values(frame) {
  return Object.fromEntries(Object.entries(frame).map(([field, value]) => [field, value instanceof Color ? value.toArray() : value]));
}

function assertDefinition(frame, definition) {
  for (const field of colors) assert.deepEqual(frame[field], new Color(definition[field]), field);
  for (const field of numbers) assert.equal(frame[field], definition[field], field);
}

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} differs from ${expected}`);
}

test("six complete themes reach their exact physical and lighting endpoints", () => {
  assert.deepEqual(THEME_IDS, ["CRIMSON", "AZURE", "VIOLET", "SILVER", "DUALITY", "NEBULA"]);
  assert.deepEqual(CHAPTER_THEMES, ["CRIMSON", "SILVER", "AZURE", "NEBULA", "DUALITY"]);
  const controller = new ThemeController();
  assert.deepEqual(controller.getSnapshot(), { theme: "CRIMSON", mode: "auto", chapter: 0, transitioning: false });
  assert.equal(controller.progress, 1);
  for (const id of THEME_IDS) {
    controller.selectTheme(id);
    controller.advance(1.2);
    assertDefinition(controller.frame, THEMES[id]);
    assert.equal(controller.getSnapshot().theme, id);
    assert.equal(controller.getSnapshot().mode, "manual");
    assert.equal(controller.getSnapshot().transitioning, false);
    assert.equal(controller.progress, 1);
    for (const field of numbers) assert.ok(Number.isFinite(controller.frame[field]) && controller.frame[field] >= 0);
  }
  assert.equal(THEMES.NEBULA.gradientMix, 1);
  assert.notEqual(THEMES.DUALITY.petalA, THEMES.DUALITY.petalB);
  assert.notEqual(THEMES.NEBULA.atmosphereA, THEMES.NEBULA.atmosphereB);
  assert.ok(THEMES.AZURE.transmission > THEMES.SILVER.transmission);
});

test("theme palettes retain the brief's primary colors, cold silver and blue-violet glass", () => {
  assert.equal(THEMES.CRIMSON.accent, "#F04456");
  assert.equal(THEMES.CRIMSON.keyLight, "#FFD8CB");
  assert.equal(THEMES.AZURE.accent, "#168BFF");
  assert.equal(THEMES.VIOLET.accent, "#A46BFF");
  assert.equal(THEMES.SILVER.accent, "#C8DDE9");
  assert.equal(THEMES.SILVER.keyLight, "#EDF5FF");
  const coldSilver = new Color(THEMES.SILVER.secondary);
  assert.ok(coldSilver.b > coldSilver.r && coldSilver.g > coldSilver.r);
  assert.equal(THEMES.DUALITY.secondary, "#168BFF");
  assert.ok(THEMES.DUALITY.gradientMix <= 0.2, "alternating red and blue petals remain distinct");
  assert.equal(THEMES.NEBULA.accent, "#168BFF");
  assert.equal(THEMES.NEBULA.secondary, "#A46BFF");
  assert.equal(THEMES.NEBULA.petalA, "#2876DB");
  assert.equal(THEMES.NEBULA.petalB, "#9062DA");
  assert.equal(THEMES.NEBULA.particleA, THEMES.NEBULA.accent);
  assert.equal(THEMES.NEBULA.particleB, THEMES.NEBULA.secondary);
  for (const field of ["petalA", "petalB", "keyLight", "rimLight", "fillLight", "core", "atmosphereA", "atmosphereB"]) {
    const color = new Color(THEMES.NEBULA[field]);
    assert.ok(color.b > color.g && color.b > color.r, `${field} should remain blue-violet`);
  }
  assert.equal(THEMES.NEBULA.transmission, 0.58);
  assert.equal(THEMES.NEBULA.metalness, 0.18);
  assert.equal(THEMES.NEBULA.gradientMix, 1);
});

test("interrupted transitions capture the visible frame and blend linear Color channels", () => {
  const controller = new ThemeController();
  const initial = controller.frame.accent.clone();
  controller.selectTheme("AZURE");
  controller.advance(0.3);
  const eased = 0.25 ** 2 * (3 - 2 * 0.25);
  const expected = initial.clone().lerp(new Color(THEMES.AZURE.accent), eased);
  assert.deepEqual(controller.frame.accent, expected);
  const visible = values(controller.frame);
  const capturedColor = controller.frame.accent.clone();
  const capturedMetalness = controller.frame.metalness;
  controller.selectTheme("VIOLET");
  assert.deepEqual(values(controller.frame), visible);
  assert.equal(controller.progress, 0);
  controller.advance(0.6);
  const violet = new Color(THEMES.VIOLET.accent);
  close(controller.frame.accent.r, (capturedColor.r + violet.r) / 2);
  close(controller.frame.accent.g, (capturedColor.g + violet.g) / 2);
  close(controller.frame.accent.b, (capturedColor.b + violet.b) / 2);
  close(controller.frame.metalness, (capturedMetalness + THEMES.VIOLET.metalness) / 2);
  const halfway = values(controller.frame);
  controller.selectTheme("SILVER");
  assert.deepEqual(values(controller.frame), halfway);
  controller.advance(1.2);
  assertDefinition(controller.frame, THEMES.SILVER);
});

test("same-target selection never restarts a transition, even when changing mode", () => {
  const controller = new ThemeController();
  controller.setChapter(1);
  controller.advance(0.3);
  const snapshot = controller.getSnapshot();
  const visible = values(controller.frame);
  controller.setChapter(1);
  assert.equal(controller.getSnapshot(), snapshot);
  close(controller.progress, 0.25);
  controller.selectTheme("SILVER");
  assert.equal(controller.getSnapshot().mode, "manual");
  close(controller.progress, 0.25);
  assert.deepEqual(values(controller.frame), visible);
  controller.selectTheme("SILVER");
  controller.advance(0.9);
  assert.equal(controller.progress, 1);
  assertDefinition(controller.frame, THEMES.SILVER);
});

test("manual mode stores chapters and Auto resumes the current chapter in either direction", () => {
  const controller = new ThemeController();
  controller.selectTheme("VIOLET");
  controller.advance(1.2);
  controller.setChapter(4);
  assert.equal(controller.getSnapshot().theme, "VIOLET");
  assert.equal(controller.getSnapshot().chapter, 4);
  assert.equal(controller.getSnapshot().mode, "manual");
  assertDefinition(controller.frame, THEMES.VIOLET);
  controller.setAuto(true);
  assert.equal(controller.getSnapshot().theme, "DUALITY");
  assert.equal(controller.getSnapshot().mode, "auto");
  controller.advance(1.2);
  assertDefinition(controller.frame, THEMES.DUALITY);
  for (let chapter = 3; chapter >= 0; chapter -= 1) {
    controller.setChapter(chapter);
    controller.advance(1.2);
    assert.equal(controller.getSnapshot().theme, CHAPTER_THEMES[chapter]);
    assertDefinition(controller.frame, THEMES[CHAPTER_THEMES[chapter]]);
  }
  controller.setAuto(false);
  controller.setChapter(3);
  assert.equal(controller.getSnapshot().theme, "CRIMSON");
  controller.setAuto(true);
  controller.advance(1.2);
  assertDefinition(controller.frame, THEMES.NEBULA);
});

test("frame and Color references are retained and metadata snapshots change only when needed", () => {
  const controller = new ThemeController();
  const frame = controller.frame;
  const colorReferences = colors.map(field => frame[field]);
  const initialSnapshot = controller.getSnapshot();
  assert.equal(controller.getSnapshot(), initialSnapshot);
  let metadataCalls = 0;
  let frameCalls = 0;
  const stopMetadata = controller.subscribe(() => { metadataCalls += 1; });
  const stopFrame = controller.subscribeFrame(() => { frameCalls += 1; });
  controller.selectTheme("AZURE");
  const transitionSnapshot = controller.getSnapshot();
  assert.notEqual(transitionSnapshot, initialSnapshot);
  controller.advance(0.4);
  assert.equal(controller.getSnapshot(), transitionSnapshot);
  assert.equal(metadataCalls, 1);
  assert.equal(frameCalls, 1);
  controller.advance(0.8);
  assert.notEqual(controller.getSnapshot(), transitionSnapshot);
  assert.equal(metadataCalls, 2);
  assert.equal(frameCalls, 2);
  const finishedSnapshot = controller.getSnapshot();
  controller.selectTheme("AZURE");
  controller.advance(0.2);
  assert.equal(controller.getSnapshot(), finishedSnapshot);
  assert.equal(frameCalls, 2);
  controller.setChapter(1);
  assert.equal(metadataCalls, 3);
  stopMetadata(); stopMetadata(); stopFrame(); stopFrame();
  for (const id of THEME_IDS) { controller.selectTheme(id); controller.advance(1.2); }
  assert.equal(metadataCalls, 3);
  assert.equal(frameCalls, 2);
  assert.equal(controller.frame, frame);
  for (let index = 0; index < colors.length; index += 1) assert.equal(frame[colors[index]], colorReferences[index]);
});

test("reduced motion finishes in-flight work and applies subsequent targets immediately", () => {
  const controller = new ThemeController();
  let frames = 0;
  const stop = controller.subscribeFrame(() => { frames += 1; });
  controller.selectTheme("AZURE");
  controller.advance(0.2);
  controller.setReducedMotion(true);
  assert.equal(controller.progress, 1);
  assert.equal(controller.getSnapshot().transitioning, false);
  assertDefinition(controller.frame, THEMES.AZURE);
  controller.selectTheme("NEBULA");
  assertDefinition(controller.frame, THEMES.NEBULA);
  assert.equal(controller.getSnapshot().transitioning, false);
  const frameCount = frames;
  controller.advance(100);
  assert.equal(frames, frameCount);
  controller.setAuto(true);
  assertDefinition(controller.frame, THEMES.CRIMSON);
  controller.setChapter(4);
  assertDefinition(controller.frame, THEMES.DUALITY);
  controller.setReducedMotion(false);
  controller.selectTheme("SILVER");
  assert.equal(controller.getSnapshot().transitioning, true);
  assert.equal(controller.progress, 0);
  stop();
});

test("clock and chapter inputs are clamped without creating non-finite values", () => {
  const controller = new ThemeController();
  controller.setChapter(Infinity);
  assert.equal(controller.getSnapshot().chapter, 4);
  controller.setChapter(-Infinity);
  assert.equal(controller.getSnapshot().chapter, 0);
  controller.setChapter(NaN);
  assert.equal(controller.getSnapshot().chapter, 0);
  controller.setChapter(2.9);
  assert.equal(controller.getSnapshot().chapter, 2);
  controller.advance(0.3);
  const before = values(controller.frame);
  const progress = controller.progress;
  for (const delta of [NaN, Infinity, -Infinity, 0, -1]) controller.advance(delta);
  assert.deepEqual(values(controller.frame), before);
  assert.equal(controller.progress, progress);
  controller.advance(100);
  assert.equal(controller.progress, 1);
  assert.ok(Object.values(values(controller.frame)).flat().every(Number.isFinite));
});
