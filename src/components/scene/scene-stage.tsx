"use client";

import dynamic from "next/dynamic";
import {
  Component,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { FlowerSceneProps } from "./flower/FlowerScene";
import styles from "./scene-stage.module.css";

const FlowerScene = dynamic<FlowerSceneProps>(
  () => import("./flower/FlowerScene").then((module) => module.FlowerScene),
  { ssr: false },
);

function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (notify: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

function subscribeVisibility(notify: () => void) {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
}

function getVisibility() {
  return document.visibilityState === "visible";
}

function Placeholder({ failed = false }: { failed?: boolean }) {
  const gradientId = useId();
  return (
    <div className={`${styles.placeholder} ${failed ? styles.failed : ""}`}>
      <svg
        className={styles.outline}
        viewBox="0 0 600 600"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="80" y1="100" x2="500" y2="450">
            <stop stopColor="var(--theme-secondary, #c8dde9)" stopOpacity="0.5" />
            <stop offset="0.5" stopColor="var(--theme-secondary, #c8dde9)" stopOpacity="0.04" />
            <stop offset="1" stopColor="var(--theme-accent, #f04456)" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <g stroke={`url(#${gradientId})`} strokeWidth="0.7">
          {Array.from({ length: 12 }, (_, index) => (
            <ellipse
              key={index}
              cx="300"
              cy="300"
              rx={154 + index * 4}
              ry={69 + index * 6}
              transform={`rotate(${index * 3 - 42} 300 300)`}
            />
          ))}
        </g>
      </svg>
      <div className={styles.loadingLabel} role="status" aria-live="polite">
        <span className={styles.loadingLine}><span className={styles.statusMark} aria-hidden="true" />
          <span>{failed ? "BOTANICAL STUDY / OUTLINE MODE" : "GROWING A POSSIBILITY"}</span>
        </span>
        <span className={styles.loadingNote}>{failed ? "THE FIVE CHAPTERS REMAIN AVAILABLE" : "LIGHT · GEOMETRY · ATMOSPHERE"}</span>
      </div>
    </div>
  );
}

class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? <Placeholder failed /> : this.props.children;
  }
}

export function SceneStage({ className = "" }: { className?: string }) {
  const stageRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(true);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const ready = status !== "loading";
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const mobile = useMediaQuery("(max-width: 767px)");
  const documentVisible = useSyncExternalStore(
    subscribeVisibility,
    getVisibility,
    () => true,
  );
  const handleReady = useCallback(() => setStatus("ready"), []);
  const handleUnavailable = useCallback(() => setStatus("fallback"), []);

  useEffect(() => {
    const element = stageRef.current;
    if (!element || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "80px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <figure
      ref={stageRef}
      className={`${styles.stage} ${ready ? styles.ready : ""} ${className}`}
      data-scene-status={status}
      aria-busy={status === "loading"}
      aria-label="An original interactive procedural 3D flower, with an outline fallback on devices without WebGL."
    >
      <div className={styles.loading} aria-hidden={ready}>
        <Placeholder />
      </div>
      <div className={styles.canvas}>
        <SceneBoundary onError={handleUnavailable}>
          {status === "fallback" ? <Placeholder failed /> : <FlowerScene
            active={inView && documentVisible}
            reducedMotion={reducedMotion}
            mobile={mobile}
            onReady={handleReady}
            onUnavailable={handleUnavailable}
          />}
        </SceneBoundary>
      </div>
      <figcaption className={styles.caption}>
        <span>BOTANICAL STUDY / 003</span>
        <span>SCROLL THROUGH THE BECOMING</span>
        <span className={styles.sceneStatus}>{status === "loading" ? "PREPARING THE SCENE" : status === "fallback" ? "OUTLINE EXPERIENCE" : "REALTIME SCENE / READY"}</span>
      </figcaption>
    </figure>
  );
}

export default SceneStage;
