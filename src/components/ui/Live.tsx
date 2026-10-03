import { useEffect, useRef, useState } from 'react';
import s from './ui.module.css';

export function LiveDot({ className }: { className?: string }) {
  return <span aria-hidden className={`${s.liveDot} ${className ?? ''}`} />;
}

/**
 * Score that rolls in when it changes during a live game: the new number rises
 * into place while the old one leaves upward. Static otherwise.
 */
export function RollingScore({ value, live, className }: { value: number | null; live?: boolean; className?: string }) {
  const prev = useRef<number | null>(value);
  const [out, setOut] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (live && value !== null && prev.current !== null && value !== prev.current) {
      setOut(prev.current);
      setTick((t) => t + 1);
      const id = window.setTimeout(() => setOut(null), 520);
      prev.current = value;
      return () => window.clearTimeout(id);
    }
    prev.current = value;
    return undefined;
  }, [value, live]);

  if (value === null) return <span className={className}>–</span>;
  return (
    <span className={`${s.roll} ${className ?? ''}`}>
      {out !== null && (
        <span aria-hidden className={s.rollOut} key={`o${tick}`}>
          {out}
        </span>
      )}
      <span className={tick ? s.rollIn : undefined} key={`i${tick}`}>
        {value}
      </span>
    </span>
  );
}

/** True for ~1.4s after `value` increases; drives the one-time row flash. */
export function useFlashOnIncrease(value: number, enabled: boolean): boolean {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (enabled && value > prev.current) {
      setFlash(true);
      const id = window.setTimeout(() => setFlash(false), 1400);
      prev.current = value;
      return () => window.clearTimeout(id);
    }
    prev.current = value;
    return undefined;
  }, [value, enabled]);
  return flash;
}
