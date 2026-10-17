"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, TorusKnotGeometry, type Group } from "three";

export type MaterialStudyProps = {
  active: boolean;
  reducedMotion: boolean;
  mobile: boolean;
  onReady: () => void;
  onUnavailable: () => void;
};

function UnsupportedCanvas({ onUnavailable }: { onUnavailable: () => void }) {
  // Missing WebGL is an expected device capability, not a rendering exception.
  useEffect(() => onUnavailable(), [onUnavailable]);
  return null;
}

/** A small, original geometry study; the later flower scene can replace it. */
function makeRibbedKnot() {
  const tubularSegments = 180;
  const radialSegments = 28;
  const geometry = new TorusKnotGeometry(1, 0.34, tubularSegments, radialSegments, 2, 3);
  const positions = geometry.getAttribute("position");

  // Modulate the tube's radius, adding shallow machined ribs without a texture.
  for (let ring = 0; ring <= tubularSegments; ring += 1) {
    let centerX = 0;
    let centerY = 0;
    let centerZ = 0;
    const offset = ring * (radialSegments + 1);

    for (let side = 0; side < radialSegments; side += 1) {
      centerX += positions.getX(offset + side) / radialSegments;
      centerY += positions.getY(offset + side) / radialSegments;
      centerZ += positions.getZ(offset + side) / radialSegments;
    }

    const rib = 1 + 0.038 * Math.cos((ring / tubularSegments) * Math.PI * 2 * 36);

    for (let side = 0; side <= radialSegments; side += 1) {
      const vertex = offset + side;
      positions.setXYZ(
        vertex,
        centerX + (positions.getX(vertex) - centerX) * rib,
        centerY + (positions.getY(vertex) - centerY) * rib,
        centerZ + (positions.getZ(vertex) - centerZ) * rib,
      );
    }
  }

  geometry.computeVertexNormals();
  return geometry;
}

function Form({ active, reducedMotion, mobile }: Pick<MaterialStudyProps, "active" | "reducedMotion" | "mobile">) {
  const formRef = useRef<Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const geometry = useMemo(() => makeRibbedKnot(), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    if (!active || reducedMotion || !window.matchMedia("(pointer: fine)").matches) return;

    function handlePointerMove(event: PointerEvent) {
      pointer.current.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.current.y = (event.clientY / window.innerHeight - 0.5) * 2;
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [active, reducedMotion]);

  useFrame(({ clock }, delta) => {
    const form = formRef.current;
    if (!form || !active || reducedMotion) return;

    const step = Math.min(delta, 0.05);
    const time = clock.elapsedTime;
    form.rotation.x = MathUtils.damp(
      form.rotation.x,
      0.38 + pointer.current.y * 0.1 + Math.sin(time * 0.2) * 0.035,
      2.2,
      step,
    );
    form.rotation.y = MathUtils.damp(
      form.rotation.y,
      -0.4 + pointer.current.x * 0.16 + Math.sin(time * 0.15) * 0.13,
      2.2,
      step,
    );
    form.rotation.z = MathUtils.damp(form.rotation.z, -0.5 + Math.sin(time * 0.13) * 0.025, 2, step);
    form.position.y = MathUtils.damp(form.position.y, Math.sin(time * 0.35) * 0.045, 2, step);
  });

  return (
    <group position={[mobile ? 0.22 : 1.25, mobile ? 0.22 : 0.1, 0]}>
      <group ref={formRef} rotation={[0.38, -0.4, -0.5]} scale={mobile ? 1.02 : 1.13}>
        <mesh geometry={geometry}>
          <meshPhysicalMaterial
            color="#aebbc4"
            metalness={1}
            roughness={0.2}
            clearcoat={0.7}
            clearcoatRoughness={0.15}
            envMapIntensity={1.65}
          />
        </mesh>
      </group>
    </group>
  );
}

function Studio() {
  return (
    <>
      <ambientLight intensity={0.12} />
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={6}
          color="#edf5ff"
          position={[0, 5, -2]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[7, 3, 1]}
        />
        <Lightformer
          form="rect"
          intensity={4}
          color="#c8dde9"
          position={[5, 1, 3]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[2, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={8}
          color="#f04456"
          position={[-4, -0.5, 1]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[2, 5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={3}
          color="#ffffff"
          position={[0, -3, 4]}
          rotation={[-Math.PI / 3, 0, 0]}
          scale={[8, 0.7, 1]}
        />
      </Environment>
    </>
  );
}

export function MaterialStudy({ active, reducedMotion, mobile, onReady, onUnavailable }: MaterialStudyProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 8.4], fov: mobile ? 41 : 34, near: 0.1, far: 40 }}
      dpr={[1, mobile ? 1.25 : 1.5]}
      frameloop={active && !reducedMotion ? "always" : "demand"}
      gl={{ alpha: true, antialias: !mobile, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        gl.setClearColor("#0a0a0c", 0);
        onReady();
      }}
      fallback={<UnsupportedCanvas onUnavailable={onUnavailable} />}
    >
      <Studio />
      <Form active={active} reducedMotion={reducedMotion} mobile={mobile} />
    </Canvas>
  );
}
