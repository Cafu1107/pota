import type { CSSProperties, ReactNode } from 'react';
import { Pin, PinOff } from 'lucide-react';
import s from './page.module.css';

export function PageHeader({
  media,
  title,
  subtitle,
  meta,
  actions,
  style,
  children,
}: {
  media?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <header className={s.header} style={style}>
      <div className={s.headerMain}>
        {media && <div className={s.headerMedia}>{media}</div>}
        <div className={s.headerText}>
          <h1 className={s.title}>{title}</h1>
          {subtitle && <div className={s.subtitle}>{subtitle}</div>}
          {meta && <div className={s.meta}>{meta}</div>}
        </div>
        {actions && <div className={s.actions}>{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function HeroCard({ children }: { children: ReactNode }) {
  return <div className={s.hero}>{children}</div>;
}

export function PageStack({ children }: { children: ReactNode }) {
  return <div className={s.page}>{children}</div>;
}

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className={s.tile}>
      <span className={s.tileLabel}>{label}</span>
      <span className={s.tileValue}>{value}</span>
      {sub && <span className={s.tileSub}>{sub}</span>}
    </div>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <div className={s.tiles}>{children}</div>;
}

export function PinButton({ active, onToggle, labelOn, labelOff }: { active: boolean; onToggle: () => void; labelOn: string; labelOff: string }) {
  return (
    <button type="button" className={`${s.pin} ${active ? s.pinOn : ''}`} aria-pressed={active} onClick={onToggle}>
      {active ? <PinOff size={16} aria-hidden /> : <Pin size={16} aria-hidden />}
      <span>{active ? labelOn : labelOff}</span>
    </button>
  );
}

export function Section({ title, children, aside }: { title?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className={s.section}>
      {(title || aside) && (
        <div className={s.sectionHead}>
          {title && <h2 className={s.sectionTitle}>{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
