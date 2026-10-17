import assert from "node:assert/strict";
import test from "node:test";
import { ShaderLib } from "three";
import { createFlowerMaterials, createThemedFlowerMaterials } from "./FlowerMaterials.ts";
import { ThemeController } from "../../../lib/ThemeController.ts";

function compileHook(material) {
  const shader = {
    uniforms: {},
    vertexShader: ShaderLib.physical.vertexShader,
    fragmentShader: ShaderLib.physical.fragmentShader,
  };
  material.onBeforeCompile(shader);
  return shader;
}

test("every physical finish shares a dissolve uniform, including late shader compilation", () => {
  const finishes = createFlowerMaterials();
  const materials = Object.values(finishes.materials);
  const shader = compileHook(materials[0]);
  finishes.setDissolve(0.63);
  assert.equal(shader.uniforms.uBloomDissolve.value, 0.63);
  for (const material of materials.slice(1)) {
    const lateShader = compileHook(material);
    assert.equal(lateShader.uniforms.uBloomDissolve, shader.uniforms.uBloomDissolve);
    assert.equal(lateShader.uniforms.uBloomDissolve.value, 0.63);
  }
  const versions = materials.map(material => material.version);
  const keys = materials.map(material => material.customProgramCacheKey());
  for (let step = 0; step <= 100; step += 1) finishes.setDissolve(step / 100);
  assert.deepEqual(materials.map(material => material.version), versions);
  assert.deepEqual(materials.map(material => material.customProgramCacheKey()), keys);
  assert.equal(shader.uniforms.uBloomDissolve.value, 1);
  finishes.setDissolve(-2);
  assert.equal(shader.uniforms.uBloomDissolve.value, 0);
  finishes.setDissolve(4);
  assert.equal(shader.uniforms.uBloomDissolve.value, 1);
  finishes.setDissolve(Number.NaN);
  assert.equal(shader.uniforms.uBloomDissolve.value, 0);
  finishes.dispose();
});

test("shader injection matches the installed physical shader and preserves its lighting pipeline", () => {
  const finishes = createFlowerMaterials(true);
  for (const material of Object.values(finishes.materials)) {
    const shader = compileHook(material);
    assert.match(shader.vertexShader, /#include <morphtarget_vertex>\s*vBloomDissolvePosition = transformed;/);
    assert.match(shader.fragmentShader, /uniform float uBloomDissolve;/);
    assert.match(shader.fragmentShader, /if \(uBloomDissolve >= 1\.0\) discard;/);
    assert.match(shader.fragmentShader, /if \(bloomField < uBloomDissolve\) discard;/);
    assert.match(shader.fragmentShader, /#include <lights_physical_fragment>/);
    assert.match(shader.fragmentShader, /#include <transmission_fragment>/);
    assert.match(shader.fragmentShader, /#include <colorspace_fragment>/);
    assert.equal((shader.fragmentShader.match(/float bloomDissolveEdge =/g) ?? []).length, 1);
    assert.equal(material.depthWrite, true);
    assert.equal(material.transparent, false);
  }
  assert.equal(finishes.materials.glass.transmission, 0.55);
  assert.equal(finishes.materials.violet.iridescence, 1);
  finishes.dispose();
});

function themeFrame(id) {
  const controller = new ThemeController();
  controller.setReducedMotion(true);
  controller.selectTheme(id);
  return controller.frame;
}

test("alternating themed surfaces share live pigments, dissolve and accent with opposite gradients", () => {
  const finishes = createThemedFlowerMaterials();
  const first = compileHook(finishes.primary);
  const frame = themeFrame("NEBULA");
  finishes.applyTheme(frame);
  finishes.setDissolve(0.42);
  const second = compileHook(finishes.secondary);
  for (const key of ["uBloomDissolve", "uBloomDissolveAccent", "uBloomPetalA", "uBloomPetalB", "uBloomGradientMix"]) {
    assert.equal(first.uniforms[key], second.uniforms[key]);
  }
  assert.equal(first.uniforms.uBloomDissolve.value, 0.42);
  assert.equal(first.uniforms.uBloomGradientMix.value, 1);
  assert.equal(first.uniforms.uBloomGradientReverse.value, 0);
  assert.equal(second.uniforms.uBloomGradientReverse.value, 1);
  assert.ok(first.uniforms.uBloomDissolveAccent.value.equals(frame.accent));
  assert.notEqual(first.uniforms.uBloomDissolveAccent.value, frame.accent);
  assert.ok(first.uniforms.uBloomPetalA.value.equals(frame.petalA));
  assert.ok(first.uniforms.uBloomPetalB.value.equals(frame.petalB));
  assert.ok(finishes.primary.color.equals(frame.petalA));
  assert.ok(finishes.secondary.color.equals(frame.petalB));
  assert.notDeepEqual(finishes.primary.color, finishes.secondary.color);
  for (const shader of [first, second]) {
    const gradientIndex = shader.fragmentShader.indexOf("diffuseColor.rgb = mix(");
    assert.ok(gradientIndex > shader.fragmentShader.indexOf("#include <color_fragment>"));
    assert.ok(gradientIndex < shader.fragmentShader.indexOf("#include <lights_physical_fragment>"));
    assert.match(shader.fragmentShader, /vBloomDissolvePosition\.y \* 0\.88 \+ vBloomDissolvePosition\.z \* 0\.2/);
    assert.match(shader.fragmentShader, /uBloomDissolveAccent \* bloomDissolveEdge/);
    assert.match(shader.fragmentShader, /#include <transmission_fragment>/);
  }
  finishes.dispose();
});

test("theme interpolation preserves materials and Color references without frame-by-frame recompiles", () => {
  const finishes = createThemedFlowerMaterials();
  const controller = new ThemeController();
  const primary = finishes.primary, secondary = finishes.secondary;
  const primaryColor = primary.color, secondaryColor = secondary.color;
  const first = compileHook(primary);
  const pigment = first.uniforms.uBloomPetalA.value;
  const accent = first.uniforms.uBloomDissolveAccent.value;
  const key = primary.customProgramCacheKey();
  let primaryDisposals = 0, secondaryDisposals = 0;
  primary.addEventListener("dispose", () => primaryDisposals += 1);
  secondary.addEventListener("dispose", () => secondaryDisposals += 1);
  controller.selectTheme("NEBULA");
  controller.advance(0.01);
  finishes.applyTheme(controller.frame);
  const primaryVersion = primary.version, secondaryVersion = secondary.version;
  for (let index = 0; index < 130; index += 1) {
    controller.advance(0.01);
    finishes.applyTheme(controller.frame);
    finishes.setDissolve(index / 130);
    assert.equal(primary.version, primaryVersion);
    assert.equal(secondary.version, secondaryVersion);
  }
  assert.equal(finishes.primary, primary);
  assert.equal(finishes.secondary, secondary);
  assert.equal(primary.color, primaryColor);
  assert.equal(secondary.color, secondaryColor);
  assert.equal(first.uniforms.uBloomPetalA.value, pigment);
  assert.equal(first.uniforms.uBloomDissolveAccent.value, accent);
  assert.equal(primary.customProgramCacheKey(), key);
  assert.equal(primary.metalness, controller.frame.metalness);
  assert.equal(primary.roughness, controller.frame.roughness);
  assert.equal(primary.transmission, controller.frame.transmission);
  assert.equal(primary.thickness, controller.frame.thickness);
  assert.equal(primary.iridescence, controller.frame.iridescence);
  assert.equal(primary.envMapIntensity, controller.frame.envMapIntensity);
  assert.equal(primaryDisposals, 0);
  assert.equal(secondaryDisposals, 0);
  finishes.dispose();
  assert.equal(primaryDisposals, 1);
  assert.equal(secondaryDisposals, 1);
});

test("mobile glass avoids transmission passes while preserving both pigments and curved gradients", () => {
  const finishes = createThemedFlowerMaterials(true);
  const frame = themeFrame("AZURE");
  finishes.applyTheme(frame);
  const primary = compileHook(finishes.primary), secondary = compileHook(finishes.secondary);
  for (const material of [finishes.primary, finishes.secondary]) {
    assert.equal(material.transmission, 0);
    assert.ok(material.roughness > frame.roughness);
    assert.ok(material.thickness < frame.thickness);
    assert.equal(material.clearcoat, frame.clearcoat);
    assert.equal(material.ior, frame.ior);
    assert.equal(material.userData.mobileGlassFallback, true);
  }
  assert.ok(finishes.primary.color.equals(frame.petalA));
  assert.ok(finishes.secondary.color.equals(frame.petalB));
  assert.equal(primary.uniforms.uBloomGradientMix.value, frame.gradientMix);
  assert.equal(secondary.uniforms.uBloomGradientMix, primary.uniforms.uBloomGradientMix);
  finishes.dispose();
});

test("physical shader versions change only when transmission or iridescence cross zero", () => {
  const finishes = createThemedFlowerMaterials();
  const material = finishes.primary;
  const initialVersion = material.version;
  const azure = themeFrame("AZURE");
  finishes.applyTheme(azure);
  assert.equal(material.version, initialVersion + 1);
  for (let index = 0; index < 50; index += 1) finishes.applyTheme(azure);
  assert.equal(material.version, initialVersion + 1);
  finishes.applyTheme(themeFrame("CRIMSON"));
  assert.equal(material.version, initialVersion + 2);
  finishes.applyTheme(themeFrame("VIOLET"));
  assert.equal(material.version, initialVersion + 3);
  finishes.applyTheme(themeFrame("SILVER"));
  assert.equal(material.version, initialVersion + 4);
  finishes.dispose();
});
