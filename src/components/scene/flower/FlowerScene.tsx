"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { createPortal } from "react-dom";
import { Environment, Lightformer } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type MutableRefObject } from "react";
import { ACESFilmicToneMapping, type DirectionalLight, type AmbientLight, type PointLight } from "three";
import { FlowerController, type FlowerState } from "./FlowerController";
import { FLOWER_MATERIALS, materialColors, materialLabels, type FlowerMaterial } from "./FlowerMaterials";
import { ProceduralFlower, type LocalFlowerPose } from "./ProceduralFlower";
import { CinematicCamera } from "./CinematicCamera";
import { CinematicTypography } from "./CinematicTypography";
import { CinematicEffects } from "./CinematicEffects";
import { createScenePreparation } from "./ScenePreparation";
import { useCinematicRuntime } from "@/components/effects/cinematic-context";
import { useThemeController, useThemeSnapshot } from "@/components/theme/ThemeProvider";
import { useAudioController } from "@/components/audio/AudioProvider";
import type { AudioController } from "@/audio/AudioController";
import { FrameBudget, qualitySettings, type QualityTier } from "@/lib/FrameBudget";
import type { ThemeController, ThemeId } from "@/lib/ThemeController";
import type { CinematicRuntime } from "@/lib/cinematic-state";
import { useFlowerInteraction } from "@/hooks/useFlowerInteraction";
import styles from "./flower-scene.module.css";

export type FlowerSceneProps = { active: boolean; reducedMotion: boolean; mobile: boolean; onReady: () => void; onUnavailable: () => void };
const MATERIAL_THEMES: Record<FlowerMaterial, ThemeId> = { silver: "SILVER", glass: "AZURE", crimson: "CRIMSON", violet: "VIOLET" };
const coarseQuery = "(pointer: coarse)";
function subscribePointer(notify: () => void) {
  const media = window.matchMedia(coarseQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
function coarsePointer() { return window.matchMedia(coarseQuery).matches; }

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch { return false; }
}

function Unsupported({ onUnavailable }: { onUnavailable: () => void }) {
  useEffect(() => onUnavailable(), [onUnavailable]);
  return null;
}

function RenderLifecycle({ active, reducedMotion, requestFrameRef, onReady, onUnavailable, diagnosticRef, theme, audio, budget, tier, onTier, constrained }: {
  active: boolean; reducedMotion: boolean; requestFrameRef: MutableRefObject<() => void>;
  onReady: () => void; onUnavailable: () => void; diagnosticRef: MutableRefObject<HTMLDivElement | null>;
  theme: ThemeController;
  audio: AudioController; budget: FrameBudget; tier: QualityTier; onTier: (tier: QualityTier) => void;
  constrained: boolean;
}) {
  const { gl, scene, camera, invalidate } = useThree();
  const frames = useRef(0);
  const preparation = useRef<ReturnType<typeof createScenePreparation> | null>(null);
  const timing = useRef({ seconds: 0, frames: 0 });
  useEffect(() => {
    const resources = createScenePreparation(gl, scene, camera, constrained);
    preparation.current = resources;
    invalidate();
    return () => { preparation.current = null; resources.dispose(); };
  }, [gl, scene, camera, constrained, invalidate]);
  useEffect(() => {
    requestFrameRef.current = invalidate;
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onUnavailable(); };
    canvas.addEventListener("webglcontextlost", lost); invalidate();
    return () => { requestFrameRef.current = () => {}; canvas.removeEventListener("webglcontextlost", lost); };
  }, [gl, invalidate, onUnavailable, requestFrameRef]);
  useEffect(() => { if (active) invalidate(); }, [active, reducedMotion, invalidate]);
  useEffect(() => theme.subscribeFrame(() => { if (active) invalidate(); }), [theme, active, invalidate]);
  useEffect(() => audio.subscribeFrame(() => { if (active && !reducedMotion) invalidate(); }), [audio, active, reducedMotion, invalidate]);
  useFrame((_, delta) => {
    frames.current++;
    const preparing = preparation.current;
    if (frames.current >= 2 && preparing && !preparing.started) {
      void preparing.start().then(() => {
        if (!preparing.disposed) { onReady(); invalidate(); }
      }).catch(() => { if (!preparing.disposed) onUnavailable(); });
    }
    if ((active && !reducedMotion) || frames.current < 3) invalidate();
    if (active && !reducedMotion && preparing?.ready) {
      const next = budget.sample(delta);
      if (next !== tier) onTier(next);
      if (delta < 0.25) { timing.current.seconds += delta; timing.current.frames += 1; }
    }
    if (diagnosticRef.current && frames.current % 20 === 0) {
      diagnosticRef.current.dataset.geometries = String(gl.info.memory.geometries);
      diagnosticRef.current.dataset.textures = String(gl.info.memory.textures);
      diagnosticRef.current.dataset.drawCalls = String(gl.info.render.calls);
      diagnosticRef.current.dataset.programs = String(gl.info.programs?.length ?? 0);
      diagnosticRef.current.dataset.measuredFps = timing.current.seconds > 0 ? (timing.current.frames / timing.current.seconds).toFixed(1) : "0";
      timing.current.seconds = 0; timing.current.frames = 0;
    }
  });
  return null;
}

function Studio({ mobile, runtime, theme, audio, reducedMotion, diagnosticRef }: { mobile: boolean; runtime: CinematicRuntime; theme: ThemeController; audio: AudioController; reducedMotion: boolean; diagnosticRef: MutableRefObject<HTMLDivElement | null> }) {
  const ambientRef=useRef<AmbientLight>(null);
  const keyRef=useRef<DirectionalLight>(null);
  const rimRef=useRef<DirectionalLight>(null);
  const fillRef=useRef<PointLight>(null);
  const diagnosticTime=useRef(0);
  useFrame((_,delta)=>{
    const frame=runtime.frame;
    const colors=theme.frame;
    const bass = reducedMotion ? 0 : audio.frame.low;
    if(ambientRef.current){ambientRef.current.intensity=.08+(1-frame.dissolve)*.22;ambientRef.current.color.copy(colors.keyLight);}
    if(keyRef.current){keyRef.current.intensity=frame.keyLight*colors.keyIntensity*(1+bass*.16);keyRef.current.position.set(-3+Math.sin(frame.progress*Math.PI*3)*3,5,6);keyRef.current.color.copy(colors.keyLight);}
    if(rimRef.current){rimRef.current.intensity=frame.rimLight*colors.rimIntensity;rimRef.current.color.copy(colors.rimLight);}
    if(fillRef.current){fillRef.current.color.copy(colors.fillLight);fillRef.current.intensity=12*colors.fillIntensity;}
    diagnosticTime.current+=delta;
    if(diagnosticRef.current && diagnosticTime.current>.1){
      diagnosticRef.current.dataset.lightColors=`${colors.keyLight.getHexString()},${colors.rimLight.getHexString()},${colors.fillLight.getHexString()}`;
      diagnosticRef.current.dataset.keyIntensity=keyRef.current?.intensity.toFixed(5) ?? "0";
      diagnosticTime.current=0;
    }
  });
  return <>
    <ambientLight ref={ambientRef} intensity={0.3} color="#c8dde9" />
    <directionalLight ref={keyRef} position={[-3, 5, 6]} color="#fff3e3" intensity={3.2}/>
    <directionalLight ref={rimRef} position={[4, 1, -2]} color="#85bfff" intensity={4.6}/>
    <pointLight ref={fillRef} position={[-4, -1, 3]} color="#f04456" intensity={12} distance={12}/>
    <Environment resolution={mobile ? 64 : 128} frames={1}>
      <Lightformer form="rect" intensity={5} color="#f2f5ff" position={[-3, 4, 4]} rotation={[0, Math.PI / 4, 0]} scale={[3, 6, 1]}/>
      <Lightformer form="rect" intensity={4.5} color="#dbe9f5" position={[4, 1, 2]} rotation={[0, -Math.PI / 3, 0]} scale={[2, 6, 1]}/>
      <Lightformer form="rect" intensity={4} color="#c8dde9" position={[-4, -2, 1]} rotation={[0, Math.PI / 2, 0]} scale={[2, 5, 1]}/>
      <Lightformer form="rect" intensity={3.2} color="#ffffff" position={[0, -4, 4]} rotation={[-Math.PI / 3, 0, 0]} scale={[8, 0.7, 1]}/>
      <Lightformer form="circle" intensity={2} color="#dfe7ee" position={[0, 3, -3]} scale={[4, 4, 1]}/>
    </Environment>
  </>;
}

export function FlowerScene({ active, reducedMotion, mobile, onReady, onUnavailable }: FlowerSceneProps) {
  const runtime=useCinematicRuntime();
  const theme=useThemeController();
  const audio=useAudioController();
  const themeSnapshot=useThemeSnapshot();
  const coarse = useSyncExternalStore(subscribePointer, coarsePointer, () => false);
  const constrained = mobile || coarse;
  const budget = useMemo(() => new FrameBudget(constrained), [constrained]);
  const [budgetTier, setBudgetTier] = useState<QualityTier>(constrained ? "balanced" : "high");
  const [economy, setEconomy] = useState(false);
  const [effectsFailed, setEffectsFailed] = useState(false);
  // A failed compositor caps quality even while the independent frame budget is healthy.
  const tier = economy ? "economy" : effectsFailed && budgetTier === "high" ? "balanced" : budgetTier;
  const quality = qualitySettings(tier, constrained);
  const lowDetail = constrained || tier === "economy";
  const effectsEnabled = quality.effects && !reducedMotion && !effectsFailed;
  const failEffects = useCallback(() => setEffectsFailed(true), []);
  const [controlsHost]=useState(()=>document.getElementById("flower-controls-host"));
  const [supported] = useState(supportsWebGL);
  const [controller] = useState(() => new FlowerController("BLOOMING"));
  const finish = themeSnapshot.theme === "AZURE" ? "glass" : themeSnapshot.theme.toLowerCase();
  const [state, setState] = useState<FlowerState>("BLOOMING");
  const [progress, setProgress] = useState(100);
  const [glow, setGlow] = useState(65);
  const [particles, setParticles] = useState(true);
  const requestFrameRef = useRef<() => void>(() => {});
  const diagnosticRef = useRef<HTMLDivElement>(null);
  const userPoseRef=useRef<LocalFlowerPose>({weight:0,anchorProgress:0});
  const { rotationRef, surfaceRef, coreHandlers, surfaceHandlers, chargeHandlers, consumeRotation, resetRotation } = useFlowerInteraction({ controller, active, reducedMotion });
  const request = useCallback(() => requestFrameRef.current(), []);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearRestart = useCallback(() => {
    if (restartTimer.current !== null) clearTimeout(restartTimer.current);
    restartTimer.current = null;
  }, []);
  useEffect(() => () => clearRestart(), [clearRestart]);
  useEffect(() => { requestFrameRef.current(); }, [finish, progress, glow, particles]);
  useEffect(()=>runtime.onReplay(()=>{
    resetRotation();controller.resetInteraction();clearRestart();userPoseRef.current.weight=0;
    requestFrameRef.current();
  }),[runtime,resetRotation,controller,clearRestart]);

  function claimLocalPose(){
    controller.captureOpenness(runtime.frame.bloom+(controller.openness-runtime.frame.bloom)*userPoseRef.current.weight);
    userPoseRef.current.weight=1;userPoseRef.current.anchorProgress=runtime.frame.progress;
  }

  function chooseState(next: FlowerState) {
    claimLocalPose();
    clearRestart(); setState(next); setProgress(next === "CLOSED" ? 0 : 100);
    if (next === "BLOOMING" && !reducedMotion) {
      controller.setState("CLOSED");
      restartTimer.current = setTimeout(() => { controller.setState("BLOOMING"); request(); }, 950);
    } else controller.setState(next);
    request();
  }

  if (!supported) return <Unsupported onUnavailable={onUnavailable}/>;

  const controls=<div ref={diagnosticRef} className={styles.controls} data-flower-controls data-petals={lowDetail ? 27 : 42} data-quality={mobile ? "mobile" : coarse ? "tablet" : "desktop"} data-render-tier={tier} data-effects={effectsEnabled} data-economy={economy} data-effects-failed={effectsFailed} data-material={finish} data-state={state}>
      <div className={styles.controlsLabel}><span className={styles.liveDot}/><span>SCULPT A POSSIBILITY</span><span className={styles.controlNumber}>003</span></div>
      <div className={styles.materials} role="group" aria-label="Petal material">{FLOWER_MATERIALS.map(material => <button key={material} data-finish={material} className={styles.swatch} aria-pressed={themeSnapshot.theme === MATERIAL_THEMES[material]} aria-label={materialLabels[material]} title={materialLabels[material]} style={{ "--swatch": materialColors[material] } as CSSProperties} onClick={() => { theme.selectTheme(MATERIAL_THEMES[material]); request(); }}><span/></button>)}<span className={styles.finishLabel} aria-live="polite">{themeSnapshot.theme}</span></div>
      <div className={styles.stateControls} role="group" aria-label="Flower state">{(["CLOSED", "BLOOMING", "OPEN"] as const).map(value => <button key={value} aria-pressed={state === value} onClick={() => chooseState(value)}>{value === "BLOOMING" ? "BLOOM" : value}</button>)}</div>
      <label className={styles.sliderLabel} htmlFor="flower-openness"><span>UNFOLD</span><input id="flower-openness" type="range" min="0" max="100" step="1" value={progress} aria-label="Flower openness" onChange={event => { claimLocalPose();clearRestart(); const value = Number(event.target.value); setProgress(value); setState(value === 0 ? "CLOSED" : value === 100 ? "OPEN" : "BLOOMING"); controller.setProgress(value / 100); request(); }}/></label>
      <label className={styles.sliderLabel} htmlFor="flower-glow"><span>GLOW</span><input id="flower-glow" type="range" min="0" max="100" step="1" value={glow} aria-label="Flower glow intensity" onChange={event => { setGlow(Number(event.target.value)); request(); }}/></label>
      <div className={styles.energyActions}>
        <button {...chargeHandlers} onPointerDown={event => { chargeHandlers.onPointerDown(event); request(); }} onPointerUp={event => { chargeHandlers.onPointerUp(event); request(); }} onKeyDown={event => { chargeHandlers.onKeyDown(event); request(); }} onKeyUp={event => { chargeHandlers.onKeyUp(event); request(); }} title="Tap for a pulse. Hold, then release for a petal burst." aria-label="Pulse flower center. Hold and release to scatter petals."><span>◉</span> HOLD TO CHARGE</button>
        <button onClick={() => { resetRotation(); request(); }} title="Reset flower rotation" aria-label="Reset flower rotation">↺</button>
        <button onClick={() => setEconomy(value => !value)} aria-label="Reduce rendering quality" aria-pressed={economy} title="Use fewer particles, lower resolution and no post processing">ECO</button>
        <button onClick={() => setParticles(value => !value)} aria-label="Floating particles" aria-pressed={particles} title="Toggle floating particles">{particles ? "·" : "−"}</button>
      </div>
    </div>;

  return <>
    <div className={styles.canvasSurface}>
      <Canvas aria-hidden="true" camera={{ position: [0, 0, 9.4], fov: mobile ? 47 : 42, near: 0.1, far: 45 }}
        eventSource={surfaceRef} eventPrefix="client"
        dpr={[0.75, quality.dprMax]} frameloop="demand" gl={{ alpha: true, antialias: !constrained, powerPreference: "low-power" }}
        onCreated={({ gl }) => { gl.setClearColor("#0a0a0c", 0); gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; gl.transmissionResolutionScale = mobile ? 0.35 : 0.5; }}
        fallback={<span>Interactive flower requires WebGL2. The chapter experience remains available.</span>}>
        <Studio mobile={constrained} runtime={runtime} theme={theme} audio={audio} reducedMotion={reducedMotion} diagnosticRef={diagnosticRef}/>
        <CinematicCamera runtime={runtime} mobile={mobile} active={active} surfaceRef={surfaceRef} diagnosticRef={diagnosticRef}/>
        <ProceduralFlower controller={controller} theme={theme} audio={audio} mobile={mobile} lowDetail={lowDetail} particleFactor={quality.particleFactor} active={active} reducedMotion={reducedMotion} glow={glow / 100} particles={particles}
          rotationRef={rotationRef} consumeRotation={consumeRotation} coreHandlers={coreHandlers} diagnosticRef={diagnosticRef} runtime={runtime} userPoseRef={userPoseRef}/>
        <CinematicTypography runtime={runtime} theme={theme} mobile={mobile} lowDetail={lowDetail} active={active} reducedMotion={reducedMotion}/>
        <RenderLifecycle active={active} reducedMotion={reducedMotion} requestFrameRef={requestFrameRef} onReady={onReady} onUnavailable={onUnavailable} diagnosticRef={diagnosticRef} theme={theme} audio={audio} budget={budget} tier={budgetTier} onTier={setBudgetTier} constrained={constrained}/>
        {effectsEnabled && <CinematicEffects active={active} runtime={runtime} theme={theme} onFailure={failEffects}/>}
      </Canvas>
    </div>
    <div className={styles.interactionSurface} ref={surfaceRef} {...surfaceHandlers} role="group"
      aria-label="Interactive 3D flower. Drag to rotate, click the center for a pulse, or hold the center and release to scatter the petals. Arrow keys rotate; Home resets."
      aria-describedby="flower-help" tabIndex={0} data-cursor="rotate" onPointerMove={request} onPointerDown={request} onPointerUp={request} onKeyUp={request}
      onKeyDown={event=>{surfaceHandlers.onKeyDown(event);request();}}/>
    {controlsHost?createPortal(controls,controlsHost):controls}
    <p className={styles.interactionHint} id="flower-help"><span>DRAG TO ROTATE</span><i/><span>TAP THE HEART. HOLD TO FRACTURE.</span></p>
  </>;
}
