import { ChapterHeading } from "@/components/typography/chapter-heading";
import { Arrow } from "@/components/ui/arrow";
import { Asterisk } from "@/components/ui/asterisk";
import { ReplayExperience } from "@/components/effects/cinematic-overlay";

function ChapterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} className="chapter-link" data-cursor="explore"><span>{children}</span><Arrow diagonal /></a>;
}

export function Chapters() {
  return (
    <>
      <section id="genesis" className="chapter chapter--genesis" aria-labelledby="genesis-title" data-chapter="genesis">
        <ChapterHeading number="01" title="GENESIS" note="THE FIRST IMPULSE" />
        <div className="chapter__body genesis-body">
          <div className="genesis-art" aria-hidden="true" data-reveal>
            <div className="genesis-art__axis" />
            <div className="genesis-art__orbit genesis-art__orbit--one" />
            <div className="genesis-art__orbit genesis-art__orbit--two" />
            <div className="genesis-art__seed" />
            <span className="micro genesis-art__label">FIG. 01 — A POINT OF POSSIBILITY</span>
          </div>
          <div className="chapter-copy" data-reveal>
            <span className="micro section-kicker">EVERYTHING STARTS WITH ALMOST NOTHING.</span>
            <h3 id="genesis-title">Before form,<br />there is <em>feeling.</em></h3>
            <p>A quiet impulse. A single point of light. Somewhere in the space between intention and accident, something begins.</p>
            <ChapterLink href="#fracture">Follow the first impulse</ChapterLink>
          </div>
        </div>
        <div className="chapter__foot micro"><span>01 / ORIGIN</span><span>FROM NOTHING, A POSSIBILITY.</span></div>
      </section>

      <section id="fracture" className="chapter chapter--fracture" aria-labelledby="fracture-title" data-chapter="fracture">
        <ChapterHeading number="02" title="FRACTURE" note="THE BEAUTIFUL INTERRUPTION" />
        <div className="fracture-composition">
          <div className="fracture-type" aria-hidden="true" data-reveal><span>BREAK</span><span className="fracture-type__apart">OPEN.</span></div>
          <div className="fracture-line" aria-hidden="true" />
          <div className="chapter-copy fracture-copy" data-reveal>
            <span className="micro section-kicker">PERFECTION IS A CLOSED SYSTEM.</span>
            <h3 id="fracture-title">Let the<br /><em>unexpected</em> in.</h3>
            <p>A fracture is an invitation. The moment a familiar shape breaks, a thousand new directions become possible.</p>
            <ChapterLink href="#metamorphosis">Find another direction</ChapterLink>
          </div>
        </div>
        <div className="chapter__foot micro"><span>02 / DISRUPTION</span><span>THERE IS BEAUTY IN THE BREAK.</span></div>
      </section>

      <section id="metamorphosis" className="chapter chapter--metamorphosis" aria-labelledby="metamorphosis-title" data-chapter="metamorphosis">
        <ChapterHeading number="03" title="METAMORPHOSIS" note="THE IN-BETWEEN" />
        <div className="chapter__body metamorphosis-body">
          <div className="chapter-copy" data-reveal>
            <span className="micro section-kicker">CHANGE HAS NO STRAIGHT LINES.</span>
            <h3 id="metamorphosis-title">Neither what was.<br />Nor what <em>will be.</em></h3>
            <p>Hold the in-between. Old edges soften. New patterns emerge. Becoming is a practice of letting go.</p>
            <ChapterLink href="#rebirth">Move into the unknown</ChapterLink>
          </div>
          <div className="metamorphosis-art" aria-hidden="true" data-reveal>
            {Array.from({ length: 9 }, (_, i) => <span key={i} style={{ "--ring": i } as React.CSSProperties} />)}
            <div className="metamorphosis-art__center" />
            <span className="micro metamorphosis-art__label">FIG. 03 — BETWEEN TWO STATES</span>
          </div>
        </div>
        <div className="chapter__foot micro"><span>03 / TRANSFORMATION</span><span>THE PROCESS IS THE FORM.</span></div>
      </section>

      <section id="rebirth" className="chapter chapter--rebirth" aria-labelledby="rebirth-title" data-chapter="rebirth">
        <ChapterHeading number="04" title="REBIRTH" note="ANOTHER BEGINNING" />
        <div className="rebirth-content" data-reveal>
          <span className="micro section-kicker">NOT AN END. AN OPENING.</span>
          <h3 id="rebirth-title" className="reborn-title">REBORN<Asterisk className="rebirth-star" /></h3>
          <div className="rebirth-content__bottom"><p>Every ending holds the shape of a beginning.<br />What will you become next?</p><ReplayExperience/></div>
        </div>
        <footer className="site-footer"><a href="#awakening" className="footer-brand" aria-label="BLOOM, back to top">bloom<span>®</span></a><span className="micro muted">THE ART OF BECOMING</span><span className="micro muted">AN INDEPENDENT DIGITAL EXPERIMENT<br />© {new Date().getFullYear()} BLOOM</span><a className="micro footer-top" href="#awakening">BACK TO TOP ↑</a></footer>
      </section>
    </>
  );
}
