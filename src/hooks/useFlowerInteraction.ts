"use client";

import { useCallback, useEffect, useRef, type KeyboardEventHandler, type MutableRefObject, type PointerEventHandler, type RefObject } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { FlowerController } from "@/components/scene/flower/FlowerController";

export type FlowerRotationState = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  pointerX: number;
  pointerY: number;
  dragging: boolean;
};

export type FlowerInteractionOptions = {
  controller: FlowerController;
  reducedMotion: boolean;
  active: boolean;
};

export type FlowerCoreHandlers = {
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
};

export type FlowerChargeHandlers = {
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  onPointerUp: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel: PointerEventHandler<HTMLButtonElement>;
  onLostPointerCapture: PointerEventHandler<HTMLButtonElement>;
  onKeyDown: KeyboardEventHandler<HTMLButtonElement>;
  onKeyUp: KeyboardEventHandler<HTMLButtonElement>;
  onBlur: () => void;
};

export type FlowerInteraction = {
  rotationRef: MutableRefObject<FlowerRotationState>;
  surfaceRef: RefObject<HTMLDivElement | null>;
  coreHandlers: FlowerCoreHandlers;
  surfaceHandlers: { onKeyDown: KeyboardEventHandler<HTMLDivElement> };
  chargeHandlers: FlowerChargeHandlers;
  consumeRotation: (delta: number) => void;
  pulse: () => void;
  resetRotation: () => void;
};

const HOLD_THRESHOLD_MS = 260;
const DRAG_THRESHOLD_PX = 6;
const DRAG_SENSITIVITY = 0.005;
const MAX_VELOCITY = 4;
const TAU = Math.PI * 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function releaseCapture(element: HTMLElement | null, pointerId: number | null) {
  if (pointerId === null || !element) return;
  try {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    // The browser may already have released a cancelled or disconnected pointer.
  }
}

/**
 * Pointer work stays outside React's render loop. Only the supplied flower surface
 * owns touch gestures; scrolling and links elsewhere on the page keep their defaults.
 */
export function useFlowerInteraction({ controller, reducedMotion, active }: FlowerInteractionOptions): FlowerInteraction {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef<FlowerRotationState>({
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    pointerX: 0,
    pointerY: 0,
    dragging: false,
  });
  const gestureRef = useRef({
    pointerId: null as number | null,
    corePointerId: null as number | null,
    corePressed: false,
    moved: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    startedAt: 0,
  });
  const chargeRef = useRef({
    pointerId: null as number | null,
    element: null as HTMLButtonElement | null,
    key: null as string | null,
    startedAt: 0,
  });

  const cancel = useCallback(() => {
    const gesture = gestureRef.current;
    const held = chargeRef.current;
    const surfacePointerId = gesture.pointerId;
    const buttonPointerId = held.pointerId;
    const button = held.element;
    // Clear ownership first: releasing capture can synchronously dispatch another event.
    gesture.pointerId = null;
    gesture.corePointerId = null;
    gesture.corePressed = false;
    gesture.moved = false;
    held.pointerId = null;
    held.element = null;
    held.key = null;
    const rotation = rotationRef.current;
    rotation.dragging = false;
    rotation.velocityX = 0;
    rotation.velocityY = 0;
    rotation.pointerX = 0;
    rotation.pointerY = 0;
    controller.cancelCharge();
    releaseCapture(surfaceRef.current, surfacePointerId);
    releaseCapture(button, buttonPointerId);
  }, [controller]);

  const releaseEnergy = useCallback((startedAt: number) => {
    if (performance.now() - startedAt >= HOLD_THRESHOLD_MS) {
      controller.releaseCharge();
    } else {
      controller.cancelCharge();
      controller.triggerPulse();
    }
  }, [controller]);

  const pulse = useCallback(() => {
    cancel();
    controller.triggerPulse();
  }, [cancel, controller]);

  const resetRotation = useCallback(() => {
    cancel();
    rotationRef.current.x = 0;
    rotationRef.current.y = 0;
  }, [cancel]);

  const onCorePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const gesture = gestureRef.current;
    const held = chargeRef.current;
    if (held.pointerId !== null || held.key !== null) return;
    // With an external R3F event source the native surface listener may run first.
    if (gesture.pointerId === event.pointerId) {
      if (!gesture.moved && !gesture.corePressed) {
        gesture.corePressed = true;
        gesture.startedAt = performance.now();
        rotationRef.current.dragging = false;
        controller.beginCharge();
      }
      return;
    }
    if (gesture.pointerId !== null) return;
    // R3F dispatches from its canvas before the native event bubbles to the surface.
    // Leave bubbling intact so one surface owns pointer capture and drag cancellation.
    gesture.corePointerId = event.pointerId;
  }, [controller]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const previousTouchAction = surface.style.touchAction;
    const previousUserSelect = surface.style.userSelect;
    surface.style.touchAction = "none";
    surface.style.userSelect = "none";

    function updateHover(event: PointerEvent) {
      const rotation = rotationRef.current;
      if (!active || reducedMotion || event.pointerType === "touch") {
        rotation.pointerX = 0;
        rotation.pointerY = 0;
        return;
      }
      const bounds = surface!.getBoundingClientRect();
      rotation.pointerX = clamp(((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 2, -1, 1);
      rotation.pointerY = clamp(((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 2, -1, 1);
    }

    function handleDown(event: PointerEvent) {
      if (event.button !== 0 || !event.isPrimary) return;
      if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea, [data-flower-control]")) return;
      const gesture = gestureRef.current;
      const held = chargeRef.current;
      if (gesture.pointerId !== null || held.pointerId !== null || held.key !== null) return;
      const now = performance.now();
      gesture.pointerId = event.pointerId;
      gesture.corePressed = gesture.corePointerId === event.pointerId;
      gesture.corePointerId = null;
      gesture.moved = false;
      gesture.startX = gesture.lastX = event.clientX;
      gesture.startY = gesture.lastY = event.clientY;
      gesture.startedAt = gesture.lastTime = now;
      const rotation = rotationRef.current;
      rotation.velocityX = 0;
      rotation.velocityY = 0;
      rotation.dragging = !gesture.corePressed;
      if (gesture.corePressed) controller.beginCharge();
      updateHover(event);
      surface!.focus({ preventScroll: true });
      try {
        surface!.setPointerCapture(event.pointerId);
      } catch {
        // Window listeners below cover browsers that reject pointer capture.
      }
      if (event.pointerType === "touch") event.preventDefault();
    }

    function handleMove(event: PointerEvent) {
      const gesture = gestureRef.current;
      if (gesture.pointerId === null) {
        updateHover(event);
        return;
      }
      if (gesture.pointerId !== event.pointerId) return;
      const now = performance.now();
      const elapsed = clamp((now - gesture.lastTime) / 1000, 0.008, 0.05);
      const movementX = event.clientX - gesture.lastX;
      const movementY = event.clientY - gesture.lastY;
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
      gesture.lastTime = now;
      updateHover(event);

      if (!gesture.moved && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > DRAG_THRESHOLD_PX) {
        gesture.moved = true;
        if (gesture.corePressed) {
          gesture.corePressed = false;
          controller.cancelCharge();
        }
      }
      if (gesture.corePressed) return;

      const rotation = rotationRef.current;
      const angleX = movementY * DRAG_SENSITIVITY;
      const angleY = movementX * DRAG_SENSITIVITY;
      rotation.dragging = true;
      rotation.x += angleX;
      rotation.y += angleY;
      if (!reducedMotion) {
        rotation.velocityX = rotation.velocityX * 0.35 + clamp(angleX / elapsed, -MAX_VELOCITY, MAX_VELOCITY) * 0.65;
        rotation.velocityY = rotation.velocityY * 0.35 + clamp(angleY / elapsed, -MAX_VELOCITY, MAX_VELOCITY) * 0.65;
      }
      if (event.pointerType === "touch") event.preventDefault();
    }

    function finish(event: PointerEvent) {
      const held = chargeRef.current;
      if (held.pointerId === event.pointerId) {
        const startedAt = held.startedAt;
        const element = held.element;
        held.pointerId = null;
        held.element = null;
        releaseCapture(element, event.pointerId);
        releaseEnergy(startedAt);
        return;
      }
      const gesture = gestureRef.current;
      if (gesture.pointerId !== event.pointerId) return;
      const corePressed = gesture.corePressed;
      const startedAt = gesture.startedAt;
      const stale = performance.now() - gesture.lastTime > 100;
      gesture.pointerId = null;
      gesture.corePointerId = null;
      gesture.corePressed = false;
      rotationRef.current.dragging = false;
      if (reducedMotion || !active || stale || !gesture.moved) {
        rotationRef.current.velocityX = 0;
        rotationRef.current.velocityY = 0;
      }
      releaseCapture(surface, event.pointerId);
      if (corePressed) releaseEnergy(startedAt);
    }

    function handleCancel(event: PointerEvent) {
      if (gestureRef.current.pointerId === event.pointerId || chargeRef.current.pointerId === event.pointerId) cancel();
    }

    function handleLeave() {
      rotationRef.current.pointerX = 0;
      rotationRef.current.pointerY = 0;
    }

    function handleOutsideMove(event: PointerEvent) {
      if (gestureRef.current.pointerId !== event.pointerId) return;
      if (!(event.target instanceof Node) || !surface!.contains(event.target)) handleMove(event);
    }

    function handleVisibility() {
      if (document.visibilityState !== "visible") cancel();
    }

    function preventContextMenu(event: Event) {
      event.preventDefault();
    }

    surface.addEventListener("pointerdown", handleDown);
    surface.addEventListener("pointermove", handleMove, { passive: false });
    surface.addEventListener("pointerup", finish);
    surface.addEventListener("pointercancel", handleCancel);
    surface.addEventListener("lostpointercapture", handleCancel);
    surface.addEventListener("pointerleave", handleLeave);
    surface.addEventListener("contextmenu", preventContextMenu);
    window.addEventListener("pointermove", handleOutsideMove, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", handleCancel);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      surface.removeEventListener("pointerdown", handleDown);
      surface.removeEventListener("pointermove", handleMove);
      surface.removeEventListener("pointerup", finish);
      surface.removeEventListener("pointercancel", handleCancel);
      surface.removeEventListener("lostpointercapture", handleCancel);
      surface.removeEventListener("pointerleave", handleLeave);
      surface.removeEventListener("contextmenu", preventContextMenu);
      window.removeEventListener("pointermove", handleOutsideMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", handleVisibility);
      cancel();
      surface.style.touchAction = previousTouchAction;
      surface.style.userSelect = previousUserSelect;
    };
  }, [active, cancel, controller, reducedMotion, releaseEnergy]);

  const consumeRotation = useCallback((delta: number) => {
    const rotation = rotationRef.current;
    if (reducedMotion || !active) {
      rotation.velocityX = 0;
      rotation.velocityY = 0;
      rotation.pointerX = 0;
      rotation.pointerY = 0;
      return;
    }
    if (rotation.dragging) return;
    const step = clamp(delta, 0, 0.05);
    const damping = Math.exp(-4.2 * step);
    // Integrate exponential damping exactly so momentum is stable across frame rates.
    const distance = (1 - damping) / 4.2;
    rotation.x += rotation.velocityX * distance;
    rotation.y += rotation.velocityY * distance;
    rotation.velocityX *= damping;
    rotation.velocityY *= damping;
    if (Math.abs(rotation.velocityX) < 0.001) rotation.velocityX = 0;
    if (Math.abs(rotation.velocityY) < 0.001) rotation.velocityY = 0;
    if (Math.abs(rotation.x) > TAU * 20) rotation.x %= TAU;
    if (Math.abs(rotation.y) > TAU * 20) rotation.y %= TAU;
  }, [active, reducedMotion]);

  const onSurfaceKeyDown: KeyboardEventHandler<HTMLDivElement> = useCallback((event) => {
    if (event.target !== event.currentTarget) return;
    const step = event.shiftKey ? 0.25 : 0.12;
    const rotation = rotationRef.current;
    switch (event.key) {
      case "ArrowLeft": rotation.y -= step; break;
      case "ArrowRight": rotation.y += step; break;
      case "ArrowUp": rotation.x -= step; break;
      case "ArrowDown": rotation.x += step; break;
      case "Home": resetRotation(); break;
      case "Enter":
      case " ":
        if (!event.repeat) pulse();
        break;
      default: return;
    }
    rotation.velocityX = 0;
    rotation.velocityY = 0;
    event.preventDefault();
  }, [pulse, resetRotation]);

  const onChargePointerDown: PointerEventHandler<HTMLButtonElement> = useCallback((event) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    cancel();
    const held = chargeRef.current;
    held.pointerId = event.pointerId;
    held.element = event.currentTarget;
    held.startedAt = performance.now();
    event.currentTarget.focus({ preventScroll: true });
    controller.beginCharge();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A keyboard alternative is always available if a browser lacks capture.
    }
  }, [cancel, controller]);

  const onChargePointerUp: PointerEventHandler<HTMLButtonElement> = useCallback((event) => {
    const held = chargeRef.current;
    if (held.pointerId !== event.pointerId) return;
    event.preventDefault();
    const startedAt = held.startedAt;
    const element = held.element;
    held.pointerId = null;
    held.element = null;
    releaseCapture(element, event.pointerId);
    releaseEnergy(startedAt);
  }, [releaseEnergy]);

  const onChargePointerCancel: PointerEventHandler<HTMLButtonElement> = useCallback((event) => {
    if (chargeRef.current.pointerId === event.pointerId) cancel();
  }, [cancel]);

  const onChargeKeyDown: KeyboardEventHandler<HTMLButtonElement> = useCallback((event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (event.repeat || chargeRef.current.key !== null) return;
    cancel();
    chargeRef.current.key = event.key;
    chargeRef.current.startedAt = performance.now();
    controller.beginCharge();
  }, [cancel, controller]);

  const onChargeKeyUp: KeyboardEventHandler<HTMLButtonElement> = useCallback((event) => {
    const held = chargeRef.current;
    if (held.key !== event.key) return;
    event.preventDefault();
    held.key = null;
    releaseEnergy(held.startedAt);
  }, [releaseEnergy]);

  return {
    rotationRef,
    surfaceRef,
    coreHandlers: { onPointerDown: onCorePointerDown },
    surfaceHandlers: { onKeyDown: onSurfaceKeyDown },
    chargeHandlers: {
      onPointerDown: onChargePointerDown,
      onPointerUp: onChargePointerUp,
      onPointerCancel: onChargePointerCancel,
      onLostPointerCapture: onChargePointerCancel,
      onKeyDown: onChargeKeyDown,
      onKeyUp: onChargeKeyUp,
      onBlur: cancel,
    },
    consumeRotation,
    pulse,
    resetRotation,
  };
}
