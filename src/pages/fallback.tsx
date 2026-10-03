import type { ReactNode } from 'react';
import { Wordmark } from '../components/shell/Logo';
import s from '../components/shell/shell.module.css';

/** Minimal chrome for the router error boundary (the full shell may be what failed). */
export function AppShellFallback({ children }: { children: ReactNode }) {
  return (
    <>
      <header className={s.topbar}>
        <div className={s.topbarInner}>
          <a href={import.meta.env.BASE_URL} className={s.brand} aria-label="Pota">
            <Wordmark />
          </a>
        </div>
      </header>
      <main className={s.main}>{children}</main>
    </>
  );
}
