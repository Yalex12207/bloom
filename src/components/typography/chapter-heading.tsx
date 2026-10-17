export function ChapterHeading({ number, title, note }: { number: string; title: string; note: string }) {
  return (
    <div className="chapter-heading" data-reveal>
      <span className="micro chapter-heading__number">CHAPTER {number}</span>
      <h2>{title}</h2>
      <span className="micro chapter-heading__note">{note}</span>
    </div>
  );
}
