"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, Color, LinearFilter, MathUtils, PlaneGeometry, ShaderMaterial, SRGBColorSpace, type Mesh } from "three";
import type { CinematicRuntime } from "@/lib/cinematic-state";
import type { ThemeController } from "@/lib/ThemeController";

export interface CinematicTypographyProps {
  runtime: CinematicRuntime;
  theme: ThemeController;
  mobile: boolean;
  lowDetail?: boolean;
  active: boolean;
  reducedMotion: boolean;
}

const words = ["GENESIS", "FRACTURE", "REBORN"] as const;
const colors = ["#b3bec3", "#cc4f5d", "#d8d3cb"] as const;
const offsets = [-0.4, 0.2, -0.25] as const;
const ignoreRaycast = () => {};

const vertexShader = /* glsl */ `
varying vec2 vBloomTextUv;
void main() {
  vBloomTextUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uGlyphs;
uniform vec3 uColor;
uniform float uReveal;
uniform float uOpacity;
varying vec2 vBloomTextUv;

void main() {
  float glyph = texture2D(uGlyphs, vBloomTextUv).a;
  float curtain = mix(-0.04, 1.04, uReveal);
  float reveal = 1.0 - smoothstep(curtain - 0.035, curtain + 0.035, vBloomTextUv.x);
  float alpha = glyph * reveal * uOpacity;
  if (alpha < 0.015) discard;
  gl_FragColor = vec4(uColor, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function makeGlyphTexture(word: string, mobile: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = mobile ? 1024 : 2048;
  canvas.height = mobile ? 128 : 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("BLOOM typography needs a 2D canvas context.");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = `900 ${Math.round(canvas.height * 0.9)}px Arial, Helvetica, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#ffffff";
  const scaleX = canvas.width * 0.94 / Math.max(1, context.measureText(word).width);
  context.setTransform(scaleX, 0, 0, 1, canvas.width / 2, canvas.height * 0.535);
  context.fillText(word, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.name = `BLOOM / ${word} / local system type`;
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function createTypographyResources(mobile: boolean) {
  const geometry = new PlaneGeometry(1, 1);
  const entries = words.map((word, index) => {
    const texture = makeGlyphTexture(word, mobile);
    const material = new ShaderMaterial({
      name: `BLOOM / ${word} / depth typography`,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uGlyphs: { value: texture },
        uColor: { value: new Color(colors[index]) },
        uReveal: { value: 0 },
        uOpacity: { value: 0 },
      },
      vertexShader,
      fragmentShader,
    });
    return { texture, material };
  });
  let owners = 0;
  let disposed = false;
  return {
    geometry,
    entries,
    retain() { owners += 1; },
    release() {
      owners -= 1;
      // A replayed StrictMode effect retains the same resource before this runs.
      // A real unmount has no owner and releases every GPU object exactly once.
      queueMicrotask(() => {
        if (owners !== 0 || disposed) return;
        disposed = true;
        geometry.dispose();
        for (const entry of entries) { entry.material.dispose(); entry.texture.dispose(); }
      });
    },
  };
}

/** The letters occupy the same depth buffer as the flower; no DOM overlay or font fetch. */
export function CinematicTypography({ runtime, theme, mobile, lowDetail = mobile, active, reducedMotion }: CinematicTypographyProps) {
  const meshes = useRef<(Mesh | null)[]>([]);
  const resources = useMemo(() => createTypographyResources(lowDetail), [lowDetail]);

  useEffect(() => {
    resources.retain();
    return () => resources.release();
  }, [resources]);

  useFrame(({ camera }) => {
    const frame = runtime.frame;
    for (let index = 0; index < words.length; index += 1) {
      const mesh = meshes.current[index];
      if (!mesh) continue;
      const source = index === 0 ? frame.genesisReveal : index === 1 ? frame.fractureReveal : frame.rebornReveal;
      const reveal = MathUtils.clamp(source, 0, 1);
      const uniforms = (mesh.material as ShaderMaterial).uniforms;
      uniforms.uColor.value.copy(index === 1 ? theme.frame.accent : theme.frame.secondary);
      mesh.visible = active && reveal > 0.001;
      uniforms.uReveal.value = reducedMotion && reveal > 0.001 ? 1 : reveal;
      uniforms.uOpacity.value = Math.min(1, reveal * 2.5) * (index === 1 ? 0.82 : index === 2 ? (mobile ? 0 : 0.06) : 0.66);
      mesh.position.set(frame.flowerX * (mobile ? .32 : 1) + (index === 1 ? 0.08 : 0), (mobile ? frame.flowerY*.55+.3 : frame.flowerY) + (index === 2 ? 0.12 : 0), frame.flowerZ + offsets[index]);
      mesh.quaternion.copy(camera.quaternion);
      mesh.scale.set(mobile ? 4.0 : index === 1 ? 8.8 : 8.2, mobile ? 0.75 : 1.18, 1);
    }
  });

  return <group name="cinematic-depth-typography" dispose={null} visible={active}>
    {words.map((word, index) => <mesh key={word} name={`cinematic-type-${word.toLowerCase()}`} ref={mesh => { meshes.current[index] = mesh; }} geometry={resources.geometry} material={resources.entries[index].material} raycast={ignoreRaycast} visible={false} />)}
  </group>;
}
