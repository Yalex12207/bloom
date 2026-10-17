"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { THEME_IDS, THEMES, type ThemeId } from "@/lib/ThemeController";
import { useThemeController, useThemeSnapshot } from "./ThemeProvider";
import styles from "./color-lab.module.css";

const MOBILE_QUERY = "(max-width: 767px)";
const CHIP_COLORS: Record<ThemeId, readonly [string, string]> = {
  CRIMSON: ["#F04456", "#F04456"],
  AZURE: ["#168BFF", "#168BFF"],
  VIOLET: ["#A46BFF", "#A46BFF"],
  SILVER: ["#C8DDE9", "#C8DDE9"],
  DUALITY: ["#F04456", "#168BFF"],
  NEBULA: ["#168BFF", "#A46BFF"],
};
const FINISH_NOTES: Record<ThemeId, string> = {
  CRIMSON: "LACQUER / WARM LIGHT",
  AZURE: "GLASS / COOL LIGHT",
  VIOLET: "IRIDESCENCE / SOFT LIGHT",
  SILVER: "METAL / QUIET REFLECTIONS",
  DUALITY: "RED + BLUE / ONE SURFACE",
  NEBULA: "BLUE + VIOLET / IN BETWEEN",
};

function subscribeMobile(notify: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

function getMobileSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function chipStyle(id: ThemeId): CSSProperties {
  const colors = CHIP_COLORS[id];
  return { "--chip-a": colors[0], "--chip-b": colors[1] } as CSSProperties;
}

/** A small, nonmodal palette instrument. Color interpolation belongs to the store. */
export function ColorLab() {
  const controller = useThemeController();
  const snapshot = useThemeSnapshot();
  const mobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, () => true);
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? !mobile;
  const rootRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const hintId = useId();
  const automatic = snapshot.mode === "auto";

  const close = useCallback(() => {
    const restoreFocus = rootRef.current?.contains(document.activeElement) ?? false;
    setOpenOverride(false);
    if (restoreFocus) toggleRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      close();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [close, open]);

  return (
    <aside
      ref={rootRef}
      className={styles.lab}
      aria-label="Color Lab"
      data-color-lab
      data-open={open}
      data-theme={snapshot.theme}
      data-mode={snapshot.mode}
      data-transitioning={snapshot.transitioning}
    >
      <button
        ref={toggleRef}
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${open ? "Collapse" : "Open"} Color Lab, current theme ${snapshot.theme}`}
        data-color-lab-toggle
        data-cursor="select"
        onClick={() => setOpenOverride(!open)}
      >
        <span className={styles.identity}><span className={styles.signal} aria-hidden="true" />COLOR LAB</span>
        <span className={styles.compactTheme} data-current-theme>{snapshot.theme}</span>
        <span className={styles.toggleMark} aria-hidden="true"><i /><i /></span>
      </button>

      <div id={panelId} className={styles.panel} hidden={!open}>
        <div className={styles.current}>
          <div>
            <span className={styles.eyebrow}>A STUDY IN CHROMA</span>
            <p key={snapshot.theme} className={styles.currentName}>{snapshot.theme}<span aria-hidden="true">↗</span></p>
          </div>
          <span className={`${styles.chip} ${styles.currentChip}`} style={chipStyle(snapshot.theme)} aria-hidden="true" />
        </div>
        <p className={styles.finishNote}>{FINISH_NOTES[snapshot.theme]}</p>

        <div className={styles.choices} role="group" aria-label="Color themes" aria-describedby={hintId}>
          {THEME_IDS.map(id => (
            <button
              key={id}
              type="button"
              className={styles.choice}
              data-theme-choice={id}
              data-cursor="select"
              aria-label={`${id} theme`}
              aria-pressed={snapshot.theme === id}
              title={THEMES[id].description}
              onClick={() => controller.selectTheme(id)}
            >
              <span className={styles.chip} style={chipStyle(id)} aria-hidden="true" />
              <span>{id}</span>
            </button>
          ))}
        </div>

        <div className={styles.modeRow}>
          <span className={styles.chapter}>CHAPTER / {String(snapshot.chapter).padStart(2, "0")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={automatic}
            aria-label="Follow chapter colors automatically"
            className={styles.modeSwitch}
            data-theme-auto
            data-cursor="select"
            onClick={() => controller.setAuto(!automatic)}
          >
            <span data-selected={automatic}>AUTO</span><span aria-hidden="true" className={styles.modeDivider}>/</span><span data-selected={!automatic}>MANUAL</span>
          </button>
        </div>

        <div className={styles.transitionLine} aria-hidden="true"><span key={`${snapshot.theme}-${snapshot.mode}`} /></div>
        <p className={styles.status} role="status" aria-live="polite" aria-atomic="true">
          {snapshot.transitioning ? `BLENDING ${snapshot.theme}…` : automatic ? "IN STEP WITH THE STORY" : "YOUR COLOR, EVERY CHAPTER"}
        </p>
        <p id={hintId} className={styles.hint}>Choose a color to hold it. AUTO follows the chapters.</p>
      </div>
    </aside>
  );
}
