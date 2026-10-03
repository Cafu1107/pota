import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Star } from 'lucide-react';
import s from './ui.module.css';

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
  icon?: ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`${s.segmented} ${size === 'sm' ? s.segSm : ''}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={s.segItem}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          <span>{o.label}</span>
          {o.count !== undefined && <span className={s.segCount}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export interface TabItem {
  to: string;
  label: string;
  end?: boolean;
}

/** Route-backed tabs: each tab is a link, so tabs are shareable and keep history. */
export function RouteTabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav aria-label={label} className={s.tabs}>
      <div className={s.tabsInner}>
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} replace className={({ isActive }) => `${s.tab} ${isActive ? s.tabActive : ''}`}>
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function StarButton({
  active,
  onToggle,
  labelOn,
  labelOff,
  size = 'md',
}: {
  active: boolean;
  onToggle: () => void;
  labelOn: string;
  labelOff: string;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      className={`${s.star} ${active ? s.starOn : ''} ${size === 'sm' ? s.starSm : ''}`}
      aria-pressed={active}
      aria-label={active ? labelOn : labelOff}
      title={active ? labelOn : labelOff}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      <Star size={size === 'sm' ? 16 : 18} strokeWidth={2} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}

export function Chip({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={`${s.chip} ${active ? s.chipActive : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}
