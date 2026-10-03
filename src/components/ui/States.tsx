import type { ReactNode } from 'react';
import { CloudOff, RotateCw } from 'lucide-react';
import { useI18n } from '../../i18n';
import s from './ui.module.css';

export function Skeleton({ w, h = 12, r, className }: { w?: number | string; h?: number; r?: number; className?: string }) {
  return <span aria-hidden className={`${s.skel} ${className ?? ''}`} style={{ width: w, height: h, borderRadius: r }} />;
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className={s.empty}>
      {icon && <div className={s.emptyIcon}>{icon}</div>}
      <p className={s.emptyTitle}>{title}</p>
      {hint && <p className={s.emptyHint}>{hint}</p>}
      {action && <div className={s.emptyAction}>{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry, title, hint }: { onRetry?: () => void; title?: string; hint?: string }) {
  const { t } = useI18n();
  return (
    <EmptyState
      icon={<CloudOff size={22} />}
      title={title ?? t('errorTitle')}
      hint={hint ?? t('errorHint')}
      action={
        onRetry && (
          <button type="button" className={s.button} onClick={onRetry}>
            <RotateCw size={15} />
            {t('retry')}
          </button>
        )
      }
    />
  );
}

export function Card({ children, className, as: Tag = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' } & Record<string, unknown>) {
  return (
    <Tag className={`${s.card} ${className ?? ''}`} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, children, id }: { title: ReactNode; children?: ReactNode; id?: string }) {
  return (
    <header className={s.cardHeader}>
      <h2 className={s.cardTitle} id={id}>
        {title}
      </h2>
      {children && <div className={s.cardHeaderAside}>{children}</div>}
    </header>
  );
}
