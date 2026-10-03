import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { MapPinOff, TriangleAlert } from 'lucide-react';
import { useI18n } from '../i18n';
import { EmptyState } from '../components/ui/States';
import { AppShellFallback } from './fallback';
import u from '../components/ui/ui.module.css';

export function NotFound({ title, hint }: { title?: string; hint?: string }) {
  const { t } = useI18n();
  return (
    <EmptyState
      icon={<MapPinOff size={22} />}
      title={title ?? t('notFoundTitle')}
      hint={hint ?? t('notFoundHint')}
      action={
        <Link to="/" className={u.button}>
          {t('goHome')}
        </Link>
      }
    />
  );
}

export function RouteError() {
  const err = useRouteError();
  const { t } = useI18n();
  const notFound = isRouteErrorResponse(err) && err.status === 404;
  return (
    <AppShellFallback>
      {notFound ? (
        <NotFound />
      ) : (
        <EmptyState
          icon={<TriangleAlert size={22} />}
          title={t('errorTitle')}
          hint={t('errorHint')}
          action={
            <a href={import.meta.env.BASE_URL} className={u.button}>
              {t('goHome')}
            </a>
          }
        />
      )}
    </AppShellFallback>
  );
}
