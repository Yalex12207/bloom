import {
  BackSide, DoubleSide, HalfFloatType, Mesh, ShaderMaterial, UnsignedByteType, WebGLRenderTarget,
  type Camera, type MeshPhysicalMaterial, type Scene, type WebGLRenderer,
} from "three";
import { createThemedFlowerMaterials } from "./FlowerMaterials";

/** Retain the four physical feature variants so the first chapter change can reuse them. */
export function createScenePreparation(gl: WebGLRenderer, scene: Scene, camera: Camera, constrained: boolean) {
  const finishes = createThemedFlowerMaterials(constrained);
  const hdr = !constrained ? new WebGLRenderTarget(1, 1, {
    type: gl.extensions.has("EXT_color_buffer_float") ? HalfFloatType : UnsignedByteType,
    depthBuffer: false,
  }) : null;
  let disposed = false;
  let proxy: Mesh | null = null;
  let started = false;
  let ready = false;

  async function compile(object: Mesh | Scene, target: WebGLRenderTarget | null) {
    if (disposed) return;
    const previous = gl.getRenderTarget();
    const face = gl.getActiveCubeFace();
    const mip = gl.getActiveMipmapLevel();
    let pending: Promise<unknown>;
    try {
      gl.setRenderTarget(target);
      // compileAsync snapshots the output target and lights before yielding.
      pending = gl.compileAsync(object, camera, scene);
    } finally { gl.setRenderTarget(previous, face, mip); }
    await pending;
  }

  return {
    get started() { return started; },
    get ready() { return ready; },
    get disposed() { return disposed; },
    async start() {
      if (started || disposed) return;
      started = true;
      let petal: Mesh | null = null;
      scene.traverse(object => {
        const mesh = object as Mesh;
        if (!petal && mesh.isMesh && (mesh.material as MeshPhysicalMaterial)?.userData.themeRole) petal = mesh;
        const material = mesh.material;
        if (material instanceof ShaderMaterial && material.uniforms.uGlyphs?.value) {
          gl.initTexture(material.uniforms.uGlyphs.value);
        }
      });
      if (!petal) throw new Error("Flower geometry was not prepared");
      // The proxy owns no geometry, is never attached or drawn, and matches the
      // live morph attributes. Its materials keep linked programs alive in Three.
      proxy = new Mesh((petal as Mesh).geometry, finishes.primary);
      const variants = constrained ? [[0, 0], [0, 1]] : [[0, 0], [.82, 0], [0, 1], [.58, 1]];
      const targets = hdr ? [null, hdr] : [null];
      for (const target of targets) {
        await compile(scene, target);
        for (const [transmission, iridescence] of variants) {
          if (disposed) return;
          finishes.primary.transmission = transmission;
          finishes.primary.iridescence = iridescence;
          finishes.primary.side = DoubleSide;
          await compile(proxy, target);
          // Three also draws the back faces of transmissive DoubleSide petals
          // into its linear transmission buffer, with a separate shader key.
          if (transmission > 0 && target === hdr) {
            finishes.primary.side = BackSide;
            await compile(proxy, target);
            finishes.primary.side = DoubleSide;
          }
        }
      }
      if (!disposed) ready = true;
    },
    dispose() {
      disposed = true;
      proxy = null;
      finishes.dispose();
      hdr?.dispose();
    },
  };
}
