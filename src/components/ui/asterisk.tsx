export function Asterisk({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path d="M50 0v100M0 50h100M15 15l70 70M15 85l70-70" stroke="currentColor" strokeWidth="17" />
    </svg>
  );
}
