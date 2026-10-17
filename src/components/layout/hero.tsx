import { Arrow } from "@/components/ui/arrow";
import { Asterisk } from "@/components/ui/asterisk";

export function Hero() {
  return (
    <section id="awakening" className="hero" aria-labelledby="hero-title" data-chapter="awakening">
      <div className="hero__grid" aria-hidden="true" />
      <div className="hero__orbital" aria-hidden="true" />

      <div className="hero__edition micro" data-hero-enter>
        <span className="status-dot" />
        AN EXPLORATION OF FORM & FEELING
      </div>

      <div className="hero__intro" data-hero-enter>
        <span className="micro muted">00 / THE AWAKENING</span>
        <p>A space between<br />what is and what <em>could be.</em></p>
      </div>

      <div className="hero__wordmark-wrap">
        <div className="hero__wordmark-label micro" data-hero-enter>
          <span>THE ART OF BECOMING</span>
          <span className="hero__coordinate">VOLUME 001 / AN OPEN EXPLORATION</span>
        </div>
        <h1 id="hero-title" className="hero__wordmark" aria-label="BLOOM">
          {"BLOOM".split("").map((letter, index) => (
            <span key={index} className="hero__letter" data-hero-enter aria-hidden="true">{letter}</span>
          ))}
          <Asterisk className="hero__asterisk" />
        </h1>
      </div>

      <div className="hero__bottom" data-hero-enter>
        <div className="hero__tagline">
          <span className="micro muted">A STUDY IN TRANSFORMATION</span>
          <p>Every form begins<br />with a fracture.</p>
        </div>
        <a href="#genesis" className="experience-link" data-cursor="explore">
          <span className="experience-link__icon"><Arrow /></span>
          <span>Explore the becoming<span className="micro muted">SCROLL TO UNFOLD</span></span>
        </a>
        <div className="hero__index micro"><span>FIVE CHAPTERS.</span><span>INFINITE POSSIBILITIES.</span></div>
      </div>
      <div className="hero__footer micro" aria-hidden="true"><span>DIGITAL ART / EXPERIMENT NO. 001</span><span className="hero__footer-right">SCROLL TO DISCOVER <span>↓</span></span></div>
    </section>
  );
}
