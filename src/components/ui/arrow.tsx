export function Arrow({ diagonal = false, className = "" }: { diagonal?: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={diagonal ? "M5 19 19 5M5 5h14v14" : "M4 12h16m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
