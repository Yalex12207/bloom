import { Color, DoubleSide, MeshPhysicalMaterial } from "three";
import type { ThemeFrame } from "@/lib/ThemeController";

export const FLOWER_MATERIALS = ["silver", "glass", "crimson", "violet"] as const;
export type FlowerMaterial = (typeof FLOWER_MATERIALS)[number];

export const materialLabels: Record<FlowerMaterial, string> = {
  silver: "SILVER / CHROME",
  glass: "AZURE / GLASS",
  crimson: "CRIMSON / LACQUER",
  violet: "VIOLET / IRIDESCENT",
};

const dissolveShader = /* glsl */ `
uniform float uBloomDissolve;
uniform vec3 uBloomDissolveAccent;
varying vec3 vBloomDissolvePosition;

float bloomDissolveHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float bloomDissolveNoise(vec3 p) {
  vec3 cell = floor(p);
  vec3 blend = fract(p);
  blend = blend * blend * (3.0 - 2.0 * blend);
  return mix(
    mix(mix(bloomDissolveHash(cell), bloomDissolveHash(cell + vec3(1.0, 0.0, 0.0)), blend.x),
        mix(bloomDissolveHash(cell + vec3(0.0, 1.0, 0.0)), bloomDissolveHash(cell + vec3(1.0, 1.0, 0.0)), blend.x), blend.y),
    mix(mix(bloomDissolveHash(cell + vec3(0.0, 0.0, 1.0)), bloomDissolveHash(cell + vec3(1.0, 0.0, 1.0)), blend.x),
        mix(bloomDissolveHash(cell + vec3(0.0, 1.0, 1.0)), bloomDissolveHash(cell + vec3(1.0, 1.0, 1.0)), blend.x), blend.y),
    blend.z
  );
}
`;

interface ScalarUniform { value: number }
interface ColorUniform { value: Color }
interface GradientUniforms {
  petalA: ColorUniform;
  petalB: ColorUniform;
  mix: ScalarUniform;
  reverse: ScalarUniform;
}

/** Patches the physical shader before lighting, so its PBR and transmission stay intact. */
function extendPetalShader(material: MeshPhysicalMaterial, dissolve: ScalarUniform, accent: ColorUniform, gradient?: GradientUniforms) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uBloomDissolve = dissolve;
    shader.uniforms.uBloomDissolveAccent = accent;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBloomDissolvePosition;")
      .replace("#include <morphtarget_vertex>", "#include <morphtarget_vertex>\nvBloomDissolvePosition = transformed;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${dissolveShader}`)
      .replace("#include <alphatest_fragment>", /* glsl */ `
        #include <alphatest_fragment>
        float bloomDissolveEdge = 0.0;
        if (uBloomDissolve > 0.0) {
          if (uBloomDissolve >= 1.0) discard;
          float bloomGrain = bloomDissolveNoise(vBloomDissolvePosition * vec3(19.0, 8.0, 23.0));
          float bloomField = clamp(mix(vBloomDissolvePosition.y, bloomGrain, 0.65), 0.0, 1.0);
          if (bloomField < uBloomDissolve) discard;
          bloomDissolveEdge = 1.0 - smoothstep(0.0, 0.045, bloomField - uBloomDissolve);
        }
      `)
      .replace("#include <emissivemap_fragment>", /* glsl */ `
        #include <emissivemap_fragment>
        totalEmissiveRadiance += uBloomDissolveAccent * bloomDissolveEdge * 0.6;
      `);

    if (gradient) {
      shader.uniforms.uBloomPetalA = gradient.petalA;
      shader.uniforms.uBloomPetalB = gradient.petalB;
      shader.uniforms.uBloomGradientMix = gradient.mix;
      shader.uniforms.uBloomGradientReverse = gradient.reverse;
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", /* glsl */ `
          #include <common>
          uniform vec3 uBloomPetalA;
          uniform vec3 uBloomPetalB;
          uniform float uBloomGradientMix;
          uniform float uBloomGradientReverse;
        `)
        .replace("#include <color_fragment>", /* glsl */ `
          #include <color_fragment>
          float bloomCurve = smoothstep(0.02, 0.98, vBloomDissolvePosition.y * 0.88 + vBloomDissolvePosition.z * 0.2);
          bloomCurve = mix(bloomCurve, 1.0 - bloomCurve, uBloomGradientReverse);
          vec3 bloomPigment = mix(uBloomPetalA, uBloomPetalB, bloomCurve);
          diffuseColor.rgb = mix(diffuseColor.rgb, bloomPigment, uBloomGradientMix);
        `);
    }
  };
  material.customProgramCacheKey = () => gradient ? "bloom-petal-dissolve-gradient-v1" : "bloom-petal-dissolve-v2";
}

function normalized(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** Four shared materials per mounted flower, never one allocation per petal/frame. */
export function createFlowerMaterials(mobile = false) {
  // All finishes share this exact uniform object, including programs compiled later.
  const dissolve = { value: 0 };
  const accent = { value: new Color(0.48, 0.016, 0.041) };
  const common = {
    side: DoubleSide,
    forceSinglePass: true,
    clearcoat: 1,
    clearcoatRoughness: 0.13,
    envMapIntensity: 1.9,
  };
  const materials: Record<FlowerMaterial, MeshPhysicalMaterial> = {
    silver: new MeshPhysicalMaterial({
      ...common,
      color: "#c4d3df",
      metalness: 0.96,
      roughness: 0.2,
      transmission: 0,
      thickness: 0.15,
      ior: 1.5,
      anisotropy: mobile ? 0 : 0.25,
      anisotropyRotation: Math.PI / 2,
    }),
    glass: new MeshPhysicalMaterial({
      ...common,
      color: "#76bcf4",
      metalness: 0.05,
      roughness: mobile ? 0.18 : 0.11,
      transmission: mobile ? 0.55 : 0.82,
      thickness: mobile ? 0.12 : 0.28,
      ior: 1.46,
      attenuationColor: new Color("#1674c9"),
      attenuationDistance: 1.7,
      envMapIntensity: 2.2,
    }),
    crimson: new MeshPhysicalMaterial({
      ...common,
      color: "#b81732",
      metalness: 0.58,
      roughness: 0.19,
      transmission: 0,
      thickness: 0.18,
      ior: 1.52,
      specularIntensity: 1,
    }),
    violet: new MeshPhysicalMaterial({
      ...common,
      color: "#7774ca",
      metalness: 0.72,
      roughness: 0.22,
      transmission: 0,
      thickness: 0.2,
      ior: 1.42,
      iridescence: 1,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [180, 620],
      sheen: mobile ? 0 : 0.22,
      sheenColor: new Color("#cc9cf5"),
      sheenRoughness: 0.4,
    }),
  };

  for (const material of Object.values(materials)) extendPetalShader(material, dissolve, accent);

  return {
    materials,
    setDissolve(value: number) { dissolve.value = normalized(value); },
    dispose() { for (const material of Object.values(materials)) material.dispose(); },
  };
}

/** Two persistent, alternating PBR surfaces with a continuously blended curved pigment field. */
export function createThemedFlowerMaterials(mobile = false) {
  const dissolve = { value: 0 };
  const accent = { value: new Color("#f04456") };
  const petalA = { value: new Color("#b81732") };
  const petalB = { value: new Color("#5a1026") };
  const gradientMix = { value: 0.22 };
  const common = {
    side: DoubleSide,
    forceSinglePass: true,
    clearcoat: 1,
    clearcoatRoughness: mobile ? 0.16 : 0.13,
    metalness: 0.58,
    roughness: 0.19,
    thickness: mobile ? 0.081 : 0.18,
    ior: 1.52,
    envMapIntensity: 1.9,
    attenuationDistance: 1.7,
    iridescenceIOR: 1.3,
  };
  const primary = new MeshPhysicalMaterial({ ...common, color: petalA.value });
  const secondary = new MeshPhysicalMaterial({ ...common, color: petalB.value });
  primary.name = "BLOOM / themed primary PBR";
  secondary.name = "BLOOM / themed secondary PBR";
  primary.iridescenceThicknessRange[0] = secondary.iridescenceThicknessRange[0] = 180;
  primary.iridescenceThicknessRange[1] = secondary.iridescenceThicknessRange[1] = 620;
  primary.userData.themeRole = "primary";
  secondary.userData.themeRole = "secondary";
  primary.userData.mobileGlassFallback = secondary.userData.mobileGlassFallback = mobile;
  const pair = [primary, secondary];
  extendPetalShader(primary, dissolve, accent, { petalA, petalB, mix: gradientMix, reverse: { value: 0 } });
  extendPetalShader(secondary, dissolve, accent, { petalA, petalB, mix: gradientMix, reverse: { value: 1 } });

  return {
    primary,
    secondary,
    applyTheme(frame: ThemeFrame, audioMid = 0) {
      primary.color.copy(frame.petalA);
      secondary.color.copy(frame.petalB);
      petalA.value.copy(frame.petalA);
      petalB.value.copy(frame.petalB);
      accent.value.copy(frame.accent);
      gradientMix.value = normalized(frame.gradientMix);
      const transmission = normalized(frame.transmission);
      for (let index = 0; index < pair.length; index += 1) {
        const material = pair[index];
        material.metalness = normalized(frame.metalness);
        material.roughness = Math.max(0.06, Math.min(1, frame.roughness + (mobile ? transmission * 0.12 : 0) - normalized(audioMid) * 0.025));
        // Mobile keeps the dual-color, clear-coated silhouette without a transmission pass.
        material.transmission = mobile ? 0 : transmission;
        material.thickness = Math.max(0, frame.thickness * (mobile ? 0.45 : 1));
        material.ior = Math.max(1, Math.min(2.333, frame.ior));
        material.clearcoat = normalized(frame.clearcoat);
        material.iridescence = normalized(frame.iridescence);
        material.envMapIntensity = Math.max(0, frame.envMapIntensity);
        material.attenuationColor.copy(frame.secondary);
        material.userData.gradientMix = gradientMix.value;
      }
    },
    setDissolve(value: number) { dissolve.value = normalized(value); },
    dispose() { primary.dispose(); secondary.dispose(); },
  };
}

export const materialColors: Record<FlowerMaterial, string> = {
  silver: "#c8dde9", glass: "#168bff", crimson: "#f04456", violet: "#a46bff",
};
