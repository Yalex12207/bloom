"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export function CustomCursor() {
  const cursor = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const element = cursor.current;
    if (!element) return;
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    let cleanupPointer: (() => void) | undefined;

    const setup = () => {
      cleanupPointer?.();
      if (!media.matches) {
        element.dataset.enabled = "false";
        return;
      }

      element.dataset.enabled = "true";
      document.body.classList.add("has-custom-cursor");
      const target = { x: 0, y: 0 };
      const position = { x: 0, y: 0 };
      let initialized = false;
      let frame = 0;

      const render = () => {
        const ease = reducedMotion ? 1 : 0.22;
        position.x += (target.x - position.x) * ease;
        position.y += (target.y - position.y) * ease;
        element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
        if (
          Math.abs(target.x - position.x) + Math.abs(target.y - position.y) > 0.1
        ) {
          frame = window.requestAnimationFrame(render);
        } else {
          frame = 0;
        }
      };

      const move = (event: PointerEvent) => {
        if (event.pointerType === "touch") {
          element.dataset.visible = "false";
          return;
        }
        target.x = event.clientX;
        target.y = event.clientY;
        if (!initialized) {
          position.x = target.x;
          position.y = target.y;
          initialized = true;
        }
        element.dataset.visible = "true";
        if (!frame) frame = window.requestAnimationFrame(render);
      };

      const hover = (event: PointerEvent) => {
        const targetElement = event.target instanceof Element ? event.target : null;
        const interactive = targetElement?.closest<HTMLElement>(
          "a,button,[role='button'],input,textarea,select,[data-cursor]",
        );
        element.dataset.interactive = String(Boolean(interactive));
        if (label.current) label.current.textContent = interactive?.dataset.cursor ?? "";
      };

      const hide = () => {
        element.dataset.visible = "false";
      };
      const leave = (event: PointerEvent) => {
        if (event.relatedTarget === null) hide();
      };
      const press = () => {
        element.dataset.pressed = "true";
      };
      const release = () => {
        element.dataset.pressed = "false";
      };

      window.addEventListener("pointermove", move, { passive: true });
      window.addEventListener("pointerover", hover, { passive: true });
      window.addEventListener("pointerout", leave, { passive: true });
      window.addEventListener("pointerdown", press, { passive: true });
      window.addEventListener("pointerup", release, { passive: true });
      window.addEventListener("blur", hide);
      cleanupPointer = () => {
        window.cancelAnimationFrame(frame);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerover", hover);
        window.removeEventListener("pointerout", leave);
        window.removeEventListener("pointerdown", press);
        window.removeEventListener("pointerup", release);
        window.removeEventListener("blur", hide);
        document.body.classList.remove("has-custom-cursor");
        element.dataset.enabled = "false";
        hide();
      };
    };

    setup();
    media.addEventListener("change", setup);
    return () => {
      cleanupPointer?.();
      media.removeEventListener("change", setup);
    };
  }, [reducedMotion]);

  return (
    <div ref={cursor} className="custom-cursor" aria-hidden="true" data-enabled="false">
      <span className="cursor-ring">
        <span ref={label} className="cursor-label" />
      </span>
      <span className="cursor-dot" />
    </div>
  );
}
