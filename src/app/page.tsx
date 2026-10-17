import { ExperienceProvider } from "@/components/effects/experience-provider";
import { CustomCursor } from "@/components/effects/custom-cursor";
import { SiteHeader } from "@/components/navigation/site-header";
import { ChapterProgress } from "@/components/navigation/chapter-progress";
import { Hero } from "@/components/layout/hero";
import { Chapters } from "@/components/layout/chapters";
import { SceneStage } from "@/components/scene/scene-stage";
import { CinematicOverlay } from "@/components/effects/cinematic-overlay";
import { ColorLab } from "@/components/theme/ColorLab";
import { AudioDock } from "@/components/audio/AudioDock";

export default function Home() {
  return (
    <ExperienceProvider>
      <a href="#main-content" className="skip-link">Skip to experience</a>
      <SiteHeader />
      <div id="flower-controls-host" className="flower-controls-host"/>
      <SceneStage />
      <CinematicOverlay />
      <ColorLab />
      <AudioDock />
      <main id="main-content"><Hero /><Chapters /></main>
      <ChapterProgress />
      <CustomCursor />
    </ExperienceProvider>
  );
}
