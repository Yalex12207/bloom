"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, type MutableRefObject, type RefObject } from "react";
import { Vector3 } from "three";
import type { CinematicRuntime } from "@/lib/cinematic-state";

export function CinematicCamera({ runtime, mobile, active, surfaceRef, diagnosticRef }: {
  runtime: CinematicRuntime; mobile: boolean; active: boolean;
  surfaceRef: RefObject<HTMLDivElement | null>;
  diagnosticRef: MutableRefObject<HTMLDivElement | null>;
}) {
  const { camera, size, invalidate } = useThree();
  const projected = useMemo(() => new Vector3(), []);
  useEffect(() => runtime.subscribe(invalidate), [runtime, invalidate]);
  useFrame(() => {
    if (!active) return;
    const frame = runtime.frame;
    const x = mobile ? frame.flowerX * 0.32 : frame.flowerX;
    const y = mobile ? frame.flowerY * 0.55 + 0.3 : frame.flowerY;
    const shake = Math.sin(frame.progress * 735) * frame.shock * 0.075;
    camera.position.set(frame.cameraX * (mobile ? 0.45 : 1) + shake, frame.cameraY * (mobile ? 0.65 : 1), frame.cameraZ * (mobile ? 1.14 : 1));
    camera.lookAt(frame.targetX * (mobile ? 0.45 : 1), frame.targetY * (mobile ? 0.65 : 1), frame.targetZ);
    camera.updateMatrixWorld();
    projected.set(x, y, frame.flowerZ).project(camera);
    const centerX = (projected.x * 0.5 + 0.5) * size.width;
    const centerY = (-projected.y * 0.5 + 0.5) * size.height;
    const width = mobile ? Math.min(size.width * 0.72, size.height * 0.34) : Math.min(size.width * 0.4, size.height * 0.55, 590);
    const height = width * 0.94;
    if (surfaceRef.current) {
      const element = surfaceRef.current;
      element.style.left = `${Math.max(8, Math.min(size.width - width - 8, centerX - width / 2))}px`;
      element.style.top = `${Math.max(90, Math.min(size.height - height - 70, centerY - height / 2))}px`;
      element.style.width = `${width}px`; element.style.height = `${height}px`;
    }
    if (diagnosticRef.current) {
      diagnosticRef.current.dataset.cinemaProgress = frame.progress.toFixed(5);
      diagnosticRef.current.dataset.cinemaChapter = String(frame.chapter);
      diagnosticRef.current.dataset.scatter = frame.scatter.toFixed(5);
      diagnosticRef.current.dataset.sculpture = frame.sculpture.toFixed(5);
      diagnosticRef.current.dataset.camera = `${camera.position.x.toFixed(3)},${camera.position.y.toFixed(3)},${camera.position.z.toFixed(3)}`;
      diagnosticRef.current.dataset.coreX = centerX.toFixed(1);
      diagnosticRef.current.dataset.coreY = centerY.toFixed(1);
    }
  }, -2);
  return null;
}
