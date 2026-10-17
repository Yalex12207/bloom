"use client";

import { useCinematicRuntime } from "./cinematic-context";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export function CinematicOverlay() {
  return <div className="cinematic-overlay" aria-hidden="true"><div className="cinematic-veil"/><div className="cinematic-letterbox cinematic-letterbox--top"/><div className="cinematic-letterbox cinematic-letterbox--bottom"/><svg className="cinematic-velocity" viewBox="0 0 1440 960" preserveAspectRatio="xMidYMid slice">{Array.from({length:28},(_,index)=>{
    const angle=index/28*Math.PI*2;
    const start=440+(index%3)*45;
    return <line key={index} x1={(720+Math.cos(angle)*start).toFixed(3)} y1={(480+Math.sin(angle)*start*.65).toFixed(3)} x2={(720+Math.cos(angle)*(start+130)).toFixed(3)} y2={(480+Math.sin(angle)*(start+130)*.65).toFixed(3)} stroke={index%3===0?'#f04456':'#c8dde9'} strokeWidth={index%4===0?1:.5}/>;
  })}</svg></div>;
}

export function ReplayExperience() {
  const runtime = useCinematicRuntime();
  const reducedMotion = usePrefersReducedMotion();
  return <button type="button" className="return-link replay-experience" onClick={() => {
    runtime.resetInteraction();
    window.scrollTo({top:0,behavior:reducedMotion?"instant":"smooth"});
  }}><span>REPLAY EXPERIENCE</span><span aria-hidden="true">↗</span></button>;
}
