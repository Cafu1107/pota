/** Pota mark: a hoop (rim + net) on the brand orange tile. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M6.9 10.4 10.6 23.6M25.1 10.4 21.4 23.6M6.9 10.4 14.3 23.6M11.45 12.1 17.7 23.6M16 12.5 21.4 23.6M25.1 10.4 17.7 23.6M20.55 12.1 14.3 23.6M16 12.5 10.6 23.6" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
      <ellipse cx="16" cy="9.6" rx="9.6" ry="3.1" fill="none" stroke="#fff" strokeWidth="2.3" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <LogoMark />
      <span style={{ fontWeight: 800, fontStretch: '78%', fontSize: 23, letterSpacing: '-0.01em', lineHeight: 1 }}>Pota</span>
    </span>
  );
}
