"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, MathUtils, Object3D,
  ShaderMaterial, type Group, type InstancedMesh, type Mesh, type MeshBasicMaterial,
  type MeshPhysicalMaterial, type PointLight, type Points,
} from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { createPetalDescriptors, FlowerController } from "./FlowerController";
import { createPetalGeometry } from "./PetalGeometry";
import { createThemedFlowerMaterials } from "./FlowerMaterials";
import type { CinematicRuntime } from "@/lib/cinematic-state";
import { samplePetalPose } from "@/lib/petal-cinematic-pose";
import type { ThemeController } from "@/lib/ThemeController";
import type { AudioController } from "@/audio/AudioController";

export interface LocalFlowerPose { weight: number; anchorProgress: number }

export interface FlowerRotation {
  x: number; y: number; velocityX: number; velocityY: number;
  pointerX: number; pointerY: number; dragging: boolean;
}

export interface ProceduralFlowerProps {
  controller: FlowerController;
  theme: ThemeController;
  audio: AudioController;
  mobile?: boolean;
  active?: boolean;
  reducedMotion?: boolean;
  seed?: number;
  glow?: number;
  particles?: boolean;
  lowDetail?: boolean;
  particleFactor?: number;
  rotationRef: MutableRefObject<FlowerRotation>;
  consumeRotation: (delta: number) => void;
  coreHandlers: { onPointerDown: (event: ThreeEvent<PointerEvent>) => void };
  diagnosticRef?: MutableRefObject<HTMLDivElement | null>;
  runtime?: CinematicRuntime;
  userPoseRef?: MutableRefObject<LocalFlowerPose>;
}

function Pollen({ mobile }: { mobile: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const count = mobile ? 40 : 76;
  useLayoutEffect(() => {
    const instances = mesh.current;
    if (!instances) return;
    const dummy = new Object3D();
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const radius = Math.sqrt((i + 0.5) / count) * 0.32;
      const angle = i * goldenAngle;
      dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.37 + Math.sqrt(Math.max(0, 0.11 - radius * radius)) * 0.47);
      dummy.rotation.set(Math.sin(angle) * 0.5, Math.cos(angle) * 0.5, angle);
      dummy.scale.set(0.018, 0.018, 0.045 + Math.sin(i * 2.4) * 0.01);
      dummy.updateMatrix(); instances.setMatrixAt(i, dummy.matrix);
    }
    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingSphere();
  }, [count]);
  return <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
    <sphereGeometry args={[1, 7, 6]} />
    <meshPhysicalMaterial color="#c8bfa6" metalness={0.83} roughness={0.23} clearcoat={0.5} />
  </instancedMesh>;
}

function FloatingParticles({ mobile, lowDetail, enabled, theme, audio, particleFactor, runtime }: { mobile: boolean; lowDetail: boolean; enabled: boolean; theme: ThemeController; audio: AudioController; particleFactor: number; runtime?: CinematicRuntime }) {
  const points = useRef<Group>(null);
  const pointMeshRef=useRef<Points>(null);
  const resources = useMemo(() => {
    const count = Math.max(8, Math.round((lowDetail ? 24 : 56) * particleFactor));
    const positions = new Float32Array(count * 3);
    const palette = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const azimuth = i * 2.399963;
      const radius = 2.6 + ((Math.sin(i * 78.2 + 1.7) + 1) / 2) * 1.4;
      positions[i * 3] = Math.cos(azimuth) * radius;
      positions[i * 3 + 1] = Math.sin(azimuth) * radius * 0.7;
      positions[i * 3 + 2] = Math.sin(i * 13.72) * 1.2;
      palette[i] = i % 2;
    }
    const geometry = new BufferGeometry(); geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("aPalette", new BufferAttribute(palette, 1));
    const material = new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: { uColorA: { value: new Color() }, uColorB: { value: new Color() }, uSpread:{value:1}, uProgress:{value:0}, uOpacity:{value:0.4}, uAudioHigh:{value:0},uTime:{value:0} },
      vertexShader: `attribute float aPalette;varying float vPalette;uniform float uSpread;uniform float uProgress;void main(){vPalette=aPalette;vec3 displaced=position*uSpread;displaced.z+=sin(position.x*2.+uProgress*18.)*(uSpread-1.)*.35;vec4 p=modelViewMatrix*vec4(displaced,1.);gl_PointSize=clamp(18./-p.z,1.,3.);gl_Position=projectionMatrix*p;}`,
      fragmentShader: `varying float vPalette;uniform vec3 uColorA;uniform vec3 uColorB;uniform float uOpacity;uniform float uAudioHigh;uniform float uTime;void main(){float d=length(gl_PointCoord-.5);float shimmer=1.+uAudioHigh*(.4+.25*sin(uTime*5.+vPalette*4.));float a=(1.-smoothstep(.1,.5,d))*uOpacity*shimmer;gl_FragColor=vec4(mix(uColorA,uColorB,vPalette),a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    });
    return { geometry, material };
  }, [lowDetail, particleFactor]);
  useEffect(() => () => { resources.geometry.dispose(); resources.material.dispose(); }, [resources]);
  useFrame((_, delta) => {
    if (!points.current || !enabled) return;
    if (pointMeshRef.current) {
      const uniforms = (pointMeshRef.current.material as ShaderMaterial).uniforms;
      uniforms.uColorA.value.copy(theme.frame.particleA);
      uniforms.uColorB.value.copy(theme.frame.particleB);
      uniforms.uAudioHigh.value = audio.frame.high;
      uniforms.uTime.value += Math.min(delta, 0.05);
    }
    if (runtime) {
      const frame=runtime.frame;
      points.current.position.set(frame.flowerX*(mobile ? .32 : 1),mobile?frame.flowerY*.55+.3:frame.flowerY,frame.flowerZ);
      points.current.rotation.z=frame.progress*.65;
      if(pointMeshRef.current){
        const uniforms=(pointMeshRef.current.material as ShaderMaterial).uniforms;
        uniforms.uSpread.value=frame.particleSpread;
        uniforms.uProgress.value=frame.progress;
        uniforms.uOpacity.value=frame.particleOpacity*.55*theme.frame.particleIntensity;
      }
    } else points.current.rotation.z += Math.min(delta, 0.05) * 0.016;
  });
  return <group ref={points} visible={enabled}><points ref={pointMeshRef} geometry={resources.geometry} material={resources.material} dispose={null} /></group>;
}

/** Persistent meshes: bloom uses transforms and GPU morph targets, never remeshing. */
export function ProceduralFlower({
  controller, theme, audio, mobile = false, active = true, reducedMotion = false,
  seed = 48154, glow = 0.65, particles = true, lowDetail = mobile, particleFactor = 1, rotationRef, consumeRotation, coreHandlers, diagnosticRef, runtime, userPoseRef,
}: ProceduralFlowerProps) {
  const root = useRef<Group>(null);
  const pivots = useRef<(Group | null)[]>([]);
  const petals = useRef<(Mesh | null)[]>([]);
  const core = useRef<Mesh>(null);
  const coreMaterial = useRef<MeshPhysicalMaterial>(null);
  const coreLight = useRef<PointLight>(null);
  const pulseRing = useRef<Mesh>(null);
  const ringMaterial = useRef<MeshBasicMaterial>(null);
  const haloMaterial = useRef<ShaderMaterial>(null);
  const sampleTime = useRef(0);
  const idleTime = useRef(0);
  const pose = useMemo(() => ({x:0,y:0,z:0,rx:0,ry:0,rz:0,angle:0,scale:1,morph:0}),[]);
  const descriptors = useMemo(() => createPetalDescriptors(seed, lowDetail), [seed, lowDetail]);
  const resources = useMemo(() => {
    const options = { segments: lowDetail ? 22 : 34, across: lowDetail ? 8 : 14 };
    const finishes = createThemedFlowerMaterials(lowDetail);
    finishes.applyTheme(theme.frame);
    return {
      geometry: {
        inner: createPetalGeometry({ ...options, bend: 0.42 }),
        middle: createPetalGeometry({ ...options, bend: 0.29 }),
        outer: createPetalGeometry({ ...options, bend: 0.17 }),
      },
      finishes,
    };
  }, [lowDetail, theme]);
  const haloUniforms = useMemo(() => ({ uColor: { value: new Color("#c8dde9") }, uStrength: { value: 0.35 } }), []);
  useEffect(() => () => {
    Object.values(resources.geometry).forEach(geometry => geometry.dispose());
    resources.finishes.dispose();
  }, [resources]);

  useFrame((_, delta) => {
    if (!active || !root.current) return;
    const dt = Math.min(delta, 0.05);
    const colors = theme.frame;
    const low = reducedMotion ? 0 : audio.frame.low;
    const mid = reducedMotion ? 0 : audio.frame.mid;
    const high = reducedMotion ? 0 : audio.frame.high;
    const envelope = reducedMotion ? 0 : audio.frame.envelope;
    resources.finishes.applyTheme(colors, mid);
    controller.update(dt, reducedMotion);
    consumeRotation(dt);
    const interaction = rotationRef.current;
    const time = controller.elapsed;
    const frame=runtime?.frame;
    if(interaction.dragging || Math.abs(interaction.velocityX)+Math.abs(interaction.velocityY)>.02) idleTime.current=0;
    else idleTime.current+=dt;
    if(frame && !reducedMotion && idleTime.current>1.8) {
      interaction.x=MathUtils.damp(interaction.x,0,1.5,dt);
      interaction.y=MathUtils.damp(interaction.y,0,1.5,dt);
    }
    if(frame && userPoseRef && Math.abs(frame.progress-userPoseRef.current.anchorProgress)>.006) userPoseRef.current.weight=reducedMotion?0:MathUtils.damp(userPoseRef.current.weight,0,7,dt);
    const userWeight=userPoseRef?.current.weight ?? 1;
    const bloom=frame?MathUtils.lerp(frame.bloom,controller.openness,userWeight):controller.openness;
    root.current.rotation.set(
      (frame?.rotationX ?? -0.32) + interaction.x + (reducedMotion ? 0 : interaction.pointerY * 0.085),
      (frame?.rotationY ?? -0.22) + interaction.y + (reducedMotion ? 0 : interaction.pointerX * 0.12),
      frame?.rotationZ ?? -0.2,
    );
    root.current.position.set(frame?frame.flowerX*(mobile ? .32 : 1):0,frame?(mobile?frame.flowerY*.55+.3:frame.flowerY):(reducedMotion?0:Math.sin(time*.32)*.035),frame?.flowerZ ?? 0);
    root.current.scale.setScalar((frame?.flowerScale ?? 1)*(frame && mobile ? .65 : 1)*(1+low*.026));
    resources.finishes.setDissolve(frame?frame.dissolve*(1-userWeight):0);
    const charge = reducedMotion ? 0 : controller.charge;
    for (let index = 0; index < descriptors.length; index++) {
      const descriptor = descriptors[index];
      const pivot = pivots.current[index], petal = petals.current[index];
      if (!pivot || !petal) continue;
      const delay = Math.min(0.34, descriptor.delay);
      const openness = MathUtils.smoothstep(bloom, delay, 1);
      const layerIndex = descriptor.layer === "inner" ? 0 : descriptor.layer === "middle" ? 1 : 2;
      const wavePosition = controller.pulseAge * 4.5 - (0.4 + layerIndex * 0.65);
      const wave = reducedMotion ? 0 : Math.exp(-wavePosition * wavePosition * 8) * controller.pulse;
      const burst = reducedMotion ? 0 : controller.burst;
      const vibration = Math.sin(time * 52 + index * 1.71) * charge;
      const audioSway = Math.sin(time * 1.5 + index * 0.7) * mid * 0.022;
      const audioVibration = Math.sin(time * 23 + index * 1.3) * high * 0.0035;
      const radius = descriptor.radius * (0.38 + openness * 0.62);
      const sin = Math.sin(descriptor.angle), cos = Math.cos(descriptor.angle);
      if(frame) {
        samplePetalPose(descriptor,index,frame,pose);
        // A local unfold gesture may override the bloom only; the scroll path stays owned by the master.
        const localRx=(1-openness)*1.12+descriptor.bend*.17;
        pivot.position.set(pose.x+descriptor.burst[0]*burst*.74+interaction.pointerX*frame.scatter*.07*Math.sin(index),pose.y+descriptor.burst[1]*burst*.74+vibration*.012,pose.z+descriptor.burst[2]*burst*.5+wave*.1+interaction.pointerY*frame.scatter*.06*Math.cos(index));
        pivot.rotation.z=pose.angle+vibration*.009;
        petal.rotation.set(MathUtils.lerp(pose.rx,localRx,userWeight)+vibration*.018-wave*.11+audioSway,pose.ry+burst*Math.sin(index*2)*.28+audioVibration,pose.rz);
        petal.scale.set(descriptor.width*descriptor.scale*pose.scale,descriptor.length*descriptor.scale*pose.scale,descriptor.length*descriptor.scale*pose.scale);
        if(petal.morphTargetInfluences)petal.morphTargetInfluences[0]=MathUtils.clamp(MathUtils.lerp(pose.morph,(1-openness)*.85+descriptor.bend*.12,userWeight)+charge*.07,0,1);
        continue;
      }
      pivot.position.set(
        -sin * radius + descriptor.burst[0] * burst * 0.74 + vibration * 0.012,
        cos * radius + descriptor.burst[1] * burst * 0.74,
        0.14 - layerIndex * 0.12 + descriptor.burst[2] * burst * 0.5 + wave * 0.1,
      );
      pivot.rotation.z = descriptor.angle + vibration * 0.009;
      petal.rotation.set(
        (1 - openness) * 1.12 + descriptor.bend * 0.17 - wave * 0.11 + vibration * 0.018 + burst * 0.18 + audioSway,
        descriptor.rotation + burst * Math.sin(index * 2) * 0.28 + audioVibration,
        descriptor.rotation * 0.2,
      );
      // Keep the seeded bend variation in the curved surface itself as well as its pose.
      if (petal.morphTargetInfluences) petal.morphTargetInfluences[0] = MathUtils.clamp((1 - openness) * 0.85 + descriptor.bend * 0.12 + charge * 0.07, 0, 1);
    }
    const energy = reducedMotion ? 0 : controller.pulse * 0.9 + charge * 1.2 + (frame?.wave ?? 0)*.8 + low*.4 + envelope*.14;
    if (core.current) core.current.scale.setScalar(1 + energy * 0.07);
    if (coreMaterial.current) { coreMaterial.current.emissiveIntensity = glow * ((frame?.coreLight ?? .32) + energy * 1.6) * colors.coreIntensity; coreMaterial.current.emissive.copy(colors.core); }
    if (coreLight.current) { coreLight.current.intensity = glow * ((frame?.coreLight ?? 1.5) + energy * 5) * colors.coreIntensity; coreLight.current.color.copy(colors.core); }
    if (haloMaterial.current) { haloMaterial.current.uniforms.uStrength.value = glow * (0.25 + energy * 0.35); haloMaterial.current.uniforms.uColor.value.copy(colors.core); }
    if (pulseRing.current && ringMaterial.current) {
      const storyWave=frame?.wave ?? 0;
      const radius = storyWave>0 ? .7+MathUtils.clamp(((frame?.progress ?? 0)-.84)/.125,0,1)*7 : 0.7 + Math.min(controller.pulseAge, 1.1) * 4.5;
      pulseRing.current.scale.setScalar(radius);
      ringMaterial.current.color.copy(colors.accent);
      ringMaterial.current.opacity = reducedMotion ? 0 : Math.max(controller.pulse,storyWave) * 0.45;
      pulseRing.current.visible = !reducedMotion && Math.max(controller.pulse,storyWave)>0.001;
    }
    sampleTime.current += dt;
    if (diagnosticRef?.current && (sampleTime.current > 0.1 || reducedMotion)) {
      const element = diagnosticRef.current;
      element.dataset.openness = bloom.toFixed(3);
      element.dataset.charge = controller.charge.toFixed(3);
      element.dataset.burst = controller.burst.toFixed(3);
      element.dataset.pulse = controller.pulse.toFixed(3);
      element.dataset.rotation = `${interaction.x.toFixed(3)},${interaction.y.toFixed(3)}`;
      element.dataset.petalA = resources.finishes.primary.color.getHexString();
      element.dataset.petalB = resources.finishes.secondary.color.getHexString();
      element.dataset.petalMaterialIds = `${resources.finishes.primary.uuid},${resources.finishes.secondary.uuid}`;
      element.dataset.petalTransmission = resources.finishes.primary.transmission.toFixed(5);
      element.dataset.petalMetalness = resources.finishes.primary.metalness.toFixed(5);
      element.dataset.petalRoughness = resources.finishes.primary.roughness.toFixed(5);
      element.dataset.petalGradient = colors.gradientMix.toFixed(5);
      element.dataset.coreColor = coreMaterial.current?.emissive.getHexString() ?? "";
      element.dataset.particleColors = `${colors.particleA.getHexString()},${colors.particleB.getHexString()}`;
      element.dataset.audioLow = low.toFixed(4);
      element.dataset.audioMid = mid.toFixed(4);
      element.dataset.audioHigh = high.toFixed(4);
      element.dataset.audioEnvelope = envelope.toFixed(4);
      element.dataset.flowerScale = root.current.scale.x.toFixed(5);
      element.dataset.coreEnergy = energy.toFixed(5);
      element.dataset.particleCount = String(Math.max(8, Math.round((lowDetail ? 24 : 56)*particleFactor)));
      sampleTime.current = 0;
    }
  });

  return <>
    <FloatingParticles mobile={mobile} lowDetail={lowDetail} enabled={particles && !reducedMotion && active} theme={theme} audio={audio} particleFactor={particleFactor} runtime={runtime}/>
    <group ref={root} name="procedural-flower" userData={{ petalCount: descriptors.length, seed }}>
      <group dispose={null}>{descriptors.map((petal, index) => <group key={petal.id} ref={element => { pivots.current[index] = element; }}>
        <mesh ref={element => { petals.current[index] = element; }} onUpdate={mesh => mesh.updateMorphTargets()} name={`petal-${petal.layer}-${petal.id}`} geometry={resources.geometry[petal.layer]} material={index % 2 ? resources.finishes.secondary : resources.finishes.primary} scale={[petal.width * petal.scale, petal.length * petal.scale, petal.length * petal.scale]} />
      </group>)}</group>
      <mesh ref={core} position={[0, 0, 0.3]}>
        <sphereGeometry args={[0.29, mobile ? 20 : 32, mobile ? 16 : 24]} />
        <meshPhysicalMaterial ref={coreMaterial} color="#a7a18b" metalness={0.78} roughness={0.34} clearcoat={0.5} emissive="#f04456" emissiveIntensity={0.2} />
      </mesh>
      <Pollen mobile={lowDetail}/>
      <pointLight ref={coreLight} position={[0, 0, 0.9]} color="#f04456" distance={4.8} decay={2} intensity={2} />
      <mesh name="flower-core-hit-target" position={[0, 0, 0.38]} {...coreHandlers}>
        <sphereGeometry args={[0.47, 12, 12]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.65]} raycast={() => null}>
        <planeGeometry args={[2.2, 2.2]} />
        <shaderMaterial ref={haloMaterial} transparent depthWrite={false} blending={AdditiveBlending} uniforms={haloUniforms}
          vertexShader={`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
          fragmentShader={`varying vec2 vUv;uniform vec3 uColor;uniform float uStrength;void main(){float d=length(vUv-.5);float a=exp(-d*d*32.)*uStrength;gl_FragColor=vec4(uColor,a*.45);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          }`}/>
      </mesh>
      <mesh ref={pulseRing} position={[0, 0, 0.73]} visible={false} raycast={() => null}>
        <ringGeometry args={[0.47, 0.478, mobile ? 48 : 96]} /><meshBasicMaterial ref={ringMaterial} color="#f04456" transparent opacity={0} depthWrite={false} blending={AdditiveBlending}/>
      </mesh>
    </group>
  </>;
}
