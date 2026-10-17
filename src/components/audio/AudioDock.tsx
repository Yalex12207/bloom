"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAudioController, useAudioSnapshot } from "./AudioProvider";
import styles from "./audio-dock.module.css";

function SoundIcon({ enabled }: { enabled: boolean }) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 8h3l4-4v12l-4-4H3V8Z" stroke="currentColor" strokeWidth="1.2" />{enabled ? <><path d="M13 7c1.6 1.6 1.6 4.4 0 6M15.5 4.5c3 3 3 8 0 11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></> : <path d="m13 8 4 4m0-4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />}</svg>;
}

/** Metadata renders discretely; spectrum samples update only this retained DOM node. */
export function AudioDock() {
  const controller = useAudioController();
  const snapshot = useAudioSnapshot();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const detailsRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const volumeId = useId();
  const fileId = useId();
  const statusId = useId();
  const unsupported = snapshot.status === "unavailable";
  const on = snapshot.enabled || snapshot.status === "playing" || snapshot.status === "loading";

  useEffect(() => {
    function paintMeters() {
      const root = rootRef.current;
      if (!root) return;
      const frame = controller.frame;
      root.style.setProperty("--audio-low", frame.low.toFixed(4));
      root.style.setProperty("--audio-mid", frame.mid.toFixed(4));
      root.style.setProperty("--audio-high", frame.high.toFixed(4));
      root.style.setProperty("--audio-envelope", frame.envelope.toFixed(4));
      root.dataset.audioLow = frame.low.toFixed(4);
      root.dataset.audioMid = frame.mid.toFixed(4);
      root.dataset.audioHigh = frame.high.toFixed(4);
    }
    paintMeters();
    return controller.subscribeFrame(paintMeters);
  }, [controller]);

  const close = useCallback(() => {
    const restoreFocus = rootRef.current?.contains(document.activeElement) ?? false;
    setOpen(false);
    if (restoreFocus) detailsRef.current?.focus({ preventScroll: true });
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

  function start() {
    // Invoke in the original click stack to preserve Safari's audio user gesture.
    void controller.start().catch(() => { /* The controller exposes a readable error status. */ });
  }

  const message = snapshot.status === "loading" ? "Preparing the sound field…"
    : snapshot.status === "error" ? snapshot.error ?? "Audio could not start. Try again or choose another file."
    : unsupported ? "Web Audio is unavailable in this browser. The full visual experience remains available."
    : snapshot.status === "playing" ? "Sound follows the flower. You control the volume."
    : snapshot.status === "paused" ? "Sound is paused. Press Sound to resume when you are ready."
    : "Sound is off. Press Sound to hear the experience.";

  return <aside ref={rootRef} className={styles.dock} aria-label="Sound controls"
    data-audio-dock data-open={open} data-audio-status={snapshot.status} data-audio-enabled={snapshot.enabled}>
    <div className={styles.toolbar}>
      <button type="button" className={styles.mainButton} data-audio-toggle data-cursor="listen"
        aria-label={unsupported ? "Audio unavailable in this browser" : on ? "Turn audio off" : snapshot.status === "error" ? "Retry audio playback" : "Turn audio on"}
        aria-describedby={statusId} aria-pressed={on} disabled={unsupported} onClick={() => { if (on) controller.stop(); else start(); }}>
        <SoundIcon enabled={on} /><span className={styles.buttonText}>{snapshot.status === "error" ? "RETRY" : unsupported ? "N/A" : <>SOUND <span>{on ? "ON" : "OFF"}</span></>}</span>
      </button>
      <span className={styles.compactStatus} aria-hidden="true">{snapshot.status === "loading" ? "LOADING" : snapshot.status === "playing" ? "LIVE" : snapshot.status === "error" ? "RETRY" : unsupported ? "N/A" : "OPTIONAL"}</span>
      <span className={styles.toolbarMeters} aria-hidden="true"><i /><i /><i /></span>
      <button ref={detailsRef} type="button" className={styles.detailsButton} data-audio-details data-cursor="select"
        aria-expanded={open} aria-controls={panelId} aria-label={open ? "Close sound details" : "Open sound details"}
        onClick={() => setOpen(value => !value)}><span aria-hidden="true">{open ? "−" : "+"}</span></button>
    </div>

    <div id={panelId} className={styles.panel} hidden={!open}>
      <div className={styles.titleRow}><span>LISTEN TO THE BECOMING</span><span>{snapshot.source === "local" ? "LOCAL" : "ORIGINAL"}</span></div>
      <p className={styles.trackTitle} title={snapshot.title}>{snapshot.title || "BLOOM / AMBIENT STUDY"}</p>
      <div className={styles.bandMeters} role="img" aria-label="Low, mid and high frequency activity">
        <div><span>LOW</span><i className={styles.low} /></div><div><span>MID</span><i className={styles.mid} /></div><div><span>HIGH</span><i className={styles.high} /></div>
      </div>
      <label className={styles.volume} htmlFor={volumeId}><span>VOLUME</span><input id={volumeId} type="range" min="0" max="100" step="1"
        aria-label="Audio volume" aria-valuetext={`${Math.round(snapshot.volume * 100)} percent`} value={Math.round(snapshot.volume * 100)}
        onChange={event => controller.setVolume(Number(event.target.value) / 100)} /><output htmlFor={volumeId}>{Math.round(snapshot.volume * 100)}%</output></label>
      <label className={styles.fileLabel} htmlFor={fileId}><span>LOAD YOUR AUDIO</span><span aria-hidden="true">↗</span>
        <input id={fileId} className={styles.fileInput} data-audio-file type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" disabled={unsupported}
          aria-label="Load a local audio file. It stays in your browser and is never uploaded."
          onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void controller.loadFile(file).catch(() => { /* Status provides the recovery message. */ }); }} />
      </label>
      <p className={styles.privacy}>Your file stays in this browser. Nothing is uploaded.</p>
      <p id={statusId} className={styles.status} role="status" aria-live="polite" aria-atomic="true">{message}</p>
      {snapshot.status === "error" && <button type="button" className={styles.retry} onClick={start} data-audio-retry>TRY AGAIN <span aria-hidden="true">↗</span></button>}
    </div>
  </aside>;
}
