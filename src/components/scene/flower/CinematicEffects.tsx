"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import {
  Color, DepthFormat, DepthTexture, HalfFloatType, LinearFilter, Mesh,
  NoBlending, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial,
  UnsignedIntType, Vector2, Vector3, Vector4, WebGLRenderTarget,
  type PerspectiveCamera, type WebGLRenderer,
} from "three";
import type { CinematicRuntime } from "@/lib/cinematic-state";
import type { ThemeController } from "@/lib/ThemeController";

export interface CinematicEffectsProps {
  active: boolean;
  runtime: CinematicRuntime;
  theme: ThemeController;
  onFailure: () => void;
}

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform vec2 uPixel;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uDeadband;
uniform float uBloomStrength;
uniform float uPremultiplied;
varying vec2 vUv;

float viewDistance(float depth) {
  return uNear * uFar / max(uFar - depth * (uFar - uNear), 0.00001);
}

vec4 gather(vec2 offset) {
  return texture2D(uColor, clamp(vUv + offset, uPixel * 0.5, 1.0 - uPixel * 0.5));
}

vec3 highlights(vec2 offset) {
  vec3 color = gather(offset).rgb;
  float brightest = max(max(color.r, color.g), color.b);
  // HDR-only extraction: ordinary surfaces and type do not acquire a glow.
  return color * max(brightest - 1.1, 0.0) / max(brightest, 0.0001);
}

void main() {
  vec4 source = texture2D(uColor, vUv);
  float distance = viewDistance(texture2D(uDepth, vUv).x);
  // Broad focus around the heart preserves petal details and keeps depth type legible.
  float radius = min(2.0, max(abs(distance - uFocus) - uDeadband, 0.0) * 0.22);
  vec2 stepSize = uPixel * radius;
  vec4 color = source;
  if (radius > 0.05) {
    color = source * 0.3;
    color += gather(stepSize * vec2( 1.0,  0.0)) * 0.0875;
    color += gather(stepSize * vec2(-1.0,  0.0)) * 0.0875;
    color += gather(stepSize * vec2( 0.0,  1.0)) * 0.0875;
    color += gather(stepSize * vec2( 0.0, -1.0)) * 0.0875;
    color += gather(stepSize * vec2( 0.7071,  0.7071)) * 0.0875;
    color += gather(stepSize * vec2(-0.7071,  0.7071)) * 0.0875;
    color += gather(stepSize * vec2( 0.7071, -0.7071)) * 0.0875;
    color += gather(stepSize * vec2(-0.7071, -0.7071)) * 0.0875;
  }

  vec2 glowStep = uPixel * 6.0;
  vec3 bloom = highlights(glowStep * vec2( 1.0,  0.0));
  bloom += highlights(glowStep * vec2(-1.0,  0.0));
  bloom += highlights(glowStep * vec2( 0.0,  1.0));
  bloom += highlights(glowStep * vec2( 0.0, -1.0));
  bloom += highlights(glowStep * vec2( 0.7071,  0.7071));
  bloom += highlights(glowStep * vec2(-0.7071,  0.7071));
  bloom += highlights(glowStep * vec2( 0.7071, -0.7071));
  bloom += highlights(glowStep * vec2(-0.7071, -0.7071));
  bloom *= uBloomStrength * 0.125;

  // RT blending stores premultiplied coverage. Unpremultiply before applying
  // display transforms, then restore canvas coverage after the sRGB conversion.
  float glowAlpha = clamp(max(max(bloom.r, bloom.g), bloom.b) * 0.45, 0.0, 1.0);
  float alpha = max(color.a, glowAlpha);
  vec3 linearColor = (color.rgb + bloom) / max(alpha, 0.0001);
  gl_FragColor = vec4(linearColor, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb *= mix(1.0, alpha, uPremultiplied);
}
`;

function createResources(gl: WebGLRenderer) {
  const depth = new DepthTexture(1, 1, UnsignedIntType);
  depth.format = DepthFormat;
  const target = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
    depthTexture: depth,
    generateMipmaps: false,
  });
  target.texture.name = "BLOOM / cinematic HDR scene";
  depth.name = "BLOOM / cinematic depth";
  const material = new ShaderMaterial({
    name: "BLOOM / bounded depth of field + HDR bloom",
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
    toneMapped: true,
    uniforms: {
      uColor: { value: target.texture },
      uDepth: { value: depth },
      uPixel: { value: new Vector2(1, 1) },
      uNear: { value: 0.1 },
      uFar: { value: 45 },
      uFocus: { value: 12 },
      uDeadband: { value: 1.1 },
      uBloomStrength: { value: 0.15 },
      uPremultiplied: { value: gl.getContext().getContextAttributes()?.premultipliedAlpha ? 1 : 0 },
    },
    vertexShader,
    fragmentShader,
  });
  const geometry = new PlaneGeometry(2, 2);
  const quad = new Mesh(geometry, material);
  quad.frustumCulled = false;
  const postScene = new Scene();
  postScene.add(quad);
  const postCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const resources = {
    target, material, geometry, postScene, postCamera,
    drawingSize: new Vector2(),
    focus: new Vector3(),
    clearColor: new Color(),
    viewport: new Vector4(),
    scissor: new Vector4(),
    shaderFailed: false,
    validateTarget: true,
    onShaderError: () => { resources.shaderFailed = true; },
    dispose() {
      postScene.remove(quad);
      geometry.dispose();
      material.dispose();
      // WebGLRenderTarget owns and disposes its attached DepthTexture as well.
      target.dispose();
    },
  };
  return resources;
}

type EffectResources = ReturnType<typeof createResources>;

/** Two real GPU passes; the transparent canvas continues to reveal the CSS atmosphere. */
export function CinematicEffects({ active, runtime, theme, onFailure }: CinematicEffectsProps) {
  const { gl, invalidate } = useThree();
  const resourcesRef = useRef<EffectResources | null>(null);
  const failedRef = useRef(false);

  useEffect(() => {
    failedRef.current = false;
    let resources: EffectResources | null = null;
    try {
      if (!gl.extensions.has("EXT_color_buffer_float")) throw new Error("HDR targets unavailable");
      resources = createResources(gl);
      resourcesRef.current = resources;
      invalidate();
    } catch {
      resources?.dispose();
      failedRef.current = true;
      onFailure();
    }
    return () => {
      resourcesRef.current = null;
      resources?.dispose();
    };
  }, [gl, invalidate, onFailure]);

  useFrame(({ gl: renderer, scene, camera, size }) => {
    if (!active) return;
    const resources = resourcesRef.current;
    if (!resources || failedRef.current) {
      renderer.render(scene, camera);
      return;
    }

    const previousTarget = renderer.getRenderTarget();
    const previousCubeFace = renderer.getActiveCubeFace();
    const previousMipmapLevel = renderer.getActiveMipmapLevel();
    const previousClearAlpha = renderer.getClearAlpha();
    const previousAutoClear = renderer.autoClear;
    const previousScissorTest = renderer.getScissorTest();
    const previousInfoAutoReset = renderer.info.autoReset;
    const previousShaderError = renderer.debug.onShaderError;
    renderer.getClearColor(resources.clearColor);
    renderer.getViewport(resources.viewport);
    renderer.getScissor(resources.scissor);
    let failed = false;

    try {
      renderer.getDrawingBufferSize(resources.drawingSize);
      const width = Math.max(1, Math.floor(resources.drawingSize.x * 0.85));
      const height = Math.max(1, Math.floor(resources.drawingSize.y * 0.85));
      if (resources.target.width !== width || resources.target.height !== height) {
        resources.target.setSize(width, height);
        resources.validateTarget = true;
      }
      const uniforms = resources.material.uniforms;
      uniforms.uPixel.value.set(1 / resources.drawingSize.x, 1 / resources.drawingSize.y);
      const perspective = camera as PerspectiveCamera;
      uniforms.uNear.value = perspective.near;
      uniforms.uFar.value = perspective.far;
      const frame = runtime.frame;
      resources.focus.set(frame.flowerX, frame.flowerY, frame.flowerZ).applyMatrix4(camera.matrixWorldInverse);
      uniforms.uFocus.value = Math.max(perspective.near, -resources.focus.z);
      uniforms.uDeadband.value = 1.1 * frame.flowerScale;
      uniforms.uBloomStrength.value = Math.min(0.18, Math.max(0.12, 0.12 + theme.frame.coreIntensity * 0.015 + frame.shock * 0.02));

      renderer.info.autoReset = false;
      renderer.info.reset();
      renderer.debug.onShaderError = resources.onShaderError;
      renderer.autoClear = true;
      renderer.setScissorTest(false);
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(resources.target);
      if (resources.validateTarget) {
        const context = renderer.getContext();
        if (context.checkFramebufferStatus(context.FRAMEBUFFER) !== context.FRAMEBUFFER_COMPLETE) {
          throw new Error("HDR framebuffer incomplete");
        }
        resources.validateTarget = false;
      }
      // Three.js renders to a linear HDR target without display tone mapping.
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.setViewport(0, 0, size.width, size.height);
      // Only this output pass applies the renderer's tone mapping and color space.
      renderer.render(resources.postScene, resources.postCamera);
      if (resources.shaderFailed) throw new Error("Cinematic shader compilation failed");
    } catch {
      failed = true;
      failedRef.current = true;
    } finally {
      renderer.setRenderTarget(previousTarget, previousCubeFace, previousMipmapLevel);
      renderer.setViewport(resources.viewport);
      renderer.setScissor(resources.scissor);
      renderer.setScissorTest(previousScissorTest);
      renderer.setClearColor(resources.clearColor, previousClearAlpha);
      renderer.autoClear = previousAutoClear;
      renderer.info.autoReset = previousInfoAutoReset;
      renderer.debug.onShaderError = previousShaderError;
    }
    if (failed) {
      // Three may attempt one draw with an unlinked optional program before its
      // diagnostic callback returns. Acknowledge that failed pass's GL errors;
      // the compositor is now permanently disabled, and the scene renders anew.
      const context = renderer.getContext();
      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (context.getError() === context.NO_ERROR) break;
      }
      // Keep the same frame visible even before React removes this component.
      renderer.render(scene, camera);
      onFailure();
    }
  }, 1);

  return null;
}
